import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Fixture files for upload tests. Generated at runtime into the OS temp
 * directory rather than committed to the repo — some of these are
 * deliberately invalid or oversized and have no reason to live in git.
 */

// Smallest possible valid PNG: a single black pixel.
const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const IMAGE_TOO_LARGE_BYTES = 11 * 1024 * 1024; // over the 10 MB limit

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "synarava-e2e-"));
}

export type FixtureFile = { path: string; mimeType: string; name: string };

export function validPngFixture(): FixtureFile {
  const dir = tempDir();
  const path = join(dir, "valid.png");
  writeFileSync(path, Buffer.from(ONE_PIXEL_PNG_BASE64, "base64"));
  return { path, mimeType: "image/png", name: "valid.png" };
}

/** A file that reports as `image/png` but exceeds the 10 MB server limit. */
export function oversizedImageFixture(): FixtureFile {
  const dir = tempDir();
  const path = join(dir, "oversized.png");
  // Content doesn't need to decode — the size check runs before any image
  // parsing — but it's prefixed with a real PNG signature just in case.
  const buffer = Buffer.alloc(IMAGE_TOO_LARGE_BYTES, 0);
  Buffer.from(ONE_PIXEL_PNG_BASE64, "base64").copy(buffer);
  writeFileSync(path, buffer);
  return { path, mimeType: "image/png", name: "oversized.png" };
}

/** Valid extension and MIME type, garbage bytes — fails Sharp's decode. */
export function corruptedImageFixture(): FixtureFile {
  const dir = tempDir();
  const path = join(dir, "corrupted.jpg");
  writeFileSync(path, Buffer.from("this is not a real jpeg", "utf8"));
  return { path, mimeType: "image/jpeg", name: "corrupted.jpg" };
}

/** A non-image file offered through an image upload field. */
export function nonImageFixture(): FixtureFile {
  const dir = tempDir();
  const path = join(dir, "document.pdf");
  writeFileSync(path, Buffer.from("%PDF-1.4\n%fake\n", "utf8"));
  return { path, mimeType: "application/pdf", name: "document.pdf" };
}
