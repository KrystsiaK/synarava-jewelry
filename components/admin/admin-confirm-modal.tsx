"use client";

type AdminConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  tone?: "default" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
};

export function AdminConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  tone = "default",
  onCancel,
  onConfirm,
}: AdminConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-6"
      style={{ background: "rgba(5,4,3,0.82)", backdropFilter: "blur(10px)" }}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="adm-panel w-full max-w-md p-6" role="dialog" aria-modal="true">
        <p className="adm-section-tag mb-3">[ CONFIRM ACTION ]</p>
        <h3 className="adm-title-sm">{title}</h3>
        <p className="adm-copy mt-4">{description}</p>
        <div
          className="mt-6 flex flex-wrap justify-end gap-3 pt-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button type="button" onClick={onCancel} className="adm-btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={tone === "danger" ? "adm-btn-danger" : "adm-btn-primary"}
          >
            {pending ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
