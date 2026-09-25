"use client";

import { useState } from "react";

import type { EditablePageContent } from "@/components/admin/pages/page-types";
import { resolveHomeSectionVisibility } from "@/lib/content/home-sections";

export type HomeSectionKey = "hero" | "archive" | "edit" | "material" | "manifesto" | "finalCta";

export const HOME_SECTION_CONTROLS = [
  {
    key: "hero" as const,
    name: "heroSectionEnabled",
    label: "Hero",
    ariaLabel: "Show hero",
    description: "Opening media, headline, introduction, and primary action.",
  },
  {
    key: "archive" as const,
    name: "archiveSectionEnabled",
    label: "Featured collections",
    ariaLabel: "Show featured collections",
    description: "Chosen collections and their editorial cards, in admin order.",
  },
  {
    key: "edit" as const,
    name: "editSectionEnabled",
    label: "Product showcase",
    ariaLabel: "Show product showcase",
    description: "Four products in a row with prices and links to each piece.",
  },
  {
    key: "material" as const,
    name: "materialSectionEnabled",
    label: "Material lexicon",
    ariaLabel: "Show material lexicon",
    description: "Ordered material specimens from Material lexicon → Materials (not Featured collections).",
  },
  {
    key: "manifesto" as const,
    name: "manifestoSectionEnabled",
    label: "Manifesto",
    ariaLabel: "Show manifesto",
    description: "The single editorial principle displayed between catalog and CTA.",
  },
  {
    key: "finalCta" as const,
    name: "finalCtaSectionEnabled",
    label: "Final call to action",
    ariaLabel: "Show final call to action",
    description: "Closing shop portal with collection imagery and contact footer.",
  },
] as const;

export type HomeSectionControl = (typeof HOME_SECTION_CONTROLS)[number];

/** Single section show/hide switch — used inside each home editor panel. */
export function HomeSectionVisibilitySwitch({
  section,
  checked,
  onChange,
}: {
  section: HomeSectionControl;
  checked: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-start justify-between gap-4 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-panel-elevated)] p-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
          Show on site
        </span>
        <span className="mt-0.5 block text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
          {section.description}
        </span>
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          name={section.name}
          value="1"
          aria-label={section.ariaLabel}
          checked={checked}
          onChange={(event) => onChange(event.currentTarget.checked)}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full border border-[var(--adm-border-strong)] bg-[var(--adm-field)] transition-colors peer-checked:border-[var(--adm-accent)] peer-checked:bg-[var(--adm-accent)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--adm-accent)]" />
        <span className="pointer-events-none absolute left-1 top-1 size-4 rounded-full bg-[var(--adm-muted)] transition-transform peer-checked:translate-x-5 peer-checked:bg-[var(--adm-bg)]" />
      </span>
    </label>
  );
}

/** Compact overview grid — Storybook / legacy. Prefer per-section switches in HomePageEditorSections. */
export function HomeSectionVisibilityEditor({ content }: { content: EditablePageContent }) {
  const [visibility, setVisibility] = useState(() => resolveHomeSectionVisibility(content));

  return (
    <section aria-labelledby="home-sections-heading" className="grid gap-4 border-b border-[var(--adm-border)] pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="home-sections-heading" className="adm-title-sm">Site sections</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6" style={{ color: "var(--adm-muted)" }}>
            Choose what appears on the home page. Turning a section off keeps its content ready for later.
          </p>
        </div>
        <span className="text-xs font-semibold" style={{ color: "var(--adm-muted)" }} aria-live="polite">
          {HOME_SECTION_CONTROLS.filter((section) => visibility[section.key]).length} of {HOME_SECTION_CONTROLS.length} enabled
        </span>
      </div>

      <div className="grid gap-px overflow-hidden rounded-lg border border-[var(--adm-border)] bg-[var(--adm-border)] md:grid-cols-2">
        {HOME_SECTION_CONTROLS.map((section) => (
          <label
            key={section.name}
            className="group flex min-h-24 cursor-pointer items-start justify-between gap-4 bg-[var(--adm-panel)] p-4 transition-colors hover:bg-[var(--adm-panel-elevated)]"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>{section.label}</span>
              <span className="mt-1 block text-xs leading-5" style={{ color: "var(--adm-muted)" }}>{section.description}</span>
            </span>
            <span className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                name={section.name}
                value="1"
                aria-label={section.ariaLabel}
                checked={visibility[section.key]}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setVisibility((current) => ({ ...current, [section.key]: checked }));
                }}
                className="peer sr-only"
              />
              <span className="block h-6 w-11 rounded-full border border-[var(--adm-border-strong)] bg-[var(--adm-field)] transition-colors peer-checked:border-[var(--adm-accent)] peer-checked:bg-[var(--adm-accent)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--adm-accent)]" />
              <span className="pointer-events-none absolute left-1 top-1 size-4 rounded-full bg-[var(--adm-muted)] transition-transform peer-checked:translate-x-5 peer-checked:bg-[var(--adm-bg)]" />
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
