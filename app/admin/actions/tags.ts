import { db } from "@/lib/db";

export type SavedTagPayload = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  slug: string;
  name: string;
};

export async function getSavedTagPayload(tagId: string): Promise<SavedTagPayload> {
  const tag = await db.tag.findUnique({
    where: { id: tagId },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      slug: true,
      name: true,
    },
  });

  if (!tag) {
    throw new Error("Tag not found.");
  }

  return tag;
}
