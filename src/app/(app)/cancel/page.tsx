import { redirect } from "next/navigation";

export default function CancelPage() {
  redirect("/settings/billing?checkout=cancel");
}
