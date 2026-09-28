"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

type ImageFileFieldProps = {
  name: string;
  accept?: string;
  className?: string;
  required?: boolean;
  currentImageUrl?: string | null;
  currentImageAlt?: string;
  currentImageLabel?: string;
  fieldId?: string;
  previewAspect?: "square" | "video";
  removeFieldName?: string;
  removeLabel?: string;
  onFileChange?: (file: File | null) => void;
  onRemoveChange?: (removing: boolean) => void;
  "aria-invalid"?: boolean;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

export function ImageFileField({
  name,
  accept = "image/*",
  className = "adm-field",
  required = false,
  currentImageUrl,
  currentImageAlt = "Current image",
  currentImageLabel = "Current image",
  fieldId,
  previewAspect = "square",
  removeFieldName,
  removeLabel = "Remove current image",
  onFileChange,
  onRemoveChange,
  "aria-invalid": ariaInvalid,
}: ImageFileFieldProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [brokenCurrentImageUrl, setBrokenCurrentImageUrl] = useState("");
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef("");

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;

    // A resolved form action resets uncontrolled file inputs. Drop the preview
    // with them so the card cannot show a file the next save will not send.
    function handleReset() {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = "";
      }
      setSelectedFile(null);
      setPreviewUrl("");
      setRemoveCurrentImage(false);
    }

    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, []);

  function updateSelectedFile(file: File | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }

    setSelectedFile(file);
    if (file) {
      setRemoveCurrentImage(false);
    }

    if (!file || !file.type.startsWith("image/")) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
  }

  function clearSelectedFile() {
    updateSelectedFile(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onFileChange?.(null);
  }

  function toggleRemoveCurrentImage() {
    setRemoveCurrentImage((current) => {
      const next = !current;
      onRemoveChange?.(next);
      return next;
    });
    clearSelectedFile();
  }

  const previewClass =
    previewAspect === "video"
      ? "aspect-video w-full object-contain"
      : "aspect-square w-full object-contain";
  const currentImageBroken = Boolean(currentImageUrl && brokenCurrentImageUrl === currentImageUrl);

  return (
    <div data-component="ImageFileField" className="grid gap-3">
      <input
        ref={inputRef}
        name={name}
        type="file"
        accept={accept}
        required={required}
        className={className}
        aria-invalid={ariaInvalid}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          updateSelectedFile(file);
          onFileChange?.(file);
        }}
      />

      {selectedFile && previewUrl ? (
        <div
          className="grid gap-3 p-3"
          style={{ border: "1px solid var(--adm-border)", borderRadius: "8px" }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="adm-label">Selected image</p>
            <div className="flex items-center gap-2">
              <p className="text-xs" style={{ color: "var(--adm-muted)" }}>
                {formatFileSize(selectedFile.size)}
              </p>
              <Tooltip content="Clear selected image">
                <button
                  type="button"
                  className="adm-btn-ghost adm-icon-btn"
                  aria-label="Clear selected image"
                  onClick={clearSelectedFile}
                >
                  <X aria-hidden="true" size={14} strokeWidth={1.8} />
                </button>
              </Tooltip>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={selectedFile.name}
            className={previewClass}
            style={{ background: "color-mix(in srgb, var(--adm-ink) 3.5%, transparent)", opacity: 0.92 }}
          />
          <p
            className="break-all text-xs leading-5"
            style={{ color: "var(--adm-muted)" }}
          >
            {selectedFile.name}
          </p>
        </div>
      ) : null}

      {removeFieldName ? (
        <input
          type="hidden"
          name={removeFieldName}
          value={removeCurrentImage ? "1" : "0"}
        />
      ) : null}

      {/* Hide Current while a replacement is selected — after save, Selected clears and Current shows the new URL. */}
      {currentImageUrl && !selectedFile ? (
        <div
          id={fieldId}
          className="grid gap-3 p-3"
          style={{
            border: removeCurrentImage
              ? "1px solid rgba(216, 182, 106, 0.34)"
              : currentImageBroken
              ? "1px solid rgba(255, 93, 93, 0.42)"
              : "1px solid var(--adm-border)",
            borderRadius: "8px",
            opacity: removeCurrentImage ? 0.72 : 1,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="adm-label">{currentImageLabel}</p>
            <div className="flex items-center gap-2">
              {currentImageBroken ? (
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--adm-danger)" }}
                >
                  Broken
                </span>
              ) : null}
              {removeFieldName ? (
                <button
                  type="button"
                  className={removeCurrentImage ? "adm-btn-primary h-8 min-h-8 px-3" : "adm-btn-ghost h-8 min-h-8 px-3"}
                  onClick={toggleRemoveCurrentImage}
                >
                  {removeCurrentImage ? "Undo remove" : removeLabel}
                </button>
              ) : null}
            </div>
          </div>
          {removeCurrentImage ? (
            <div
              className={[
                previewClass,
                "grid place-items-center rounded-[8px] p-4 text-center text-xs font-medium",
              ].join(" ")}
              style={{
                background: "rgba(216, 182, 106, 0.08)",
                color: "var(--adm-accent)",
              }}
            >
              Current image will be removed after save
            </div>
          ) : currentImageBroken ? (
            <div
              className={[
                previewClass,
                "grid place-items-center rounded-[8px] p-4 text-center text-xs font-medium",
              ].join(" ")}
              style={{
                background: "rgba(255, 93, 93, 0.08)",
                color: "var(--adm-danger)",
              }}
            >
              Image failed to load
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={(node) => {
                if (
                  node &&
                  currentImageUrl &&
                  node.complete &&
                  node.naturalWidth === 0 &&
                  brokenCurrentImageUrl !== currentImageUrl
                ) {
                  setBrokenCurrentImageUrl(currentImageUrl);
                }
              }}
              src={currentImageUrl}
              alt={currentImageAlt}
              className={previewClass}
              style={{
                background: "color-mix(in srgb, var(--adm-ink) 3.5%, transparent)",
                opacity: 0.7,
              }}
              onLoad={(event) => {
                if (event.currentTarget.naturalWidth === 0) {
                  setBrokenCurrentImageUrl(currentImageUrl);
                }
              }}
              onError={() => setBrokenCurrentImageUrl(currentImageUrl)}
            />
          )}
          <p
            className="break-all text-xs leading-5"
            style={{ color: "var(--adm-muted)" }}
          >
            {currentImageUrl}
          </p>
        </div>
      ) : null}
    </div>
  );
}
