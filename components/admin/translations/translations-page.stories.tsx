import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { TranslationsSyncSummary } from "@/components/admin/translations/translations-sync-summary";

/**
 * Presentational Translations page composition for Storybook.
 * LanguagesPanel pulls server actions and breaks the static iframe; the live page
 * mounts LanguagesPanel + this summary. Chromatic viewports: 390 / 768 / 1440.
 */

const lightVars = {
  "--adm-bg": "#f7f3ec",
  "--adm-panel": "#ffffff",
  "--adm-ink": "#211d19",
  "--adm-border": "#e4ddd2",
  "--adm-muted": "#7a7168",
  "--adm-danger": "#9d3836",
  "--adm-success": "#456229",
  "--adm-warning": "#a16207",
  background: "#f7f3ec",
  color: "#211d19",
} as CSSProperties;

const darkVars = {
  "--adm-bg": "#141312",
  "--adm-panel": "#1c1a18",
  "--adm-ink": "#f4efe7",
  "--adm-border": "#3a342e",
  "--adm-muted": "#a79d92",
  "--adm-danger": "#e87874",
  "--adm-success": "#b8c98a",
  "--adm-warning": "#e3b341",
  background: "#141312",
  color: "#f4efe7",
} as CSSProperties;

function Frame({
  label,
  style,
  width,
  children,
}: {
  label: string;
  style: CSSProperties;
  width: number;
  children: ReactNode;
}) {
  return (
    <div className="admin-terminal admin-modal-root p-4" style={{ ...style, width }}>
      <p className="m-0 mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.08em] opacity-60">
        {label}
        {" "}
        ·
        {width}
        px
      </p>
      {children}
    </div>
  );
}

function LanguagesShell() {
  return (
    <section className="adm-panel grid gap-4 p-5 md:p-6" data-component="LanguagesPanel">
      <div>
        <h2 className="text-lg font-semibold">Languages</h2>
        <p className="text-sm text-[var(--adm-muted)]">
          Add, hide, restore, export, or import a language. Import always shows a preview before anything is written.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--adm-border)]">
              <th className="py-2">Code</th>
              <th>Route</th>
              <th>State</th>
              <th>Shopify</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--adm-border)]">
              <td className="py-2">en (source)</td>
              <td>/en</td>
              <td>published</td>
              <td>en</td>
            </tr>
            <tr className="border-b border-[var(--adm-border)]">
              <td className="py-2">pt</td>
              <td>/pt</td>
              <td>published</td>
              <td>pt-PT</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--adm-muted)]">
        Import preview is required: counts and sample field changes, then confirm before Synarava is updated.
      </p>
    </section>
  );
}

function TranslationsPageStory({ total = 3 }: { total?: number }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-7">
      <header>
        <h1 className="adm-page-title">Translations</h1>
        <p className="adm-page-subtitle">
          Manage languages and see where Synarava and Shopify differ. Choose Keep ours or Take Shopify
          on the product, collection, or page that owns the field.
        </p>
      </header>
      <LanguagesShell />
      <TranslationsSyncSummary
        counts={{
          total,
          products: total > 0 ? 2 : 0,
          collections: total > 0 ? 1 : 0,
          pages: 0,
          settings: 0,
        }}
        checkedAt="2026-10-23T10:00:00.000Z"
        state="ready"
      />
    </div>
  );
}

const meta = {
  title: "Admin/Translations/Page",
  component: TranslationsPageStory,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [1440, 768, 390] },
  },
} satisfies Meta<typeof TranslationsPageStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LightAndDarkViewports: Story = {
  name: "Languages + summary (light/dark · 390/768/1440)",
  render: () => (
    <div className="grid gap-8">
      <Frame label="Light" style={lightVars} width={1440}>
        <TranslationsPageStory />
      </Frame>
      <Frame label="Dark" style={darkVars} width={1440}>
        <TranslationsPageStory />
      </Frame>
      <Frame label="Light" style={lightVars} width={768}>
        <TranslationsPageStory />
      </Frame>
      <Frame label="Light" style={lightVars} width={390}>
        <TranslationsPageStory />
      </Frame>
      <Frame label="Light empty" style={lightVars} width={768}>
        <TranslationsPageStory total={0} />
      </Frame>
    </div>
  ),
};
