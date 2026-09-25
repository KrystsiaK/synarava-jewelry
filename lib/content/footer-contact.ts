import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import {
  DEFAULT_FOOTER_CONTACT_EMAIL,
  FOOTER_CONTACT_KEY,
  cleanFooterContactEmails,
  parseFooterContact,
  type FooterContactData,
} from "@/lib/content/footer-contact-fields";

export {
  DEFAULT_FOOTER_CONTACT_EMAIL,
  FOOTER_CONTACT_KEY,
  MAX_FOOTER_CONTACT_EMAILS,
  MIN_FOOTER_CONTACT_EMAILS,
  type FooterContactData,
} from "@/lib/content/footer-contact-fields";

export const getFooterContact = cache(async (): Promise<FooterContactData> => {
  const setting = await db.siteSetting.findUnique({ where: { key: FOOTER_CONTACT_KEY } });
  return (
    parseFooterContact(setting?.value) ?? {
      emails: [DEFAULT_FOOTER_CONTACT_EMAIL],
    }
  );
});

/** Primary address for the shared contact CTA (first in the list). */
export const getFooterContactEmail = cache(async (): Promise<string> => {
  const contact = await getFooterContact();
  return contact.emails[0] ?? DEFAULT_FOOTER_CONTACT_EMAIL;
});

export const getFooterContactEmails = cache(async (): Promise<string[]> => {
  const contact = await getFooterContact();
  return contact.emails;
});

export async function setFooterContactEmails(raw: unknown[]): Promise<FooterContactData> {
  const value = cleanFooterContactEmails(raw);

  await db.siteSetting.upsert({
    where: { key: FOOTER_CONTACT_KEY },
    update: { value },
    create: { key: FOOTER_CONTACT_KEY, value },
  });
  return value;
}

/** @deprecated Prefer setFooterContactEmails — kept for single-email callers. */
export async function setFooterContactEmail(raw: string): Promise<string> {
  const result = await setFooterContactEmails([raw]);
  return result.emails[0]!;
}
