"use client";

import { useState } from "react";

import {
  AdminHelp,
  AdminOrderedList,
  AdminTextField,
} from "@/components/synarava-cms";
import {
  DEFAULT_FOOTER_CONTACT_EMAIL,
  MAX_FOOTER_CONTACT_EMAILS,
  MIN_FOOTER_CONTACT_EMAILS,
} from "@/lib/content/footer-contact-fields";

type EmailRow = { id: string; email: string };

type FooterEmailsEditorProps = {
  initialEmails: string[];
};

function createRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `email-${crypto.randomUUID()}`;
  }
  return `email-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Ordered contact emails for the footer (and primary CTA = first row).
 */
export function FooterEmailsEditor({ initialEmails }: FooterEmailsEditorProps) {
  const [rows, setRows] = useState<EmailRow[]>(() => {
    const source = initialEmails.length > 0 ? initialEmails : [DEFAULT_FOOTER_CONTACT_EMAIL];
    return source.map((email) => ({ id: createRowId(), email }));
  });

  return (
    <section id="copy-footer-emails" className="adm-panel grid gap-4 p-5 md:p-6 scroll-mt-24">
      <div>
        <p className="adm-section-tag">Footer — contact emails</p>
        <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
          Mailto addresses in the service column. The first email is also used by the shared contact CTA
          banner. Shared across languages.
        </p>
      </div>

      <input
        type="hidden"
        name="footerContactEmails"
        value={JSON.stringify(rows.map((row) => row.email))}
        readOnly
      />

      <AdminOrderedList
        label="Contact emails"
        help={
          <AdminHelp>
            Add multiple addresses if needed. Reorder with the arrows — the top address is the primary
            contact CTA target.
          </AdminHelp>
        }
        items={rows}
        onChange={setRows}
        getKey={(row) => row.id}
        minItems={MIN_FOOTER_CONTACT_EMAILS}
        maxItems={MAX_FOOTER_CONTACT_EMAILS}
        createItem={() => ({ id: createRowId(), email: "" })}
        addLabel="Add email"
        renderItem={(row, { index }) => (
          <AdminTextField
            label={index === 0 ? "Email (primary)" : "Email"}
            value={row.email}
            onChange={(event) => {
              const value = event.target.value;
              setRows((current) =>
                current.map((entry) => (entry.id === row.id ? { ...entry, email: value } : entry)),
              );
            }}
            placeholder={DEFAULT_FOOTER_CONTACT_EMAIL}
            clearable
          />
        )}
      />
    </section>
  );
}
