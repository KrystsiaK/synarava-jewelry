import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AdminCheckboxControl, AdminCheckboxField } from "./admin-checkbox-field";

const darkVars = {
  "--adm-panel": "#141312",
  "--adm-ink": "#f4efe7",
  "--adm-text": "#ddd2c3",
  "--adm-muted": "#b8aea1",
  "--adm-border": "rgba(214, 190, 150, 0.18)",
  "--adm-accent": "#d8b66a",
  "--adm-danger": "#b94a48",
  "--adm-danger-ink": "#e87874",
  background: "#141312",
  color: "#f4efe7",
} as CSSProperties;

const lightVars = {
  "--adm-panel": "#ffffff",
  "--adm-ink": "#211d19",
  "--adm-text": "#38322c",
  "--adm-muted": "#675e55",
  "--adm-border": "rgba(66, 55, 42, 0.18)",
  "--adm-accent": "#7b5b1c",
  "--adm-danger": "#9d3836",
  "--adm-danger-ink": "#9d3836",
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
  title: "synarava-cms/AdminCheckboxField",
  component: AdminCheckboxField,
  args: {
    label: "Featured on home",
  },
} satisfies Meta<typeof AdminCheckboxField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BothThemes: Story = {
  args: {
    label: "Featured on home",
  },
  render: () => (
    <div className="grid gap-4 bg-[#cfcabe] p-6">
      {[lightVars, darkVars].map((style, index) => (
        <ThemeFrame key={index === 0 ? "light" : "dark"} label={index === 0 ? "Light" : "Dark"} style={style}>
          <AdminCheckboxField label="Featured on home" defaultChecked />
          <AdminCheckboxField label="With follow-on note">
            <p className="adm-copy m-0 text-[0.8rem] text-[var(--adm-muted)]">
              Extra content under the checkbox (e.g. certificate URL).
            </p>
          </AdminCheckboxField>
          <AdminCheckboxControl label="Inline control" />
          <AdminCheckboxControl label="Disabled control" disabled />
        </ThemeFrame>
      ))}
    </div>
  ),
};
