export type ManualNoteInput = { url: string; text: string };

export type ManualNoteValidation =
  | { ok: true; notes: ManualNoteInput[] }
  | { ok: false; message: string };

const MAX_NOTES = 5;
const MAX_TEXT_CHARS = 2000;

/** Validate owner-pasted notes: http(s) URL, ≤5 notes, ≤2000 chars each. */
export function validateManualNotes(
  notes: ManualNoteInput[] | undefined,
): ManualNoteValidation {
  if (!notes || notes.length === 0) return { ok: true, notes: [] };
  if (notes.length > MAX_NOTES) {
    return { ok: false, message: `At most ${MAX_NOTES} manual notes allowed` };
  }
  const cleaned: ManualNoteInput[] = [];
  for (const note of notes) {
    if (!note || typeof note.url !== "string" || typeof note.text !== "string") {
      return { ok: false, message: "Each note needs url and text strings" };
    }
    const url = note.url.trim();
    const text = note.text.trim();
    if (!url || !text) {
      return { ok: false, message: "Each note needs non-empty url and text" };
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, message: `Invalid note URL: ${url}` };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, message: `Note URL must be http(s): ${url}` };
    }
    if (text.length > MAX_TEXT_CHARS) {
      return {
        ok: false,
        message: `Note text exceeds ${MAX_TEXT_CHARS} characters`,
      };
    }
    cleaned.push({ url, text });
  }
  return { ok: true, notes: cleaned };
}
