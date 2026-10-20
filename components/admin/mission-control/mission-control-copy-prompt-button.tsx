"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type MissionControlCopyPromptButtonProps = {
  prompt: string;
  widgetKey: string;
};

/**
 * Read-only clipboard copy for a static fixPrompt. Never acts on a service.
 */
export function MissionControlCopyPromptButton({
  prompt,
  widgetKey,
}: MissionControlCopyPromptButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt);
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
      data-testid={`mc-copy-prompt-${widgetKey}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void handleCopy();
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span>{copied ? "Copied" : "Copy prompt"}</span>
    </button>
  );
}
