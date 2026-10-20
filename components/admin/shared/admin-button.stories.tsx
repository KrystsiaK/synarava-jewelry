import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ArrowUpFromLine, RefreshCw } from "lucide-react";

import { AdminButton } from "./admin-button";

const darkVars = {
  "--adm-bg": "#090807",
  "--adm-panel": "#141312",
  "--adm-ink": "#f4efe7",
  "--adm-text": "#ddd2c3",
  "--adm-muted": "#b8aea1",
  "--adm-border": "rgba(214, 190, 150, 0.18)",
  "--adm-border-strong": "rgba(216, 182, 106, 0.42)",
  "--adm-accent": "#d8b66a",
  "--adm-accent-soft": "rgba(216, 182, 106, 0.12)",
  "--adm-danger": "#b94a48",
  "--adm-danger-soft": "rgba(185, 74, 72, 0.13)",
  background: "#141312",
  color: "#f4efe7",
} as CSSProperties;

const lightVars = {
  "--adm-bg": "#f2f1ee",
  "--adm-panel": "#ffffff",
  "--adm-ink": "#211d19",
  "--adm-text": "#38322c",
  "--adm-muted": "#675e55",
  "--adm-border": "rgba(66, 55, 42, 0.18)",
  "--adm-border-strong": "rgba(138, 102, 31, 0.46)",
  "--adm-accent": "#7b5b1c",
  "--adm-accent-soft": "rgba(138, 102, 31, 0.1)",
  "--adm-danger": "#9d3836",
  "--adm-danger-soft": "rgba(157, 56, 54, 0.09)",
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

function ButtonMatrix() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AdminButton variant="primary">Primary</AdminButton>
      <AdminButton variant="secondary">Secondary</AdminButton>
      <AdminButton variant="ghost">Ghost</AdminButton>
      <AdminButton variant="danger">Danger</AdminButton>
      <AdminButton variant="primary" disabled>
        Disabled
      </AdminButton>
      <AdminButton variant="primary" busy>
        Busy…
      </AdminButton>
      <AdminButton
        variant="secondary"
        leadingIcon={<ArrowUpFromLine className="size-4" aria-hidden="true" />}
      >
        Leading icon
      </AdminButton>
      <AdminButton
        variant="ghost"
        busy
        leadingIcon={<RefreshCw className="size-4 animate-spin" aria-hidden="true" />}
      >
        Syncing…
      </AdminButton>
    </div>
  );
}

const meta = {
  title: "synarava-cms/AdminButton",
  component: AdminButton,
  args: {
    children: "Save product",
    variant: "primary",
  },
} satisfies Meta<typeof AdminButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BothThemes: Story = {
  render: () => (
    <div className="grid gap-4 bg-[#cfcabe] p-6">
      <ThemeFrame label="Light" style={lightVars}>
        <ButtonMatrix />
      </ThemeFrame>
      <ThemeFrame label="Dark" style={darkVars}>
        <ButtonMatrix />
      </ThemeFrame>
    </div>
  ),
};

export const Default: Story = {};

export const Disabled: Story = {
  args: { disabled: true, children: "Disabled" },
};

export const Busy: Story = {
  args: { busy: true, children: "Saving…" },
};
