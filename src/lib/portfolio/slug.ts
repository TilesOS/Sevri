import { randomBytes } from "node:crypto";
import { findPortfolioPublicPageSlug } from "@/lib/db/mutations/portfolio";

export async function generateUniquePortfolioSlug() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = randomBytes(8).toString("base64url");
    const existingId = await findPortfolioPublicPageSlug(slug);
    if (!existingId) {
      return slug;
    }
  }

  throw new Error("Failed to generate a unique Portfolio slug.");
}
