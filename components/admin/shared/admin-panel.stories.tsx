import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AdminPanel } from "./admin-panel";

const darkVars = {
  "--adm-bg": "#090807",
  "--adm-panel": "#141312",
  "--adm-ink": "#f4efe7",
  "--adm-text": "#ddd2c3",
  "--adm-muted": "#b8aea1",
  "--adm-border": "rgba(214, 190, 150, 0.18)",
  "--adm-accent": "#d8b66a",
  background: "#090807",
  color: "#f4efe7",
} as CSSProperties;

const lightVars = {
  "--adm-bg": "#f2f1ee",
  "--adm-panel": "#ffffff",
  "--adm-ink": "#211d19",
  "--adm-text": "#38322c",
  "--adm-muted": "#675e55",
  "--adm-border": "rgba(66, 55, 42, 0.18)",
  "--adm-accent": "#7b5b1c",
  background: "#f2f1ee",
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

function PanelDemo() {
  return (
    <AdminPanel.Root>
      <AdminPanel.Header className="adm-panel__header--ruled">
        <p className="adm-section-tag">[ PANEL ]</p>
        <h2 className="adm-title-sm mt-1">Product editor shell</h2>
      </AdminPanel.Header>
      <AdminPanel.Body>
        <p className="adm-copy m-0">Body content uses the shared panel chrome and inset rhythm.</p>
      </AdminPanel.Body>
    </AdminPanel.Root>
  );
}

const meta = {
  title: "synarava-cms/AdminPanel",
  component: AdminPanel.Root,
} satisfies Meta<typeof AdminPanel.Root>;

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
        <PanelDemo />
      </ThemeFrame>
      <ThemeFrame label="Dark" style={darkVars}>
        <PanelDemo />
      </ThemeFrame>
    </div>
  ),
};
