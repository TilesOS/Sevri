import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_TEST_URL;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const integrationEnabled = Boolean(supabaseUrl && serviceRoleKey);

function opaqueKey(label: string) {
  return createHash("sha256").update(`sevri-integration:${label}`).digest("hex");
}

function adminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase integration test environment is not configured");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface ClaimRow {
  allowed: boolean;
  reservation_id: string | null;
  remaining: number;
  reset_at: string | null;
  retry_after_seconds: number;
}

interface RecoveryClaimRow {
  allowed: boolean;
  blocked_bucket: "ip" | "email" | null;
  ip_reservation_id: string | null;
  email_reservation_id: string | null;
}

async function claim(bucket: string, keyHash: string, limit: number) {
  const { data, error } = await adminClient()
    .rpc("claim_rate_limit_reservation", {
      p_bucket: bucket,
      p_key_hash: keyHash,
      p_max_requests: limit,
      p_window_seconds: 3600,
      p_reservation_ttl_seconds: 300,
    })
    .single();

  assert.ifError(error);
  return data as ClaimRow;
}

async function claimWithTtl(
  bucket: string,
  keyHash: string,
  limit: number,
  reservationTtlSeconds: number,
) {
  const { data, error } = await adminClient()
    .rpc("claim_rate_limit_reservation", {
      p_bucket: bucket,
      p_key_hash: keyHash,
      p_max_requests: limit,
      p_window_seconds: 3600,
      p_reservation_ttl_seconds: reservationTtlSeconds,
    })
    .single();

  assert.ifError(error);
  return data as ClaimRow;
}

async function finalize(reservationId: string, consume: boolean) {
  const { data, error } = await adminClient().rpc(
    "finalize_rate_limit_reservation",
    {
      p_reservation_id: reservationId,
      p_consume: consume,
      p_resource_id: null,
    },
  );

  assert.ifError(error);
  assert.equal(data, true);
}

test(
  "parallel claims grant exactly the configured number of slots",
  { skip: !integrationEnabled },
  async () => {
    const limit = 5;
    const bucket = `integration:parallel:${randomUUID()}`;
    const keyHash = opaqueKey(bucket);
    const claims = await Promise.all(
      Array.from({ length: 24 }, () => claim(bucket, keyHash, limit)),
    );

    const allowed = claims.filter((item) => item.allowed);
    const denied = claims.filter((item) => !item.allowed);

    assert.equal(allowed.length, limit);
    assert.equal(denied.length, claims.length - limit);
    assert.equal(Math.min(...allowed.map((item) => item.remaining)), 0);
    assert.ok(denied.every((item) => item.retry_after_seconds > 0));
    assert.ok(denied.every((item) => item.reset_at !== null));

    await Promise.all(
      allowed.map((item) => finalize(item.reservation_id as string, false)),
    );
  },
);

test(
  "released work immediately restores capacity",
  { skip: !integrationEnabled },
  async () => {
    const bucket = `integration:release:${randomUUID()}`;
    const keyHash = opaqueKey(bucket);
    const first = await claim(bucket, keyHash, 1);
    assert.equal(first.allowed, true);

    const blocked = await claim(bucket, keyHash, 1);
    assert.equal(blocked.allowed, false);

    await finalize(first.reservation_id as string, false);
    const replacement = await claim(bucket, keyHash, 1);
    assert.equal(replacement.allowed, true);
    await finalize(replacement.reservation_id as string, false);
  },
);

test(
  "parallel free-generation entitlement claims stop at the plan boundary",
  { skip: !integrationEnabled },
  async () => {
    const client = adminClient();
    const userId = randomUUID();
    const keyHash = opaqueKey(`recommendation:${userId}`);
    const generationLimit = 4;
    const results = await Promise.all(
      Array.from({ length: 16 }, async () => {
        const { data, error } = await client
          .rpc("claim_recommendation_generation", {
            p_user_id: userId,
            p_key_hash: keyHash,
            p_generation_limit: generationLimit,
            p_reservation_ttl_seconds: 300,
          })
          .single();
        assert.ifError(error);
        return data as {
          allowed: boolean;
          reservation_id: string | null;
          generations_used: number;
        };
      }),
    );

    const allowed = results.filter((item) => item.allowed);
    assert.equal(allowed.length, generationLimit);
    assert.equal(
      Math.max(...allowed.map((item) => item.generations_used)),
      generationLimit,
    );
    assert.ok(
      results
        .filter((item) => !item.allowed)
        .every((item) => item.generations_used === generationLimit),
    );

    await Promise.all(
      allowed.map((item) => finalize(item.reservation_id as string, false)),
    );
  },
);

