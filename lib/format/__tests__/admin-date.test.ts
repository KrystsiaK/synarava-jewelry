import { describe, expect, it } from "vitest";

import {
  ADMIN_DATE_LOCALE,
  ADMIN_DATE_TIME_ZONE,
  formatAdminDate,
  formatAdminDateTime,
} from "@/lib/format/admin-date";

describe("formatAdminDateTime / formatAdminDate", () => {
  it("uses fixed locale and time zone", () => {
    expect(ADMIN_DATE_LOCALE).toBe("en-IE");
    expect(ADMIN_DATE_TIME_ZONE).toBe("UTC");
  });

  it("formats datetime as day mon year, HH:MM (no seconds)", () => {
    // 2026-09-30T23:11:45.000Z → 30 Sept 2026, 23:11
    expect(formatAdminDateTime("2026-09-30T23:11:45.000Z")).toBe("30 Sept 2026, 23:11");
    expect(formatAdminDateTime(new Date("2026-10-25T10:04:06.000Z"))).toBe("25 Oct 2026, 10:04");
  });

  it("formats date-only without time", () => {
    expect(formatAdminDate("2026-09-30T23:11:45.000Z")).toBe("30 Sept 2026");
    expect(formatAdminDate("2026-01-05T12:00:00.000Z")).toBe("5 Jan 2026");
  });

  it("formats midnight UTC", () => {
    expect(formatAdminDateTime("2026-03-01T00:00:00.000Z")).toBe("1 Mar 2026, 00:00");
    expect(formatAdminDate("2026-03-01T00:00:00.000Z")).toBe("1 Mar 2026");
  });

  it("keeps the same calendar day across a DST spring-forward edge in Europe", () => {
    // EU DST spring-forward 2026-03-29 01:00 UTC → 02:00 local; we stay on UTC.
    expect(formatAdminDateTime("2026-03-29T00:30:00.000Z")).toBe("29 Mar 2026, 00:30");
    expect(formatAdminDateTime("2026-03-29T01:30:00.000Z")).toBe("29 Mar 2026, 01:30");
  });

  it("keeps the same calendar day across a DST fall-back edge in Europe", () => {
    // EU DST fall-back 2026-10-25 01:00 UTC; we stay on UTC.
    expect(formatAdminDateTime("2026-10-25T00:30:00.000Z")).toBe("25 Oct 2026, 00:30");
    expect(formatAdminDateTime("2026-10-25T01:30:00.000Z")).toBe("25 Oct 2026, 01:30");
  });

  it("accepts epoch millis", () => {
    expect(formatAdminDateTime(Date.UTC(2026, 8, 30, 23, 11, 0))).toBe("30 Sept 2026, 23:11");
  });
});
