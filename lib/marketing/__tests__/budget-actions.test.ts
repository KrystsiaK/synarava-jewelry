import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditLogFindMany: vi.fn(),
  auditLogCreate: vi.fn(),
  contentIdeaFindUnique: vi.fn(),
  contentIdeaUpdate: vi.fn(),
  contentIdeaFindMany: vi.fn(),
  requireAdminSession: vi.fn(),
  getCurrentAdminSession: vi.fn(),
  checkRateLimit: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      findMany: mocks.auditLogFindMany,
      create: mocks.auditLogCreate,
    },
    contentIdea: {
      findUnique: mocks.contentIdeaFindUnique,
      update: mocks.contentIdeaUpdate,
      findMany: mocks.contentIdeaFindMany,
    },
  },
}));

vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession: mocks.requireAdminSession,
  getCurrentAdminSession: mocks.getCurrentAdminSession,
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import {
  AI_AUDIT_ACTION,
  AI_MARKETING_IDEAS_AUDIT_ACTION,
} from "@/lib/ai/config";
import { sumMonthlyAiSpendUsd } from "@/lib/ai/product-content/budget";
import {
  approveContentIdeaAction,
  rejectContentIdeaAction,
  updateContentIdeaAction,
} from "@/app/admin/actions/marketing";
import { listApprovedIdeasCalendar } from "@/lib/marketing/queries";

describe("AI budget includes marketing ideas action", () => {
  beforeEach(() => {
    mocks.auditLogFindMany.mockReset();
  });

  it("sumMonthlyAiSpendUsd queries both product and marketing audit actions", async () => {
    mocks.auditLogFindMany.mockResolvedValue([
      { metadata: { costUsd: 1 } },
      { metadata: { costUsd: 0.5 } },
    ]);
    await expect(sumMonthlyAiSpendUsd(new Date("2026-11-15T00:00:00Z"))).resolves.toBe(1.5);
    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: { in: [AI_AUDIT_ACTION, AI_MARKETING_IDEAS_AUDIT_ACTION] },
        }),
      }),
    );
  });
});

describe("content idea edit/approve/reject", () => {
  const baseIdea = {
    id: "idea1",
    status: "draft",
    locale: "en",
    productIds: ["p1"],
    signalIds: [],
    hook: "old hook",
    script: "old script",
    shotList: ["a"],
    caption: "old caption",
    plannedFor: new Date("2026-11-30T12:00:00.000Z"),
  };

  beforeEach(() => {
    mocks.requireAdminSession.mockResolvedValue({
      username: "admin",
      sessionId: "sess",
    });
    mocks.getCurrentAdminSession.mockResolvedValue({
      username: "admin",
      sessionId: "sess",
    });
    mocks.auditLogCreate.mockResolvedValue({});
    mocks.contentIdeaFindUnique.mockResolvedValue(baseIdea);
    mocks.contentIdeaUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...baseIdea,
      ...data,
    }));
  });

  it("edit updates ContentIdea and writes exactly one AuditLog event", async () => {
    const result = await updateContentIdeaAction({
      id: "idea1",
      hook: "new hook",
    });
    expect(result.ok).toBe(true);
    expect(mocks.contentIdeaUpdate).toHaveBeenCalledOnce();
    expect(mocks.auditLogCreate).toHaveBeenCalledOnce();
    expect(mocks.auditLogCreate.mock.calls[0]![0].data.action).toBe("marketing.idea.edit");
  });

  it("approve updates ContentIdea and writes exactly one AuditLog event", async () => {
    mocks.auditLogCreate.mockClear();
    const result = await approveContentIdeaAction("idea1");
    expect(result.ok).toBe(true);
    expect(mocks.contentIdeaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "approved" } }),
    );
    expect(mocks.auditLogCreate).toHaveBeenCalledOnce();
    expect(mocks.auditLogCreate.mock.calls[0]![0].data.action).toBe(
      "marketing.idea.approve",
    );
  });

  it("reject updates ContentIdea and writes exactly one AuditLog event", async () => {
    mocks.auditLogCreate.mockClear();
    const result = await rejectContentIdeaAction("idea1");
    expect(result.ok).toBe(true);
    expect(mocks.contentIdeaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "rejected" } }),
    );
    expect(mocks.auditLogCreate).toHaveBeenCalledOnce();
    expect(mocks.auditLogCreate.mock.calls[0]![0].data.action).toBe(
      "marketing.idea.reject",
    );
  });

  it("returns unauthorized without admin session", async () => {
    mocks.requireAdminSession.mockRejectedValue(new Error("no session"));
    await expect(approveContentIdeaAction("idea1")).resolves.toMatchObject({
      ok: false,
      code: "unauthorized",
    });
  });
});

describe("calendar", () => {
  it("returns only approved ideas", async () => {
    mocks.contentIdeaFindMany.mockResolvedValue([
      {
        id: "a",
        status: "approved",
        locale: "en",
        productIds: [],
        signalIds: [],
        hook: "h",
        script: "s",
        shotList: [],
        caption: "c",
        plannedFor: new Date("2026-12-01T12:00:00.000Z"),
      },
    ]);
    const weeks = await listApprovedIdeasCalendar();
    expect(mocks.contentIdeaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "approved", plannedFor: { not: null } },
      }),
    );
    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.ideas[0]?.id).toBe("a");
  });
});
