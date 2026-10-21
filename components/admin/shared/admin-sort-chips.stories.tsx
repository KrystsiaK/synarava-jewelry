import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { AdminSortChips } from "./admin-sort-chips";

const darkVars = {
  "--adm-panel": "#141312",
  "--adm-ink": "#f4efe7",
  "--adm-subtle": "#8b8175",
  "--adm-border": "rgba(214, 190, 150, 0.18)",
  "--adm-accent": "#d8b66a",
  "--adm-danger": "#b94a48",
  "--adm-conflict": "#f0a03c",
  background: "#141312",
  color: "#f4efe7",
} as CSSProperties;

const lightVars = {
  "--adm-panel": "#ffffff",
  "--adm-ink": "#211d19",
  "--adm-subtle": "#746a61",
  "--adm-border": "rgba(66, 55, 42, 0.18)",
  "--adm-accent": "#7b5b1c",
  "--adm-danger": "#9d3836",
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

const OPTIONS = [
  { value: "updated", label: "Updated", shortLabel: "Updated" },
  { value: "name", label: "Name", shortLabel: "Name" },
  { value: "problems", label: "Problems", shortLabel: "Problems", tone: "danger" as const },
  { value: "conflicts", label: "Conflicts", shortLabel: "Conflicts", tone: "conflict" as const },
];

function SortDemo() {
  const [value, setValue] = useState("updated");
  return <AdminSortChips value={value} options={OPTIONS} onChange={setValue} />;
}

const meta = {
  title: "synarava-cms/AdminSortChips",
  component: AdminSortChips,
} satisfies Meta<typeof AdminSortChips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BothThemes: Story = {
  args: {
    value: "updated",
    options: OPTIONS,
    onChange: () => undefined,
  },
  render: () => (
    <div className="grid gap-4 bg-[#cfcabe] p-6">
      <ThemeFrame label="Light" style={lightVars}>
        <SortDemo />
      </ThemeFrame>
      <ThemeFrame label="Dark" style={darkVars}>
        <SortDemo />
      </ThemeFrame>
    </div>
  ),
};
