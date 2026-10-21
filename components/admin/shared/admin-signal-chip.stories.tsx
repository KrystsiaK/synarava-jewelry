import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Check, Languages, TriangleAlert } from "lucide-react";

import { AdminSignalChip } from "./admin-signal-chip";

const darkVars = {
  "--adm-panel": "#141312",
  "--adm-ink": "#f4efe7",
  "--adm-border": "rgba(214, 190, 150, 0.18)",
  "--adm-success": "#b8c98a",
  "--adm-teal": "#6fa89a",
  "--adm-teal-soft": "rgba(111, 168, 154, 0.14)",
  "--adm-violet": "#9a87b8",
  "--adm-violet-soft": "rgba(154, 135, 184, 0.14)",
  "--adm-cool": "#7a92a3",
  "--adm-cool-soft": "rgba(122, 146, 163, 0.14)",
  "--adm-warning": "#f0a03c",
  "--adm-accent": "#d8b66a",
  "--adm-accent-soft": "rgba(216, 182, 106, 0.12)",
  "--adm-conflict": "#f0a03c",
  "--adm-conflict-soft": "rgba(240, 160, 60, 0.14)",
  "--adm-danger": "#b94a48",
  background: "#141312",
  color: "#f4efe7",
} as CSSProperties;

const lightVars = {
  "--adm-panel": "#ffffff",
  "--adm-ink": "#211d19",
  "--adm-border": "rgba(66, 55, 42, 0.18)",
  "--adm-success": "#456229",
  "--adm-teal": "#3f7a6c",
  "--adm-teal-soft": "rgba(63, 122, 108, 0.12)",
  "--adm-violet": "#6b5a8a",
  "--adm-violet-soft": "rgba(107, 90, 138, 0.11)",
  "--adm-cool": "#5d7385",
  "--adm-cool-soft": "rgba(93, 115, 133, 0.12)",
  "--adm-warning": "#c47a12",
  "--adm-accent": "#7b5b1c",
  "--adm-accent-soft": "rgba(138, 102, 31, 0.1)",
  "--adm-conflict": "#e0891a",
  "--adm-conflict-soft": "rgba(224, 137, 26, 0.12)",
  "--adm-danger": "#9d3836",
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
      <AdminSignalChip label="OK" tone="ok" tooltip="Complete" icon={<Check className="size-3.5" aria-hidden="true" />} />
      <AdminSignalChip label="Partial" tone="partial" tooltip="Some locales missing" icon={<Languages className="size-3.5" aria-hidden="true" />} />
      <AdminSignalChip label="Empty" tone="empty" tooltip="Not started" icon={<Languages className="size-3.5" aria-hidden="true" />} />
      <AdminSignalChip label="Conflict" tone="conflict" tooltip="Field conflict" icon={<TriangleAlert className="size-3.5" aria-hidden="true" />} />
      <AdminSignalChip label="Danger" tone="danger" tooltip="Real fault" icon={<TriangleAlert className="size-3.5" aria-hidden="true" />} />
      <AdminSignalChip label="Error state" tone="danger" tooltip="Fault" value="!" icon={<TriangleAlert className="size-3.5" aria-hidden="true" />} />
    </div>
  );
}

const meta = {
  title: "synarava-cms/AdminSignalChip",
  component: AdminSignalChip,
  args: {
    label: "OK",
    tone: "ok" as const,
    tooltip: "Complete",
    icon: <Check className="size-3.5" aria-hidden="true" />,
  },
} satisfies Meta<typeof AdminSignalChip>;
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
