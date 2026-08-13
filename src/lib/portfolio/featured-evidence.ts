function getFeaturedArtifacts<T extends { id: string }>(
  artifacts: T[],
  featuredArtifactIds: string[],
) {
  const featuredIds = new Set(featuredArtifactIds);
  return artifacts.filter((artifact) => featuredIds.has(artifact.id));
}

export function getPublicFeaturedArtifactDisplayNames(
  artifacts: Array<{ id: string; display_name: string }>,
  featuredArtifactIds: string[],
) {
  return getFeaturedArtifacts(artifacts, featuredArtifactIds)
    .map((artifact) => artifact.display_name)
    .join("\n");
}

export function getPublicFeaturedEvidenceText(
  artifacts: Array<{ id: string; display_name: string; caption: string | null; alt_text: string | null }>,
  featuredArtifactIds: string[],
) {
  return getFeaturedArtifacts(artifacts, featuredArtifactIds)
    .map((artifact) => [artifact.caption, artifact.alt_text].filter(Boolean).join(" — "))
    .join("\n");
}
