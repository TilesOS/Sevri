begin;

select plan(8);

select has_table(
  'private',
  'rate_limit_reservations',
  'the reservation ledger is in the private schema'
);

select has_index(
  'private',
  'rate_limit_reservations',
  'rate_limit_reservations_active_lookup_idx',
  'active reservations have a lookup index'
);

select has_index(
  'private',
  'rate_limit_reservations',
  'rate_limit_reservations_retention_idx',
  'expired records have a cleanup index'
);

select ok(
  not has_table_privilege('anon', 'private.rate_limit_reservations', 'select'),
  'anon cannot read limiter records'
);

select ok(
  not has_table_privilege('authenticated', 'private.rate_limit_reservations', 'select'),
  'authenticated users cannot read limiter records'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.claim_rate_limit_reservation(text,text,integer,integer,integer)',
    'execute'
  ),
  'anon cannot execute the claim RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_rate_limit_reservation(text,text,integer,integer,integer)',
    'execute'
  ),
  'authenticated users cannot execute the claim RPC'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_rate_limit_reservation(text,text,integer,integer,integer)',
    'execute'
  ),
  'service_role can execute the claim RPC'
);

select * from finish();
rollback;
