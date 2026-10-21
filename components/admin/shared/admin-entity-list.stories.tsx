import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AdminEntityList } from "./admin-entity-list";
import { AdminStatusBadge } from "./admin-status-badge";

const darkVars = {
  "--adm-panel": "#141312",
  "--adm-panel-elevated": "#1d1a18",
  "--adm-ink": "#f4efe7",
  "--adm-muted": "#b8aea1",
  "--adm-subtle": "#8b8175",
  "--adm-accent-soft": "rgba(216, 182, 106, 0.12)",
  background: "#141312",
  color: "#f4efe7",
} as CSSProperties;

const lightVars = {
  "--adm-panel": "#ffffff",
  "--adm-panel-elevated": "#ece9e3",
  "--adm-ink": "#211d19",
  "--adm-muted": "#675e55",
  "--adm-subtle": "#746a61",
  "--adm-accent-soft": "rgba(138, 102, 31, 0.1)",
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

const columns = [
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
];

function ListDemo() {
  return (
    <AdminEntityList.Root>
      <AdminEntityList.Header columns={columns} gridClassName="xl:grid-cols-[1fr_8rem]" />
      <AdminEntityList.Row gridClassName="xl:grid-cols-[1fr_8rem]">
        <span className="font-semibold">Turquoise Thread Set</span>
        <AdminStatusBadge status="PUBLISHED" />
      </AdminEntityList.Row>
      <AdminEntityList.Row gridClassName="xl:grid-cols-[1fr_8rem]">
        <span className="font-semibold">Pearl Ring</span>
        <AdminStatusBadge status="DRAFT" />
      </AdminEntityList.Row>
      <AdminEntityList.Empty>No products match these filters.</AdminEntityList.Empty>
      <AdminEntityList.LoadMore hasMore loading onLoadMore={() => undefined} />
    </AdminEntityList.Root>
  );
}

const meta = {
  title: "synarava-cms/AdminEntityList",
  component: AdminEntityList.Root,
} satisfies Meta<typeof AdminEntityList.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BothThemes: Story = {
  // Required by StoryObj when the component has required props; render owns the UI.
  args: {
    children: null,
  },
  render: () => (
    <div className="grid gap-4 bg-[#cfcabe] p-6">
      <ThemeFrame label="Light" style={lightVars}>
        <ListDemo />
      </ThemeFrame>
      <ThemeFrame label="Dark" style={darkVars}>
        <ListDemo />
      </ThemeFrame>
    </div>
  ),
};
