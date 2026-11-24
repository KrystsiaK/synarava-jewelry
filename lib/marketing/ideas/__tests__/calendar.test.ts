import { describe, expect, it } from "vitest";

import {
  buildIdeasCalendar,
  buildMonthAgenda,
  buildMonthGrid,
  locationFromScript,
  shiftMonth,
  visibleDayChips,
  type CalendarIdeaInput,
} from "@/lib/marketing/ideas/calendar";

function idea(
  partial: Partial<CalendarIdeaInput> & Pick<CalendarIdeaInput, "id">,
): CalendarIdeaInput {
  return {
    status: "draft",
    productIds: ["p1"],
    script: "Локация: кафе у окна\nКрупный план",
    shotList: ["руки", "деталь"],
    hook: { en: "Soft stack", pt: "Stack suave" },
    caption: { en: "c", pt: "c" },
    whyRu: "Потому что бусины",
    plannedFor: "2026-12-01T12:00:00.000Z",
    ...partial,
  };
}

describe("buildIdeasCalendar / approve chip lifecycle", () => {
  it("approve → appears without a separate calendar source", () => {
    const draft = idea({ id: "a", status: "draft" });
    expect(buildIdeasCalendar([draft])).toEqual([]);

    const approved = idea({ id: "a", status: "approved" });
    const weeks = buildIdeasCalendar(
      [approved],
      new Map([["p1", "Beaded Bracelet"]]),
    );
    expect(weeks).toHaveLength(1);
    expect(weeks[0]!.ideas[0]).toMatchObject({
      id: "a",
      productName: "Beaded Bracelet",
      location: "Локация: кафе у окна",
      chipLabel: "Beaded Bracelet · Локация: кафе у окна",
      dateLabel: "2026-12-01",
    });
  });

  it("change plannedFor → moves week", () => {
    const early = idea({
      id: "a",
      status: "approved",
      plannedFor: "2026-12-01T12:00:00.000Z",
    });
    const later = idea({
      id: "a",
      status: "approved",
      plannedFor: "2026-12-15T12:00:00.000Z",
    });
    expect(buildIdeasCalendar([early])[0]!.weekKey).not.toBe(
      buildIdeasCalendar([later])[0]!.weekKey,
    );
  });

  it("reject an approved idea → disappears", () => {
    expect(buildIdeasCalendar([idea({ id: "a", status: "approved" })])).toHaveLength(
      1,
    );
    expect(buildIdeasCalendar([idea({ id: "a", status: "rejected" })])).toEqual([]);
  });
});

describe("month grid", () => {
  it("navigates months and highlights today", () => {
    const now = new Date("2026-12-10T15:00:00.000Z");
    const grid = buildMonthGrid({
      year: 2026,
      month: 11,
      now,
      ideas: [idea({ id: "a", status: "approved" })],
      productNameById: new Map([["p1", "Beaded Bracelet"]]),
    });
    expect(grid.cells).toHaveLength(42);
    expect(grid.weekdayLabels).toHaveLength(7);
    expect(grid.cells.find((c) => c.isToday)?.dateKey).toBe("2026-12-10");
    const chipDay = grid.cells.find((c) => c.dateKey === "2026-12-01");
    expect(chipDay?.entries).toHaveLength(1);
    expect(chipDay?.isPast).toBe(true);

    const next = shiftMonth(2026, 11, 1);
    expect(next).toEqual({ year: 2027, month: 0 });
  });

  it("caps visible chips at 3 + overflow", () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      plannedFor: "2026-12-01T12:00:00.000Z",
      dateLabel: "2026-12-01",
      productName: `P${i}`,
      location: "x",
      shotList: [],
      chipLabel: `P${i} · x`,
      hookEn: "h",
    }));
    expect(visibleDayChips(entries)).toEqual({
      chips: entries.slice(0, 3),
      overflow: 2,
    });
  });

  it("mobile agenda groups by day in month", () => {
    const agenda = buildMonthAgenda({
      year: 2026,
      month: 11,
      ideas: [
        idea({ id: "a", status: "approved", plannedFor: "2026-12-01T12:00:00.000Z" }),
        idea({ id: "b", status: "approved", plannedFor: "2026-11-30T12:00:00.000Z" }),
      ],
      productNameById: new Map([["p1", "Beaded Bracelet"]]),
    });
    expect(agenda.map((d) => d.dateKey)).toEqual(["2026-12-01"]);
  });
});

describe("locationFromScript", () => {
  it("uses first non-empty line", () => {
    expect(locationFromScript("\n  Локация: парк\nКадр")).toBe("Локация: парк");
  });
});
