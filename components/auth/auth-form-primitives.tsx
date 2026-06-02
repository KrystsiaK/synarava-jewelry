import type {
  FormHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/ui";

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
