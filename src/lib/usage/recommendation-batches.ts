export interface RecommendationBatchRow {
  normalized_profile_id: string | null;
}

export function countRecommendationBatches(rows: RecommendationBatchRow[]) {
  return new Set(
    rows
      .map((row) => row.normalized_profile_id)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  ).size;
}
