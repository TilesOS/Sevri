import type { Metadata } from "next";
import { getRequiredStudentUser } from "@/lib/auth/guard";
import { getCalendarPageData } from "@/lib/db/queries/calendar";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { hasCalendarExportAccess } from "@/lib/usage/limits";
import { CalendarPageClient } from "@/components/calendar/calendar-page-client";

export const metadata: Metadata = {
  title: "Calendar",
};

export default async function CalendarPage() {
  const user = await getRequiredStudentUser();
  const [calendarData, plan] = await Promise.all([
    getCalendarPageData(user.id),
    getUserPlan(user.id),
  ]);

  return (
    <CalendarPageClient
      initialData={calendarData}
      plan={plan}
      canExport={hasCalendarExportAccess(plan)}
    />
  );
}
