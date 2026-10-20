import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { AdminFieldShell } from "./admin-field-shell";
import { AdminHelp } from "./admin-help";
import { AdminTextControl } from "./admin-text-field";

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
  "--adm-warning": "#f0a03c",
  "--adm-info": "#4c9eff",
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
  "--adm-warning": "#c47a12",
  "--adm-info": "#0071e3",
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
    <div className="admin-modal-root grid gap-4 rounded-[14px] p-5" style={style}>
      <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.08em] opacity-60">{label}</p>
      {children}
    </div>
  );
}

function ShellDemo() {
  return (
    <>
      <AdminFieldShell controlId="shell-default" label="Tags" owner="Shopify" help={<AdminHelp>Comma-separated.</AdminHelp>}>
        <AdminTextControl id="shell-default" defaultValue="atelier, gold" />
      </AdminFieldShell>
      <AdminFieldShell controlId="shell-error" label="SKU" owner="Shopify" required error="Enter a SKU.">
        <AdminTextControl id="shell-error" invalid defaultValue="" />
      </AdminFieldShell>
      <AdminFieldShell controlId="shell-warn" label="SEO title" warning="Long titles may truncate in search results.">
        <AdminTextControl id="shell-warn" defaultValue="A very long product title for search" />
      </AdminFieldShell>
      <AdminFieldShell controlId="shell-disabled" label="Read-only shell" disabled>
        <AdminTextControl id="shell-disabled" disabled defaultValue="Locked" />
      </AdminFieldShell>
    </>
  );
}

const meta = {
  title: "synarava-cms/AdminFieldShell",
  component: AdminFieldShell,
} satisfies Meta<typeof AdminFieldShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BothThemes: Story = {
  args: {
    controlId: "shell",
    children: null,
  },
  render: () => (
    <div className="grid gap-4 bg-[#cfcabe] p-6">
      <ThemeFrame label="Light" style={lightVars}>
        <ShellDemo />
      </ThemeFrame>
      <ThemeFrame label="Dark" style={darkVars}>
        <ShellDemo />
      </ThemeFrame>
    </div>
  ),
};
