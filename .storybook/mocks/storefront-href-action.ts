/** Storybook stub — avoid pulling `requireAdminSession` / `cookies()` into the preview. */
export async function searchStorefrontHrefsAction(_query: string) {
  return { segments: [] as const };
}
