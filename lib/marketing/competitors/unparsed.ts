/** No observation row when extract yields neither name nor price. */
export function shouldSkipUnparsedExtraction(input: {
  name: string | null | undefined;
  price: number | null | undefined;
}): boolean {
  const hasName = typeof input.name === "string" && input.name.trim().length > 0;
  const hasPrice = typeof input.price === "number" && Number.isFinite(input.price);
  return !hasName && !hasPrice;
}
