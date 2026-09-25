/** Canonical storefront video MIME types. */
export type SiteVideoMimeType = "video/mp4" | "video/webm";

const MIME_ALIASES: Record<string, SiteVideoMimeType> = {
  "video/mp4": "video/mp4",
  "application/mp4": "video/mp4",
  "video/webm": "video/webm",
};

const EXTENSION_MIME: Record<string, SiteVideoMimeType> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
};

function stripMimeParams(value: string) {
  return value.toLowerCase().split(";")[0]?.trim() ?? "";
}

/**
 * Resolve a canonical video MIME for upload.
 * Browsers often leave `File.type` empty for `.mp4` — fall back to the extension.
 */
export function resolveSiteVideoMimeType(input: {
  mimeType?: string | null;
  filename?: string | null;
}): SiteVideoMimeType | null {
  const raw = typeof input.mimeType === "string" ? stripMimeParams(input.mimeType) : "";
  if (raw && MIME_ALIASES[raw]) return MIME_ALIASES[raw];

  const extension = typeof input.filename === "string"
    ? input.filename.toLowerCase().match(/\.([^.]+)$/)?.[1]
    : undefined;
  if (extension && EXTENSION_MIME[extension]) return EXTENSION_MIME[extension];

  return null;
}
