import { isIP } from "node:net";

type HeaderReader = { get(name: string): string | null };

function validIp(value: string | null | undefined) {
  const candidate = value?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

export function getTrustedClientIp(headers: HeaderReader) {
  for (const name of ["cf-connecting-ip", "fly-client-ip", "x-real-ip"]) {
    const candidate = validIp(headers.get(name));
    if (candidate) return candidate;
  }

  // Proxies append their own hop to the right. Trust the nearest (rightmost)
  // forwarded value rather than an attacker-controlled leftmost value.
  const forwarded = headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()) ?? [];
  for (let index = forwarded.length - 1; index >= 0; index -= 1) {
    const candidate = validIp(forwarded[index]);
    if (candidate) return candidate;
  }

  return "unknown";
}
