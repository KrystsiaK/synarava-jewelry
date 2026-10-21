import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AdminStatusBadge } from "./admin-status-badge";

const darkVars = {
  "--adm-panel": "#141312",
  "--adm-ink": "#f4efe7",
  background: "#141312",
  color: "#f4efe7",
} as CSSProperties;

const lightVars = {
  "--adm-panel": "#ffffff",
  "--adm-ink": "#211d19",
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
    <div className="flex flex-wrap gap-2">
      <AdminStatusBadge status="PUBLISHED" />
      <AdminStatusBadge status="DRAFT" />
      <AdminStatusBadge status="ARCHIVED" />
      <AdminStatusBadge status="UNLISTED" />
      <AdminStatusBadge tone="pending">Pending</AdminStatusBadge>
      <AdminStatusBadge tone="conflict">Conflict</AdminStatusBadge>
      <AdminStatusBadge tone="error">Error</AdminStatusBadge>
    </div>
  );
}

const meta = {
  title: "synarava-cms/AdminStatusBadge",
  component: AdminStatusBadge,
  args: { status: "PUBLISHED" as const },
} satisfies Meta<typeof AdminStatusBadge>;

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
