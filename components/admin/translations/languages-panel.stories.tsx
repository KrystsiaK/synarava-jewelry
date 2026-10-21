import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { LanguagesPanel } from "@/components/admin/translations/languages-panel";
import type { StorefrontLocaleRecord } from "@/lib/i18n/storefront-locale-registry";

const lightVars = {
  "--adm-border": "#e4ddd2",
  "--adm-muted": "#7a7168",
  "--adm-danger": "#9d3836",
  "--adm-success": "#456229",
  "--adm-warning": "#a16207",
  background: "#ffffff",
  color: "#211d19",
} as CSSProperties;

const darkVars = {
  "--adm-border": "#3a342e",
  "--adm-muted": "#a79d92",
  "--adm-danger": "#e87874",
  "--adm-success": "#b8c98a",
  "--adm-warning": "#e3b341",
  background: "#141312",
  color: "#f4efe7",
} as CSSProperties;

const LOCALES: StorefrontLocaleRecord[] = [
  {
    id: "en",
    code: "en",
    routeSegment: "en",
    shopifyLocale: "en",
    intlLocale: "en",
    name: "English",
    nativeName: "English",
    isDefault: true,
    status: "PUBLISHED",
    isPublished: true,
    sortOrder: 0,
    retiredAt: null,
    deletedAt: null,
    shopifyUpdatedAt: null,
  },
  {
    id: "pt",
    code: "pt",
    routeSegment: "pt",
    shopifyLocale: "pt-PT",
    intlLocale: "pt-PT",
    name: "Portuguese",
    nativeName: "Português",
    isDefault: false,
    status: "PUBLISHED",
    isPublished: true,
    sortOrder: 1,
    retiredAt: null,
    deletedAt: null,
    shopifyUpdatedAt: new Date("2026-10-01T00:00:00.000Z"),
  },
  {
    id: "ru",
    code: "ru",
    routeSegment: "ru",
    shopifyLocale: "ru",
    intlLocale: "ru",
    name: "Russian",
    nativeName: "Русский",
    isDefault: false,
    status: "DRAFT",
    isPublished: false,
    sortOrder: 2,
    retiredAt: null,
    deletedAt: null,
    shopifyUpdatedAt: null,
  },
  {
    id: "de",
    code: "de",
    routeSegment: "de",
    shopifyLocale: "de",
    intlLocale: "de",
    name: "German",
    nativeName: "Deutsch",
    isDefault: false,
    status: "RETIRED",
    isPublished: false,
    sortOrder: 3,
    retiredAt: new Date("2026-09-01T00:00:00.000Z"),
    deletedAt: null,
    shopifyUpdatedAt: null,
  },
];

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
    <div className="admin-modal-root p-4" style={{ ...style, width }}>
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

const meta = {
  title: "admin/LanguagesPanel",
  component: LanguagesPanel,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [1440, 768, 390] },
  },
  args: {
    locales: LOCALES,
    duplicateSegments: [],
    sourceViolation: null,
    hasWriteLocales: false,
  },
} satisfies Meta<typeof LanguagesPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadOnlyMissingScope: Story = {
  name: "Read-only (missing write_locales)",
  render: (args) => (
    <div className="grid gap-6">
      <Frame label="Light" style={lightVars} width={1440}>
        <LanguagesPanel {...args} />
      </Frame>
      <Frame label="Dark" style={darkVars} width={1440}>
        <LanguagesPanel {...args} />
      </Frame>
      <Frame label="Light" style={lightVars} width={768}>
        <LanguagesPanel {...args} />
      </Frame>
      <Frame label="Light" style={lightVars} width={390}>
        <LanguagesPanel {...args} />
      </Frame>
    </div>
  ),
};

export const WithWriteLocales: Story = {
  name: "Writable (write_locales granted)",
  args: { hasWriteLocales: true },
  render: (args) => (
    <div className="grid gap-6">
      <Frame label="Light" style={lightVars} width={1440}>
        <LanguagesPanel {...args} />
      </Frame>
      <Frame label="Dark" style={darkVars} width={768}>
        <LanguagesPanel {...args} />
      </Frame>
      <Frame label="Light" style={lightVars} width={390}>
        <LanguagesPanel {...args} />
      </Frame>
    </div>
  ),
};
