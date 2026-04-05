import { redirect } from "next/navigation";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams({ checkout: "success" });

  if (resolvedSearchParams.session_id) {
    params.set("session_id", resolvedSearchParams.session_id);
  }

  redirect(`/billing?${params.toString()}`);
}
