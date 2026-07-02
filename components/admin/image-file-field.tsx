"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type ImageFileFieldProps = {
  name: string;
  accept?: string;
  className?: string;
  currentImageUrl?: string | null;
  currentImageAlt?: string;
  currentImageLabel?: string;
  fieldId?: string;
  previewAspect?: "square" | "video";
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
  currentImageUrl,
  currentImageAlt = "Current image",
  currentImageLabel = "Current image",
  fieldId,
  previewAspect = "square",
  "aria-invalid": ariaInvalid,
}: ImageFileFieldProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [brokenCurrentImageUrl, setBrokenCurrentImageUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef("");

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  function updateSelectedFile(file: File | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }

    setSelectedFile(file);

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
  }

  const previewClass =
    previewAspect === "video"
      ? "aspect-video w-full object-contain"
      : "aspect-square w-full object-contain";
  const currentImageBroken = Boolean(currentImageUrl && brokenCurrentImageUrl === currentImageUrl);

  return (
    <div className="grid gap-3">
      <input
        ref={inputRef}
        name={name}
        type="file"
        accept={accept}
        className={className}
        aria-invalid={ariaInvalid}
        onChange={(event) => {
          updateSelectedFile(event.target.files?.[0] ?? null);
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
              <button
                type="button"
                className="adm-btn-ghost h-8 min-h-8 px-2"
                aria-label="Clear selected image"
                title="Clear selected image"
                onClick={clearSelectedFile}
              >
                <X aria-hidden="true" size={14} strokeWidth={1.8} />
              </button>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={selectedFile.name}
            className={previewClass}
            style={{ background: "rgba(255,255,255,0.035)", opacity: 0.92 }}
          />
          <p
            className="break-all text-xs leading-5"
            style={{ color: "var(--adm-muted)" }}
          >
            {selectedFile.name}
          </p>
        </div>
      ) : null}

      {currentImageUrl ? (
        <div
          id={fieldId}
          className="grid gap-3 p-3"
          style={{
            border: currentImageBroken
              ? "1px solid rgba(255, 93, 93, 0.42)"
              : "1px solid rgba(255,255,255,0.08)",
            borderRadius: "8px",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="adm-label">{currentImageLabel}</p>
            {currentImageBroken ? (
              <span
                className="text-[0.62rem] font-bold uppercase tracking-[0.08em]"
                style={{ color: "var(--adm-danger)" }}
              >
                Broken
              </span>
            ) : null}
          </div>
          {currentImageBroken ? (
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
                background: "rgba(255,255,255,0.035)",
                opacity: selectedFile ? 0.42 : 0.7,
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
