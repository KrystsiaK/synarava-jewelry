import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { HardDriveUpload, RefreshCw, Trash2 } from "lucide-react";

import { AdminIconButton } from "./admin-icon-button";

const darkVars = {
  "--adm-panel": "#141312",
  "--adm-ink": "#f4efe7",
  "--adm-text": "#ddd2c3",
  "--adm-border": "rgba(214, 190, 150, 0.18)",
  "--adm-accent": "#d8b66a",
  "--adm-danger": "#b94a48",
  "--adm-warning": "#f0a03c",
  "--adm-conflict": "#f0a03c",
  background: "#141312",
  color: "#f4efe7",
} as CSSProperties;

const lightVars = {
  "--adm-panel": "#ffffff",
  "--adm-ink": "#211d19",
  "--adm-text": "#38322c",
  "--adm-border": "rgba(66, 55, 42, 0.18)",
  "--adm-accent": "#7b5b1c",
  "--adm-danger": "#9d3836",
  "--adm-warning": "#c47a12",
  "--adm-conflict": "#e0891a",
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

function Matrix() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AdminIconButton label="Save product">
        <HardDriveUpload className="size-3.5" strokeWidth={2} aria-hidden="true" />
      </AdminIconButton>
      <AdminIconButton label="Save product" tone="primary">
        <HardDriveUpload className="size-3.5" strokeWidth={2} aria-hidden="true" />
      </AdminIconButton>
      <AdminIconButton label="Delete" tone="danger">
        <Trash2 className="size-3.5" strokeWidth={2} aria-hidden="true" />
      </AdminIconButton>
      <AdminIconButton label="Conflicts" tone="conflict" badge={3}>
        <RefreshCw className="size-3.5" strokeWidth={2} aria-hidden="true" />
      </AdminIconButton>
      <AdminIconButton label="Disabled" disabled>
        <HardDriveUpload className="size-3.5" strokeWidth={2} aria-hidden="true" />
      </AdminIconButton>
    </div>
  );
}

const meta = {
  title: "synarava-cms/AdminIconButton",
  component: AdminIconButton,
  args: {
    label: "Save product",
    children: <HardDriveUpload className="size-3.5" strokeWidth={2} aria-hidden="true" />,
  },
} satisfies Meta<typeof AdminIconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BothThemes: Story = {
  render: () => (
    <div className="grid gap-4 bg-[#cfcabe] p-6">
      <ThemeFrame label="Light" style={lightVars}>
        <Matrix />
      </ThemeFrame>
      <ThemeFrame label="Dark" style={darkVars}>
        <Matrix />
      </ThemeFrame>
    </div>
  ),
};
