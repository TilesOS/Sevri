import { NextResponse } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { getPortfolioView } from "@/lib/portfolio/portfolio-view";

export async function GET() {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  const portfolio = await getPortfolioView(user.id);

  return NextResponse.json(portfolio);
}
