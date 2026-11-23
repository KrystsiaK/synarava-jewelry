/** Storybook stubs — real marketing actions hit DB / Google APIs. */

export async function scanCompetitorsAction() {
  return { ok: true as const, written: 0, unparsed: 0 };
}

export async function generateMarketingIdeasAction() {
  return { ok: true as const, created: 0, ideas: [] };
}

export async function googleCalendarSyncEnabledAction() {
  return false;
}

export async function updateContentIdeaAction() {
  return { ok: true as const };
}

export async function approveContentIdeaAction() {
  return { ok: true as const };
}

export async function rejectContentIdeaAction() {
  return { ok: true as const };
}

export async function retryCalendarSyncAction() {
  return { ok: true as const };
}

export async function googleSheetsExportEnabledAction() {
  return false;
}

export async function downloadObservationsCsvAction() {
  return {
    ok: true as const,
    filename: "observations.csv",
    csv: "id,brand\n",
  };
}

export async function exportObservationsToGoogleSheetAction() {
  return { ok: true as const, updatedRows: 0 };
}