test(
  "an abandoned reservation stops counting after its stale timeout",
  { skip: !integrationEnabled },
  async () => {
    const bucket = `integration:stale:${randomUUID()}`;
    const keyHash = opaqueKey(bucket);
    const abandoned = await claimWithTtl(bucket, keyHash, 1, 1);
    assert.equal(abandoned.allowed, true);
    assert.equal((await claimWithTtl(bucket, keyHash, 1, 1)).allowed, false);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const recovered = await claimWithTtl(bucket, keyHash, 1, 1);
    assert.equal(recovered.allowed, true);
    await finalize(recovered.reservation_id as string, false);
  },
);

test(
  "a blocked recovery IP does not consume a new email-address slot",
  { skip: !integrationEnabled },
  async () => {
    const client = adminClient();
    const suffix = randomUUID();
    const blockedIpHash = opaqueKey(`ip:${suffix}`);
    const firstEmailHash = opaqueKey(`email:first:${suffix}`);
    const untouchedEmailHash = opaqueKey(`email:untouched:${suffix}`);

    const first = await client
      .rpc("claim_password_recovery_reservations", {
        p_ip_key_hash: blockedIpHash,
        p_email_key_hash: firstEmailHash,
        p_ip_max_requests: 1,
        p_email_max_requests: 1,
        p_ip_window_seconds: 3600,
        p_email_window_seconds: 3600,
        p_reservation_ttl_seconds: 300,
      })
      .single();
    assert.ifError(first.error);
    const firstRow = first.data as RecoveryClaimRow;
    assert.equal(firstRow.allowed, true);
    await Promise.all([
      finalize(firstRow.ip_reservation_id as string, true),
      finalize(firstRow.email_reservation_id as string, true),
    ]);

    const blocked = await client
      .rpc("claim_password_recovery_reservations", {
        p_ip_key_hash: blockedIpHash,
        p_email_key_hash: untouchedEmailHash,
        p_ip_max_requests: 1,
        p_email_max_requests: 1,
        p_ip_window_seconds: 3600,
        p_email_window_seconds: 3600,
        p_reservation_ttl_seconds: 300,
      })
      .single();
    assert.ifError(blocked.error);
    const blockedRow = blocked.data as RecoveryClaimRow;
    assert.equal(blockedRow.allowed, false);
    assert.equal(blockedRow.blocked_bucket, "ip");
    assert.equal(blockedRow.email_reservation_id, null);

    const differentIp = await client
      .rpc("claim_password_recovery_reservations", {
        p_ip_key_hash: opaqueKey(`ip:different:${suffix}`),
        p_email_key_hash: untouchedEmailHash,
        p_ip_max_requests: 1,
        p_email_max_requests: 1,
        p_ip_window_seconds: 3600,
        p_email_window_seconds: 3600,
        p_reservation_ttl_seconds: 300,
      })
      .single();
    assert.ifError(differentIp.error);
    const differentIpRow = differentIp.data as RecoveryClaimRow;
    assert.equal(differentIpRow.allowed, true);
    await Promise.all([
      finalize(differentIpRow.ip_reservation_id as string, false),
      finalize(differentIpRow.email_reservation_id as string, false),
    ]);
  },
);

test(
  "browser roles cannot execute reservation RPCs",
  { skip: !integrationEnabled || !anonKey },
  async () => {
    const anon = createClient(supabaseUrl as string, anonKey as string, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await anon.rpc("claim_rate_limit_reservation", {
      p_bucket: `integration:anon:${randomUUID()}`,
      p_key_hash: opaqueKey("anon"),
      p_max_requests: 1,
      p_window_seconds: 60,
      p_reservation_ttl_seconds: 30,
    });

    assert.ok(error, "anon should not be allowed to claim a reservation");
  },
);
