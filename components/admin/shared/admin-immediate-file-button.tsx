"use client";

import { useRef } from "react";

import { AdminButton } from "@/components/synarava-cms";

/** Detached file picker (no name) so it never joins / dirties a parent Save form. */
export function AdminImmediateFileButton({
  accept,
  disabled,
  label,
  onFile,
}: {
  accept: string;
  disabled?: boolean;
  label: string;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <span data-component="AdminImmediateFileButton" className="inline-flex">
      <AdminButton
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </AdminButton>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </span>
  );
}
