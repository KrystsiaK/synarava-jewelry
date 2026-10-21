import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AdminHrefField } from "./admin-href-field";

const darkVars = {
  "--adm-panel": "#141312",
  "--adm-field": "#0d0c0b",
  "--adm-ink": "#f4efe7",
  "--adm-text": "#ddd2c3",
  "--adm-muted": "#b8aea1",
  "--adm-border": "rgba(214, 190, 150, 0.18)",
  "--adm-accent": "#d8b66a",
  "--adm-danger": "#b94a48",
  "--adm-danger-ink": "#e87874",
  "--adm-z-popover": "40",
  background: "#141312",
  color: "#f4efe7",
} as CSSProperties;

const lightVars = {
  "--adm-panel": "#ffffff",
  "--adm-field": "#f8f7f4",
  "--adm-ink": "#211d19",
  "--adm-text": "#38322c",
  "--adm-muted": "#675e55",
  "--adm-border": "rgba(66, 55, 42, 0.18)",
  "--adm-accent": "#7b5b1c",
  "--adm-danger": "#9d3836",
  "--adm-danger-ink": "#9d3836",
  "--adm-z-popover": "40",
  background: "#ffffff",
  color: "#211d19",
} as CSSProperties;

function ThemeFrame({
  label,
  style,
  children,
}: {
  label: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className="admin-modal-root grid gap-3 rounded-[14px] p-5" style={style}>
      <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.08em] opacity-60">{label}</p>
      {children}
    </div>
  );
}

const meta = {
  title: "synarava-cms/AdminHrefField",
  component: AdminHrefField,
  args: {
    label: "CTA href",
    owner: "Synarava" as const,
    name: "ctaHref",
    defaultValue: "/shop",
  },
} satisfies Meta<typeof AdminHrefField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BothThemes: Story = {
  render: (args) => (
    <div className="grid gap-4 bg-[#cfcabe] p-6">
      <ThemeFrame label="Light" style={lightVars}>
        <AdminHrefField {...args} />
        <AdminHrefField {...args} label="Disabled" disabled defaultValue="/collections" />
        <AdminHrefField {...args} label="With error" error="Enter a storefront path." defaultValue="" />
      </ThemeFrame>
      <ThemeFrame label="Dark" style={darkVars}>
        <AdminHrefField {...args} />
        <AdminHrefField {...args} label="Disabled" disabled defaultValue="/collections" />
        <AdminHrefField {...args} label="With error" error="Enter a storefront path." defaultValue="" />
      </ThemeFrame>
    </div>
  ),
};
