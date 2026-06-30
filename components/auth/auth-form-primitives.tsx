"use client";

import type {
  FormHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { useState } from "react";
import { Eye, EyeOff, Info, Check } from "lucide-react";

import { cn } from "@/lib/ui";
import { useTranslations } from "@/lib/i18n/context";

export function AuthForm({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action: (payload: FormData) => void | Promise<void>;
  className?: FormHTMLAttributes<HTMLFormElement>["className"];
}) {
  return (
    <form action={action} className={cn("grid gap-5", className)}>
      {children}
    </form>
  );
}

export function AuthField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="label-caps text-muted">{label}</span>
      {children}
    </label>
  );
}

export function AuthInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent",
        props.className,
      )}
    />
  );
}

// ─── Password strength ────────────────────────────────────────────────────────

type PasswordReqs = {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
};

function checkReqs(value: string): PasswordReqs {
  return {
    length: value.length >= 8,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
  };
}

type StrengthLevel = 0 | 1 | 2 | 3 | 4;

function getStrength(value: string): StrengthLevel {
  if (!value) return 0;
  const r = checkReqs(value);
  if (!r.length) return 1;
  const bonus = [r.uppercase, r.lowercase, r.number, r.special, value.length >= 12].filter(Boolean).length;
  if (bonus <= 1) return 1;
  if (bonus === 2) return 2;
  if (bonus === 3) return 3;
  return 4;
}

const STRENGTH_META: Record<1 | 2 | 3 | 4, { labelKey: string; bars: number; color: string }> = {
  1: { labelKey: "password.strength.weak",   bars: 1, color: "bg-couture-red" },
  2: { labelKey: "password.strength.fair",   bars: 2, color: "bg-orange-400"  },
  3: { labelKey: "password.strength.good",   bars: 3, color: "bg-yellow-500"  },
  4: { labelKey: "password.strength.strong", bars: 4, color: "bg-green-500"   },
};

// ─── PasswordInput ─────────────────────────────────────────────────────────────

export function PasswordInput({
  hint,
  showStrength,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  hint?: string;
  showStrength?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const { t } = useTranslations();

  const strength = showStrength ? getStrength(value) : 0;
  const reqs = showStrength && value ? checkReqs(value) : null;
  const meta = strength > 0 ? STRENGTH_META[strength as 1 | 2 | 3 | 4] : null;

  const REQ_ROWS: { key: keyof PasswordReqs; label: string }[] = [
    { key: "length",    label: t("password.req.length")    },
    { key: "uppercase", label: t("password.req.uppercase") },
    { key: "lowercase", label: t("password.req.lowercase") },
    { key: "number",    label: t("password.req.number")    },
    { key: "special",   label: t("password.req.special")   },
  ];

  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <input
          {...props}
          type={visible ? "text" : "password"}
          value={showStrength ? value : props.value}
          onChange={(e) => {
            if (showStrength) setValue(e.target.value);
            props.onChange?.(e);
          }}
          className={cn(
            "w-full border border-stroke bg-transparent px-4 py-3 pr-11 outline-none transition-colors focus:border-accent",
            props.className,
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {/* Strength bar */}
      {showStrength && value && (
        <div className="grid gap-2">
          <div className="flex items-center gap-1.5">
            <div className="flex flex-1 gap-1">
              {[1, 2, 3, 4].map((bar) => (
                <div
                  key={bar}
                  className={cn(
                    "h-0.5 flex-1 transition-all duration-300",
                    meta && bar <= meta.bars ? meta.color : "bg-foreground/12",
                  )}
                />
              ))}
            </div>
            {meta && (
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-foreground/50">
                {t(meta.labelKey)}
              </span>
            )}
          </div>

          {/* Requirements checklist */}
          <ul className="grid gap-1">
            {REQ_ROWS.map(({ key, label }) => {
              const met = reqs ? reqs[key] : false;
              return (
                <li
                  key={key}
                  className={cn(
                    "flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] transition-colors",
                    met ? "text-green-500" : "text-foreground/40",
                  )}
                >
                  <Check size={10} className={cn("shrink-0", met ? "opacity-100" : "opacity-30")} />
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Static hint (only when showStrength is off) */}
      {hint && !showStrength && (
        <p className="flex items-center gap-1.5 text-[0.72rem] leading-5 text-foreground/45">
          <Info size={12} className="shrink-0" />
          {hint}
        </p>
      )}
    </div>
  );
}

export function AuthTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "border border-stroke bg-transparent px-4 py-3 outline-none transition-colors focus:border-accent",
        props.className,
      )}
    />
  );
}

export function AuthMessage({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (!error && !success) {
    return null;
  }

  return (
    <div
      className={cn(
        "border px-4 py-3 text-sm leading-6",
        error
          ? "border-[color:rgba(166,25,46,0.35)] text-[color:#7e1a29]"
          : "border-[color:rgba(25,21,18,0.16)] text-foreground/70",
      )}
    >
      {error ?? success}
    </div>
  );
}
