"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { AdminHelp } from "@/components/admin/shared/admin-help";
import { Tooltip } from "@/components/ui/tooltip";

/** String help is the info mark. A custom node (already an AdminHelp) passes through. */
export function labelHelp(help?: ReactNode) {
  if (help == null || help === false || help === "") return null;
  if (typeof help === "string" || typeof help === "number") return <AdminHelp>{help}</AdminHelp>;
  return help;
}

/**
 * One-line label name. Overflow clips with an ellipsis; the full name is a tooltip.
 * https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow
 */
export function LabelText({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = () => {
      setOverflow(node.scrollWidth > node.clientWidth + 1);
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [children]);

  const text = (
    <span ref={ref} className="adm-label__text">
      {children}
    </span>
  );

  if (!overflow) return text;

  return (
    <Tooltip content={children} side="auto">
      {text}
    </Tooltip>
  );
}

/** Plain field label with optional required mark and help tooltip. */
export function FieldLabel({
  children,
  help,
  required,
}: {
  children: ReactNode;
  help?: ReactNode;
  required?: boolean;
}) {
  return (
    <span data-component="FieldLabel" className="adm-label-row min-h-6">
      <span className="adm-label adm-label__lead">
        <LabelText>{children}</LabelText>
        {required ? <span className="adm-label__required adm-label__required--accent">*</span> : null}
      </span>
      {labelHelp(help)}
    </span>
  );
}
