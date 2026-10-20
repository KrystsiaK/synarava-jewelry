/** Browser-only Storybook shim; authentication code is never exercised in stories. */
export function randomBytes(size: number) {
  return new Uint8Array(size);
}

export function scryptSync() {
  throw new Error("scryptSync is unavailable in Storybook");
}

export function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function unavailableDigest() {
  return {
    update: () => unavailableDigest(),
    digest: () => "storybook-crypto-unavailable",
  };
}

export const createHash = unavailableDigest;
export const createHmac = unavailableDigest;
export const randomUUID = () => "00000000-0000-4000-8000-000000000000";
export const createPublicKey = () => ({});
export const verify = () => false;
