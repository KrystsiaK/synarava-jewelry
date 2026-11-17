export async function moderateProductReviewsAction() {
  return { success: "Updated", updated: 1 };
}

export async function saveProductReviewsSettingsAction() {
  return { success: "Saved" };
}

export type AdminReviewsActionState = {
  error?: string;
  success?: string;
  updated?: number;
};
