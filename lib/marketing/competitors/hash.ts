import { createHash } from "node:crypto";

/** Content hash of name|price|currency|availability for change detection. */
export function observationContentHash(input: {
  name: string | null | undefined;
  price: number | string | null | undefined;
  currency: string | null | undefined;
  availability: string | null | undefined;
}): string {
  const price =
    input.price == null || input.price === ""
      ? ""
      : typeof input.price === "number"
        ? input.price.toFixed(2)
        : String(input.price);
  const payload = [
    input.name ?? "",
    price,
    input.currency ?? "",
    input.availability ?? "",
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}
