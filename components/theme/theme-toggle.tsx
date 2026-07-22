"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme/theme-provider";
import { type ThemePreference } from "@/lib/theme/shared";

const options: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

type ThemeToggleProps = {
  compact?: boolean;
};

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { preference, resolvedTheme, setPreference } = useTheme();

  return (
    <div
      className={`inline-flex items-center bg-background/80 backdrop-blur ${
        compact ? "gap-1 p-1" : "gap-1 p-1.5"
      }`}
      aria-label="Theme switcher"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = preference === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setPreference(option.value)}
            aria-pressed={active}
            aria-label={option.label}
            className={`inline-flex items-center gap-2 px-2.5 py-2 transition-all ${
              active
                ? "bg-foreground text-background"
                : "text-muted hover:bg-foreground/5 hover:text-foreground"
            } ${compact ? "justify-center" : ""}`}
            title={
              option.value === "system" ? `System (${resolvedTheme})` : option.label
            }
          >
            <Icon className="size-4" />
            {!compact ? <span className="label-caps">{option.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
