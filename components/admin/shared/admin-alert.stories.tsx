import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { AdminAlert } from "@/components/synarava-cms";

const darkVars = {
  "--adm-danger": "#b94a48",
  "--adm-danger-ink": "#e87874",
  "--adm-success": "#b8c98a",
  background: "#141312",
  color: "#f4efe7",
} as CSSProperties;

const lightVars = {
  "--adm-danger": "#9d3836",
  "--adm-danger-ink": "#9d3836",
  "--adm-success": "#456229",
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
  title: "synarava-cms/AdminAlert",
  component: AdminAlert,
  args: {
    message: "Publish the page before opening the editor.",
    tone: "error",
  },
} satisfies Meta<typeof AdminAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BothThemes: Story = {
  render: (args) => (
    <div className="grid gap-4 bg-[#cfcabe] p-6">
      <ThemeFrame label="Light" style={lightVars}>
        <AdminAlert {...args} />
        <AdminAlert tone="success" message="Page saved." />
      </ThemeFrame>
      <ThemeFrame label="Dark" style={darkVars}>
        <AdminAlert {...args} />
        <AdminAlert tone="success" message="Page saved." />
      </ThemeFrame>
    </div>
  ),
};
