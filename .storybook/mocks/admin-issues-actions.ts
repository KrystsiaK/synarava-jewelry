export type AdminIssueScanState = {
  error?: string;
  success?: string;
};

export async function scanAdminIssuesAction(): Promise<AdminIssueScanState> {
  return { success: "" };
};
