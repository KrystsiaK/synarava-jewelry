"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

import {
  AdminFieldShell,
  fieldClass,
  useAdminFieldIds,
} from "@/components/admin/shared/admin-field-shell";
import type { AdminFieldOwner } from "@/components/admin/shared/ownership-label";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/ui";

const DEFAULT_ACCEPT = "video/mp4,video/webm,application/mp4,.mp4,.webm,.m4v";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/")
    || file.type === "application/mp4"
    || /\.(?:mp4|m4v|webm)$/i.test(file.name);
}

export type AdminVideoControlProps = {
  name: string;
  accept?: string;
  required?: boolean;
  disabled?: boolean;
  controlId?: string;
  currentVideoUrl?: string | null;
  currentVideoLabel?: string;
  emptyLabel?: string;
  removeFieldName?: string;
  removeLabel?: string;
  error?: string;
  warning?: string;
  invalid?: boolean;
  inputClassName?: string;
  onFileChange?: (file: File | null) => void;
  "aria-invalid"?: boolean;
  "aria-errormessage"?: string;
  "aria-describedby"?: string;
};

/**
 * Video file picker + selected/current preview (no label shell).
 * Embed in AdminVideoField or composite admin surfaces.
 */
export function AdminVideoControl({
  name,
  accept = DEFAULT_ACCEPT,
  required = false,
  disabled = false,
  controlId,
  currentVideoUrl,
  currentVideoLabel = "Current video",
  emptyLabel = "No video uploaded",
  removeFieldName,
  removeLabel = "Remove current video",
  error,
  warning,
  invalid = false,
  inputClassName,
  onFileChange,
  "aria-invalid": ariaInvalid,
  "aria-errormessage": ariaErrorMessage,
  "aria-describedby": ariaDescribedBy,
}: AdminVideoControlProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [brokenCurrentUrl, setBrokenCurrentUrl] = useState("");
  const [removeCurrentVideo, setRemoveCurrentVideo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef("");
  const showError = Boolean(error) || invalid || ariaInvalid === true;

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function updateSelectedFile(file: File | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }

    setSelectedFile(file);
    if (file) setRemoveCurrentVideo(false);
    onFileChange?.(file);

    if (!file || !isVideoFile(file)) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
  }

  function clearSelectedFile() {
    updateSelectedFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function toggleRemoveCurrentVideo() {
    setRemoveCurrentVideo((current) => !current);
    clearSelectedFile();
  }

  const currentBroken = Boolean(currentVideoUrl && brokenCurrentUrl === currentVideoUrl);
  const previewClass = "aspect-video w-full max-h-56 object-cover";

  return (
    <div data-component="AdminVideoControl" className="grid max-w-xl gap-4">
      <input
        ref={inputRef}
        id={controlId}
        name={name}
        type="file"
        accept={accept}
        required={required}
        disabled={disabled}
        className={cn(fieldClass(showError ? error || "invalid" : undefined, warning), inputClassName)}
        aria-invalid={showError ? true : undefined}
        aria-errormessage={showError ? ariaErrorMessage : undefined}
        aria-describedby={ariaDescribedBy}
        onChange={(event) => {
          updateSelectedFile(event.target.files?.[0] ?? null);
        }}
      />

      {selectedFile && previewUrl ? (
        <div
          className="grid gap-3 p-4"
          style={{ border: "1px solid var(--adm-border)", borderRadius: "8px" }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="adm-label">Selected video</p>
            <div className="flex items-center gap-2">
              <p className="text-xs" style={{ color: "var(--adm-muted)" }}>
                {formatFileSize(selectedFile.size)}
              </p>
              <Tooltip content="Clear selected video">
                <button
                  type="button"
                  className="adm-btn-ghost h-8 min-h-8 px-2"
                  aria-label="Clear selected video"
                  disabled={disabled}
                  onClick={clearSelectedFile}
                >
                  <X aria-hidden="true" size={14} strokeWidth={1.8} />
                </button>
              </Tooltip>
            </div>
          </div>
          <video
            className={previewClass}
            src={previewUrl}
            muted
            playsInline
            controls
            preload="metadata"
            style={{ background: "color-mix(in srgb, var(--adm-ink) 3.5%, transparent)" }}
          />
          <p className="break-all text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
            {selectedFile.name}
          </p>
        </div>
      ) : null}

      {removeFieldName ? (
        <input
          type="hidden"
          name={removeFieldName}
          value={removeCurrentVideo ? "1" : "0"}
        />
      ) : null}

      {/* Hide Current while a replacement is selected — after save, Selected clears and Current shows the new URL. */}
      {currentVideoUrl && !selectedFile ? (
        <div
          className="grid gap-3 p-4"
          style={{
            border: removeCurrentVideo
              ? "1px solid rgba(216, 182, 106, 0.34)"
              : currentBroken
                ? "1px solid rgba(255, 93, 93, 0.42)"
                : "1px solid var(--adm-border)",
            borderRadius: "8px",
            opacity: removeCurrentVideo ? 0.72 : 1,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="adm-label">{currentVideoLabel}</p>
            <div className="flex items-center gap-2">
              {currentBroken ? (
                <span
                  className="text-[0.62rem] font-bold uppercase tracking-[0.08em]"
                  style={{ color: "var(--adm-danger)" }}
                >
                  Broken
                </span>
              ) : null}
              {removeFieldName ? (
                <button
                  type="button"
                  className={removeCurrentVideo ? "adm-btn-primary h-8 min-h-8 px-3" : "adm-btn-ghost h-8 min-h-8 px-3"}
                  disabled={disabled}
                  onClick={toggleRemoveCurrentVideo}
                >
                  {removeCurrentVideo ? "Undo remove" : removeLabel}
                </button>
              ) : null}
            </div>
          </div>
          {removeCurrentVideo ? (
            <div
              className={[
                previewClass,
                "grid place-items-center p-4 text-center text-xs font-bold uppercase tracking-[0.08em]",
              ].join(" ")}
              style={{
                background: "rgba(216, 182, 106, 0.08)",
                color: "var(--adm-accent)",
              }}
            >
              Current video will be removed after save
            </div>
          ) : currentBroken ? (
            <div
              className={[
                previewClass,
                "grid place-items-center p-4 text-center text-xs font-bold uppercase tracking-[0.08em]",
              ].join(" ")}
              style={{
                background: "rgba(255, 93, 93, 0.08)",
                color: "var(--adm-danger)",
              }}
            >
              Video failed to load
            </div>
          ) : (
            <video
              className={previewClass}
              src={currentVideoUrl}
              muted
              playsInline
              preload="metadata"
              controls
              style={{
                background: "color-mix(in srgb, var(--adm-ink) 3.5%, transparent)",
                opacity: 0.92,
              }}
              onError={() => setBrokenCurrentUrl(currentVideoUrl)}
            />
          )}
          <p className="break-all text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
            {currentVideoUrl}
          </p>
        </div>
      ) : null}

      {!currentVideoUrl && !selectedFile ? (
        <div
          className="grid aspect-video max-h-56 w-full place-items-center rounded border text-xs uppercase tracking-[0.12em]"
          style={{ borderColor: "var(--adm-border)", color: "var(--adm-muted)" }}
        >
          {emptyLabel}
        </div>
      ) : null}
    </div>
  );
}

export type AdminVideoFieldProps = Omit<AdminVideoControlProps, "controlId"> & {
  id?: string;
  label?: ReactNode;
  owner?: AdminFieldOwner;
  help?: ReactNode;
  className?: string;
  unitId?: string;
  issue?: ReactNode;
};

/**
 * Labeled site-video upload control (MP4 / WebM) with current + selected preview.
 */
export function AdminVideoField({
  id,
  label,
  owner,
  help,
  required = false,
  error,
  warning,
  invalid,
  disabled,
  className,
  unitId,
  issue,
  ...controlProps
}: AdminVideoFieldProps) {
  const { controlId, messageId, warningId } = useAdminFieldIds(id);

  return (
    <AdminFieldShell
      id={unitId}
      component="AdminVideoField"
      label={label}
      owner={owner}
      help={help}
      required={required}
      error={error}
      errorId={messageId}
      warning={warning}
      warningId={warningId}
      issue={issue}
      disabled={disabled}
      className={cn("adm-video-field", className)}
      controlId={controlId}
    >
      <AdminVideoControl
        {...controlProps}
        controlId={controlId}
        required={required}
        disabled={disabled}
        error={error}
        warning={warning}
        invalid={invalid}
        aria-errormessage={error ? messageId : undefined}
      />
    </AdminFieldShell>
  );
}
