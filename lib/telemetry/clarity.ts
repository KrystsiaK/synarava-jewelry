import { hasAnalyticsConsent } from "@/lib/privacy/consent";

type ClarityFn = (command: string, ...args: Array<string | string[]>) => void;

type ClarityWindow = Window & {
  clarity?: ClarityFn;
};

function clarityCall(command: string, ...args: Array<string | string[]>) {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;

  const clarity = (window as ClarityWindow).clarity;
  if (typeof clarity !== "function") return;

  clarity(command, ...args);
}

/** Custom Clarity event. Name only — no ecommerce/PII payload. */
export function clarityEvent(name: string) {
  const eventName = name.trim();
  if (!eventName) return;
  clarityCall("event", eventName);
}

/** Custom Clarity session tag. Non-PII key/value only. */
export function clarityTag(key: string, value: string | string[]) {
  const tagKey = key.trim();
  if (!tagKey) return;
  if (Array.isArray(value)) {
    const values = value.map((entry) => entry.trim()).filter(Boolean);
    if (values.length === 0) return;
    clarityCall("set", tagKey, values);
    return;
  }
  const tagValue = value.trim();
  if (!tagValue) return;
  clarityCall("set", tagKey, tagValue);
}

/** Prioritize the session for Clarity recording. */
export function clarityUpgrade(reason: string) {
  const upgradeReason = reason.trim();
  if (!upgradeReason) return;
  clarityCall("upgrade", upgradeReason);
}
