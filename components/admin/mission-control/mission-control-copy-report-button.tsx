"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type Props = {
  report: string;
  widgetKey: string;
};

/**
 * Read-only clipboard copy for the Analytics markdown report.
 * Never mutates services or secrets.
 */
export function MissionControlCopyReportButton({ report, widgetKey }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className="mc-copy-prompt"
      data-testid={`mc-copy-report-${widgetKey}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void handleCopy();
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span>{copied ? "Copied" : "Copy report"}</span>
    </button>
  );
}
