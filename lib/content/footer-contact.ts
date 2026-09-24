import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import {
  DEFAULT_FOOTER_CONTACT_EMAIL,
  FOOTER_CONTACT_KEY,
  normalizeFooterContactEmail,
  parseFooterContact,
} from "@/lib/content/footer-contact-fields";

export {
  DEFAULT_FOOTER_CONTACT_EMAIL,
  FOOTER_CONTACT_KEY,
} from "@/lib/content/footer-contact-fields";

export const getFooterContactEmail = cache(async (): Promise<string> => {
  const setting = await db.siteSetting.findUnique({ where: { key: FOOTER_CONTACT_KEY } });
  return parseFooterContact(setting?.value)?.email ?? DEFAULT_FOOTER_CONTACT_EMAIL;
});

export async function setFooterContactEmail(raw: string): Promise<string> {
  const email = normalizeFooterContactEmail(raw);
  if (!email) {
    throw new Error("Footer contact email must be a valid address.");
  }

  await db.siteSetting.upsert({
    where: { key: FOOTER_CONTACT_KEY },
    update: { value: { email } },
    create: { key: FOOTER_CONTACT_KEY, value: { email } },
  });
  return email;
}
