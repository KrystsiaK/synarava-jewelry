import type { SVGProps } from "react";

type PatternProps = SVGProps<SVGSVGElement>;

export function KodRoda({ className, ...props }: PatternProps) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" aria-hidden="true" {...props}>
      <path d="M100 12 188 100 100 188 12 100 100 12Z" stroke="currentColor" strokeWidth="4" />
      <path d="M100 42 158 100 100 158 42 100 100 42Z" stroke="currentColor" strokeWidth="3" />
      <path d="M100 70 130 100 100 130 70 100 100 70Z" stroke="currentColor" strokeWidth="3" />
      <path d="M100 12v176M12 100h176M38 38l124 124M162 38 38 162" stroke="currentColor" strokeWidth="2" opacity="0.55" />
      <circle cx="100" cy="100" r="8" fill="currentColor" />
    </svg>
  );
}

export function Kola({ className, ...props }: PatternProps) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" aria-hidden="true" {...props}>
      <circle cx="100" cy="100" r="78" stroke="currentColor" strokeWidth="4" />
      <circle cx="100" cy="100" r="42" stroke="currentColor" strokeWidth="3" />
      {Array.from({ length: 8 }).map((_, index) => (
        <path
          key={index}
          d="M100 22v36"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="4"
          transform={`rotate(${index * 45} 100 100)`}
        />
      ))}
      <circle cx="100" cy="100" r="10" fill="currentColor" />
    </svg>
  );
}

export function Ziamla({ className, ...props }: PatternProps) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" aria-hidden="true" {...props}>
      <rect x="30" y="30" width="140" height="140" stroke="currentColor" strokeWidth="4" />
      <rect x="58" y="58" width="84" height="84" stroke="currentColor" strokeWidth="3" />
      <rect x="82" y="82" width="36" height="36" stroke="currentColor" strokeWidth="3" />
      <path d="M30 100h140M100 30v140M30 30l140 140M170 30 30 170" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <path d="M58 30v28H30M142 30v28h28M58 170v-28H30M142 170v-28h28" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

export const KodRodaStatic = KodRoda;
export const KolaStatic = Kola;
export const ZiamlaStatic = Ziamla;

export function FolkBorder({ className, ...props }: PatternProps) {
  return (
    <svg className={className} viewBox="0 0 960 32" fill="none" preserveAspectRatio="none" aria-hidden="true" {...props}>
      <path d="M0 16h960" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      {Array.from({ length: 24 }).map((_, index) => {
        const x = 20 + index * 40;
        return (
          <path
            key={index}
            d={`M${x} 16l10-10 10 10-10 10-10-10Z`}
            stroke="currentColor"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

export function FolkSpiderOrnament({ className, ...props }: PatternProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 72"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path d="M60 4v64M16 36h88M28 12l64 48M92 12 28 60" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      <path d="M60 12 84 36 60 60 36 36 60 12Z" stroke="currentColor" strokeWidth="2" />
      <path d="M60 24 72 36 60 48 48 36 60 24Z" fill="currentColor" />
      <circle cx="16" cy="36" r="3" fill="currentColor" />
      <circle cx="104" cy="36" r="3" fill="currentColor" />
      <circle cx="60" cy="4" r="3" fill="currentColor" />
      <circle cx="60" cy="68" r="3" fill="currentColor" />
    </svg>
  );
}
