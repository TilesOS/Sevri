import type { Metadata } from "next";
import { NotFoundState } from "@/components/shared/not-found-state";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function AppNotFound() {
  return (
    <NotFoundState
      eyebrow="Not found"
      title="We couldn't find that page."
      description="The project, step, or entry you asked for isn't here — it may have been deleted, or the link may point somewhere that never existed. Nothing you've saved is affected."
      actions={[
        { href: "/dashboard", label: "Back to dashboard" },
        { href: "/recommendations", label: "Browse project ideas", variant: "outline" },
      ]}
    />
  );
}
