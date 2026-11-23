import type { LocalizedCopy } from "@/lib/marketing/ideas/localized";

export type CalendarIdeaInput = {
  id: string;
  status: string;
  productIds: string[];
  script: string;
  shotList: string[];
  hook: LocalizedCopy;
  caption: LocalizedCopy;
  whyRu: string;
  plannedFor: string | null;
};

export type CalendarEntry = {
  id: string;
  plannedFor: string;
  dateLabel: string;
  productName: string;
  location: string;
  shotList: string[];
  chipLabel: string;
  hookEn: string;
};

export type CalendarWeek = {
  weekKey: string;
  weekStart: string;
  ideas: CalendarEntry[];
};

export type MonthCell = {
  dateKey: string;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  entries: CalendarEntry[];
};

export type MonthGrid = {
  year: number;
  /** 0–11 */
  month: number;
  label: string;
  weekdayLabels: string[];
  cells: MonthCell[];
};

export type AgendaDay = {
  dateKey: string;
  label: string;
  entries: CalendarEntry[];
};

/** First non-empty script line — used as location / setting preview. */
export function locationFromScript(script: string): string {
  const line = script
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find(Boolean);
  return line ?? "";
}

function utcNoonFromParts(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

function utcDay(iso: string): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return utcNoonFromParts(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function weekStartUtc(day: Date): Date {
  const start = new Date(day.getTime());
  const dow = start.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() - dow + 1);
  start.setUTCHours(12, 0, 0, 0);
  return start;
}

function formatDateLabel(day: Date): string {
  return day.toISOString().slice(0, 10);
}

function todayKey(now = new Date()): string {
  return formatDateLabel(
    utcNoonFromParts(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function productLabel(
  productIds: string[],
  productNameById: ReadonlyMap<string, string>,
): string {
  if (productIds.length === 0) return "—";
  const names = productIds.map((id) => productNameById.get(id) ?? id);
  return names.join(", ");
}

function toEntry(
  idea: CalendarIdeaInput,
  productNameById: ReadonlyMap<string, string>,
  day: Date,
): CalendarEntry {
  const productName = productLabel(idea.productIds, productNameById);
  const location = locationFromScript(idea.script);
  return {
    id: idea.id,
    plannedFor: idea.plannedFor!,
    dateLabel: formatDateLabel(day),
    productName,
    location,
    shotList: idea.shotList,
    chipLabel: `${productName} · ${location || "—"}`,
    hookEn: idea.hook.en || idea.hook.pt,
  };
}

/** Approved + scheduled ideas as CalendarEntry list. */
export function approvedCalendarEntries(
  ideas: readonly CalendarIdeaInput[],
  productNameById: ReadonlyMap<string, string> = new Map(),
): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  for (const idea of ideas) {
    if (idea.status !== "approved") continue;
    if (!idea.plannedFor) continue;
    const day = utcDay(idea.plannedFor);
    if (!day) continue;
    entries.push(toEntry(idea, productNameById, day));
  }
  return entries.sort((a, b) => a.dateLabel.localeCompare(b.dateLabel));
}

/**
 * Derive calendar weeks from ideas state (approved + plannedFor only).
 * Kept for tests / agenda grouping helpers.
 */
export function buildIdeasCalendar(
  ideas: readonly CalendarIdeaInput[],
  productNameById: ReadonlyMap<string, string> = new Map(),
): CalendarWeek[] {
  const groups = new Map<string, CalendarWeek>();
  for (const entry of approvedCalendarEntries(ideas, productNameById)) {
    const day = utcDay(entry.plannedFor);
    if (!day) continue;
    const start = weekStartUtc(day);
    const weekKey = start.toISOString().slice(0, 10);
    const existing = groups.get(weekKey);
    if (existing) {
      existing.ideas.push(entry);
    } else {
      groups.set(weekKey, {
        weekKey,
        weekStart: start.toISOString(),
        ideas: [entry],
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.weekKey.localeCompare(b.weekKey));
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month + delta, 1, 12, 0, 0));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

/**
 * Month grid Mon–Sun (42 cells). Entries max not truncated here —
 * UI shows max 3 + "+N".
 */
export function buildMonthGrid(input: {
  year: number;
  month: number;
  ideas: readonly CalendarIdeaInput[];
  productNameById?: ReadonlyMap<string, string>;
  now?: Date;
  locale?: string;
}): MonthGrid {
  const productNameById = input.productNameById ?? new Map();
  const now = input.now ?? new Date();
  const locale = input.locale ?? "ru-RU";
  const today = todayKey(now);

  const byDay = new Map<string, CalendarEntry[]>();
  for (const entry of approvedCalendarEntries(input.ideas, productNameById)) {
    const list = byDay.get(entry.dateLabel) ?? [];
    list.push(entry);
    byDay.set(entry.dateLabel, list);
  }

  const first = utcNoonFromParts(input.year, input.month, 1);
  const firstDow = first.getUTCDay() || 7; // Mon=1 … Sun=7
  const gridStart = new Date(first.getTime());
  gridStart.setUTCDate(gridStart.getUTCDate() - (firstDow - 1));

  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(gridStart.getTime());
    day.setUTCDate(gridStart.getUTCDate() + i);
    const dateKey = formatDateLabel(day);
    cells.push({
      dateKey,
      inMonth: day.getUTCMonth() === input.month,
      isToday: dateKey === today,
      isPast: dateKey < today,
      entries: byDay.get(dateKey) ?? [],
    });
  }

  const weekdayLabels = Array.from({ length: 7 }, (_, i) => {
    // 2024-01-01 is Monday
    const d = new Date(Date.UTC(2024, 0, 1 + i, 12, 0, 0));
    return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
      d,
    );
  });

  const label = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(first);

  return {
    year: input.year,
    month: input.month,
    label,
    weekdayLabels,
    cells,
  };
}

/** Mobile agenda: days in the visible month that have entries (or all approved in range). */
export function buildMonthAgenda(input: {
  year: number;
  month: number;
  ideas: readonly CalendarIdeaInput[];
  productNameById?: ReadonlyMap<string, string>;
  locale?: string;
}): AgendaDay[] {
  const productNameById = input.productNameById ?? new Map();
  const locale = input.locale ?? "ru-RU";
  const prefix = `${input.year}-${String(input.month + 1).padStart(2, "0")}`;
  const byDay = new Map<string, CalendarEntry[]>();
  for (const entry of approvedCalendarEntries(input.ideas, productNameById)) {
    if (!entry.dateLabel.startsWith(prefix)) continue;
    const list = byDay.get(entry.dateLabel) ?? [];
    list.push(entry);
    byDay.set(entry.dateLabel, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, entries]) => {
      const day = utcDay(`${dateKey}T12:00:00.000Z`)!;
      return {
        dateKey,
        label: new Intl.DateTimeFormat(locale, {
          weekday: "short",
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }).format(day),
        entries,
      };
    });
}

/** Visible chips in a day cell: first 3 + overflow count. */
export function visibleDayChips(entries: readonly CalendarEntry[], max = 3): {
  chips: CalendarEntry[];
  overflow: number;
} {
  if (entries.length <= max) return { chips: [...entries], overflow: 0 };
  return {
    chips: entries.slice(0, max),
    overflow: entries.length - max,
  };
}
