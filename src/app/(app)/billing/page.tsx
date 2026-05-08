import { redirect } from "next/navigation";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();

  if (resolvedSearchParams.checkout) {
    params.set("checkout", resolvedSearchParams.checkout);
  }

  if (resolvedSearchParams.session_id) {
    params.set("session_id", resolvedSearchParams.session_id);
  }

  const query = params.toString();
  redirect(query ? `/settings/billing?${query}` : "/settings/billing");
}
