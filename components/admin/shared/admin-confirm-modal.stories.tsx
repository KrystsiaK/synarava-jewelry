import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { AdminButton } from "./admin-button";
import { AdminConfirmModal } from "./admin-confirm-modal";

const darkVars = {
  "--adm-panel": "#141312",
  "--adm-ink": "#f4efe7",
  "--adm-text": "#ddd2c3",
  "--adm-muted": "#b8aea1",
  "--adm-border": "rgba(214, 190, 150, 0.18)",
  "--adm-accent": "#d8b66a",
  "--adm-danger": "#b94a48",
  "--adm-z-modal-backdrop": "190",
  "--adm-z-modal": "200",
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
  "--adm-z-modal-backdrop": "190",
  "--adm-z-modal": "200",
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
    <div className="admin-modal-root relative min-h-[18rem] rounded-[14px] p-5" style={style}>
      <p className="m-0 mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.08em] opacity-60">{label}</p>
      {children}
    </div>
  );
}

function ConfirmDemo({ tone }: { tone?: "default" | "danger" }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <>
      <AdminButton variant={tone === "danger" ? "danger" : "primary"} onClick={() => setOpen(true)}>
        Open confirm
      </AdminButton>
      <AdminConfirmModal
        open={open}
        title={tone === "danger" ? "Delete product?" : "Save product?"}
        description="This action uses the shared admin confirm sheet."
        confirmLabel={tone === "danger" ? "Delete" : "Save"}
        tone={tone}
        pending={pending}
        onCancel={() => {
          setPending(false);
          setOpen(false);
        }}
        onConfirm={() => {
          setPending(true);
          window.setTimeout(() => {
            setPending(false);
            setOpen(false);
          }, 800);
        }}
      />
    </>
  );
}

const meta = {
  title: "synarava-cms/AdminConfirmModal",
  component: AdminConfirmModal,
} satisfies Meta<typeof AdminConfirmModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BothThemes: Story = {
  args: {
    open: false,
    title: "Save product?",
    description: "Demo",
    confirmLabel: "Save",
    onCancel: () => undefined,
    onConfirm: () => undefined,
  },
  render: () => (
    <div className="grid gap-4 bg-[#cfcabe] p-6">
      <ThemeFrame label="Light · default" style={lightVars}>
        <ConfirmDemo />
      </ThemeFrame>
      <ThemeFrame label="Dark · danger / busy" style={darkVars}>
        <ConfirmDemo tone="danger" />
      </ThemeFrame>
    </div>
  ),
};
