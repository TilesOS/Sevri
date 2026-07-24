export function getPinnedFocusStorageKey(projectId: string, milestoneId: string) {
  return `sevri:focus:${projectId}:${milestoneId}`;
}
