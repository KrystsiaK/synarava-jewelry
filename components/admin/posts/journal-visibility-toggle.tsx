"use client";

import { useState, useTransition } from "react";

import { setJournalVisibilityAction } from "@/app/admin/actions/posts";
import { useAdminToast } from "@/components/admin/shared/admin-toast";

export function JournalVisibilityToggle({ initialVisible }: { initialVisible: boolean }) {
  const [visible, setVisible] = useState(initialVisible);
  const [isPending, startTransition] = useTransition();
  const { pushToast } = useAdminToast();

  function toggle(next: boolean) {
    setVisible(next);
    startTransition(async () => {
      try {
        await setJournalVisibilityAction(next);
        pushToast({
          message: next
            ? "Journal is now visible in the site navigation."
            : "Journal is hidden from the site navigation and its pages return not-found.",
          tone: "success",
        });
      } catch {
        setVisible(!next);
        pushToast({ message: "Could not update Journal visibility. Try again.", tone: "error" });
      }
    });
  }

  return (
    <label className="group flex min-h-16 cursor-pointer items-start justify-between gap-4 border border-[var(--adm-border)] bg-[var(--adm-panel)] p-4">
      <span className="min-w-0">
        <span className="block text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>Show Journal in site navigation</span>
        <span className="mt-1 block text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
          Turn this on once there are stories worth showing. While off, the nav link and the /journal pages
          are hidden from visitors and search engines.
        </span>
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          aria-label="Show Journal in site navigation"
          checked={visible}
          disabled={isPending}
          onChange={(event) => toggle(event.currentTarget.checked)}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full border border-[var(--adm-border-strong)] bg-[var(--adm-field)] transition-colors peer-checked:border-[var(--adm-accent)] peer-checked:bg-[var(--adm-accent)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--adm-accent)]" />
        <span className="pointer-events-none absolute left-1 top-1 size-4 rounded-full bg-[var(--adm-muted)] transition-transform peer-checked:translate-x-5 peer-checked:bg-[var(--adm-bg)]" />
      </span>
    </label>
  );
}
