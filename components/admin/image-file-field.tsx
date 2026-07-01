"use client";

import { useEffect, useRef, useState } from "react";

type ImageFileFieldProps = {
  name: string;
  accept?: string;
  className?: string;
  currentImageUrl?: string | null;
  currentImageAlt?: string;
  currentImageLabel?: string;
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
  previewAspect = "square",
  "aria-invalid": ariaInvalid,
}: ImageFileFieldProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
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

  const previewClass =
    previewAspect === "video"
      ? "aspect-video w-full object-cover"
      : "aspect-square w-full object-cover";

  return (
    <div className="grid gap-3">
      <input
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
            <p className="text-xs" style={{ color: "var(--adm-muted)" }}>
              {formatFileSize(selectedFile.size)}
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={selectedFile.name}
            className={previewClass}
            style={{ opacity: 0.92 }}
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
          className="grid gap-3 p-3"
          style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px" }}
        >
          <p className="adm-label">{currentImageLabel}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImageUrl}
            alt={currentImageAlt}
            className={previewClass}
            style={{ opacity: selectedFile ? 0.42 : 0.7 }}
          />
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
