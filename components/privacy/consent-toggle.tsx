export function ConsentToggle({
  checked,
  disabled,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label data-component="ConsentToggle" className="flex cursor-pointer items-start justify-between gap-5 border-b border-stroke py-5 last:border-0">
      <span>
        <span className="label-caps block text-foreground">{label}</span>
        <span className="mt-1.5 block text-sm leading-6 text-foreground/65">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]"
      />
    </label>
  );
}
