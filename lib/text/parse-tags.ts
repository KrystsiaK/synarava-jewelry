import { slugify } from "@/lib/text/slug";

export function parseTags(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => slugify(item))
        .filter(Boolean),
    ),
  );
}
