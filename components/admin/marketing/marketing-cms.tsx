"use client";

import { useMemo, useState, useTransition } from "react";

import {
  approveContentIdeaAction,
  generateMarketingIdeasAction,
  rejectContentIdeaAction,
  scanCompetitorsAction,
  updateContentIdeaAction,
} from "@/app/admin/actions/marketing";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  AdminAlert,
  AdminButton,
  AdminLongTextField,
  AdminPanel,
  AdminSectionTabs,
  AdminTextField,
} from "@/components/synarava-cms";

export type MarketingObservationRow = {
  id: string;
  brand: string;
  domain: string;
  url: string;
  fetchedAt: string;
  kind: string;
  price: string | null;
  currency: string | null;
  source: string;
};

export type MarketingIdeaRow = {
  id: string;
  status: string;
  locale: string;
  productIds: string[];
  signalIds: string[];
  hook: string;
  script: string;
  shotList: string[];
  caption: string;
  plannedFor: string | null;
};

export type MarketingCalendarWeek = {
  weekKey: string;
  weekStart: string;
  ideas: MarketingIdeaRow[];
};

export type MarketingProductOption = { id: string; name: string };

type TabId = "observations" | "ideas" | "calendar";

const TABS = [
  { id: "observations", label: "Observations" },
  { id: "ideas", label: "Ideas" },
  { id: "calendar", label: "Calendar" },
] as const;

function shotListToText(shots: string[]): string {
  return shots.join("\n");
}

function textToShotList(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function MarketingCms({
  initialObservations,
  initialIdeas,
  initialCalendar,
  products,
  initialKind = "all",
}: {
  initialObservations: MarketingObservationRow[];
  initialIdeas: MarketingIdeaRow[];
  initialCalendar: MarketingCalendarWeek[];
  products: MarketingProductOption[];
  initialKind?: string;
}) {
  const { pushToast } = useAdminToast();
  const [tab, setTab] = useState<TabId>("observations");
  const [kind, setKind] = useState(initialKind);
  const [ideas, setIdeas] = useState(initialIdeas);
  const [observations] = useState(initialObservations);
  const [calendar] = useState(initialCalendar);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredObservations = useMemo(() => {
    if (kind === "all") return observations;
    return observations.filter((o) => o.kind === kind);
  }, [observations, kind]);

  function toggleProduct(id: string) {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 10),
    );
  }

  function runScan() {
    setError(null);
    startTransition(async () => {
      const result = await scanCompetitorsAction();
      if (!result.ok) {
        setError(result.message);
        pushToast({ message: result.message, tone: "error" });
        return;
      }
      pushToast({
        message: `Scan done — ${result.writtenTotal} new rows (${result.durationMs}ms)`,
        tone: "success",
      });
      // Soft refresh: caller revalidates; keep local notice.
      window.location.reload();
    });
  }

  function runGenerate() {
    setError(null);
    if (selectedProducts.length < 1) {
      setError("Select 1–10 products");
      return;
    }
    const manualNotes = notes
      .split("\n---\n")
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const [urlLine, ...rest] = block.split("\n");
        const url = (urlLine ?? "").trim();
        const text = rest.join("\n").trim() || url;
        return { url: url.startsWith("http") ? url : "https://example.com/note", text };
      });

    startTransition(async () => {
      const result = await generateMarketingIdeasAction({
        productIds: selectedProducts,
        manualNotes: manualNotes.length ? manualNotes : undefined,
      });
      if (!result.ok) {
        setError(result.message);
        pushToast({ message: result.message, tone: "error" });
        return;
      }
      const mapped: MarketingIdeaRow[] = result.ideas.map((idea) => ({
        id: idea.id,
        status: "draft",
        locale: idea.locale,
        productIds: idea.productIds,
        signalIds: idea.signalIds,
        hook: idea.hook,
        script: idea.script,
        shotList: idea.shotList,
        caption: idea.caption,
        plannedFor: idea.plannedFor.toISOString(),
      }));
      setIdeas((prev) => [...mapped, ...prev]);
      pushToast({
        message: `Saved ${mapped.length} draft ideas${result.warnings.length ? ` (${result.warnings.length} warnings)` : ""}`,
        tone: "success",
      });
      setTab("ideas");
    });
  }

  function saveIdea(idea: MarketingIdeaRow, patch: Partial<MarketingIdeaRow>) {
    setError(null);
    startTransition(async () => {
      const result = await updateContentIdeaAction({
        id: idea.id,
        hook: patch.hook ?? idea.hook,
        script: patch.script ?? idea.script,
        shotList: patch.shotList ?? idea.shotList,
        caption: patch.caption ?? idea.caption,
        plannedFor:
          patch.plannedFor === undefined ? idea.plannedFor : patch.plannedFor,
      });
      if (!result.ok) {
        setError(result.message);
        pushToast({ message: result.message, tone: "error" });
        return;
      }
      setIdeas((prev) =>
        prev.map((row) =>
          row.id === idea.id
            ? {
                ...row,
                hook: result.idea.hook,
                script: result.idea.script,
                shotList: Array.isArray(result.idea.shotList)
                  ? (result.idea.shotList as string[])
                  : row.shotList,
                caption: result.idea.caption,
                plannedFor: result.idea.plannedFor,
              }
            : row,
        ),
      );
      pushToast({ message: "Idea updated", tone: "success" });
    });
  }

  function setStatus(idea: MarketingIdeaRow, status: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      const result =
        status === "approved"
          ? await approveContentIdeaAction(idea.id)
          : await rejectContentIdeaAction(idea.id);
      if (!result.ok) {
        setError(result.message);
        pushToast({ message: result.message, tone: "error" });
        return;
      }
      setIdeas((prev) =>
        prev.map((row) => (row.id === idea.id ? { ...row, status: result.idea.status } : row)),
      );
      pushToast({
        message: status === "approved" ? "Idea approved" : "Idea rejected",
        tone: "success",
      });
    });
  }

  return (
    <div className="space-y-6" data-component="MarketingCms">
      <AdminAlert message={error} />

      <AdminPanel.Root>
        <AdminPanel.Header sticky className="adm-panel__header--ruled">
          <p className="adm-section-tag">Marketing Intelligence</p>
          <p className="mt-1 max-w-2xl text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
            Competitor observations (append-only) and owner-approvable Reels ideas. No social
            scraping, no auto-publish.
          </p>
        </AdminPanel.Header>
        <AdminPanel.Body>
          <div className="adm-inset-x pt-4">
            <AdminSectionTabs
              embedded
              items={[...TABS]}
              active={tab}
              onChange={(id) => setTab(id as TabId)}
              aria-label="Marketing sections"
            />
          </div>

          {tab === "observations" ? (
            <div className="adm-inset-x space-y-4 py-5">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs" style={{ color: "var(--adm-muted)" }}>
                  Kind
                  <select
                    className="ml-2 rounded border px-2 py-1 text-sm"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    style={{
                      borderColor: "var(--adm-border)",
                      background: "var(--adm-surface)",
                    }}
                  >
                    <option value="all">All</option>
                    <option value="initial">Initial</option>
                    <option value="changed">Changed</option>
                    <option value="removed">Removed</option>
                  </select>
                </label>
                <AdminButton variant="primary" busy={pending} onClick={runScan}>
                  Scan now
                </AdminButton>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr style={{ color: "var(--adm-muted)" }}>
                      <th className="py-2 pr-3 font-medium">Brand</th>
                      <th className="py-2 pr-3 font-medium">URL</th>
                      <th className="py-2 pr-3 font-medium">Fetched</th>
                      <th className="py-2 pr-3 font-medium">Kind</th>
                      <th className="py-2 pr-3 font-medium">Price</th>
                      <th className="py-2 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredObservations.map((row) => (
                      <tr key={row.id} className="border-t" style={{ borderColor: "var(--adm-border)" }}>
                        <td className="py-2 pr-3">{row.brand}</td>
                        <td className="py-2 pr-3">
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline break-all"
                          >
                            {row.url.replace(/^https?:\/\//, "").slice(0, 48)}
                          </a>
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {new Date(row.fetchedAt).toISOString().slice(0, 16).replace("T", " ")}
                        </td>
                        <td className="py-2 pr-3">{row.kind}</td>
                        <td className="py-2 pr-3">
                          {row.price != null
                            ? `${row.price}${row.currency ? ` ${row.currency}` : ""}`
                            : "—"}
                        </td>
                        <td className="py-2">{row.source}</td>
                      </tr>
                    ))}
                    {filteredObservations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6" style={{ color: "var(--adm-muted)" }}>
                          No observations yet. Run Scan now (respects robots + rate limits).
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === "ideas" ? (
            <div className="adm-inset-x space-y-6 py-5">
              <div className="space-y-3">
                <p className="text-sm font-medium">Generate from products</p>
                <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                  {products.map((p) => (
                    <label key={p.id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
                <AdminLongTextField
                  name="manualNotes"
                  label="Optional notes (blocks separated by --- ; first line = URL)"
                  value={notes}
                  onChange={setNotes}
                />
                <AdminButton variant="primary" busy={pending} onClick={runGenerate}>
                  Generate ideas
                </AdminButton>
              </div>

              <div className="space-y-4">
                {ideas.map((idea) => (
                  <IdeaEditorCard
                    key={idea.id}
                    idea={idea}
                    pending={pending}
                    onSave={saveIdea}
                    onApprove={() => setStatus(idea, "approved")}
                    onReject={() => setStatus(idea, "rejected")}
                  />
                ))}
                {ideas.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--adm-muted)" }}>
                    No ideas yet.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "calendar" ? (
            <div className="adm-inset-x space-y-4 py-5">
              {calendar.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--adm-muted)" }}>
                  No approved scheduled ideas.
                </p>
              ) : (
                calendar.map((week) => (
                  <div key={week.weekKey} className="space-y-2">
                    <h3 className="text-sm font-medium">
                      Week of {week.weekStart.slice(0, 10)}
                    </h3>
                    <ul className="space-y-2">
                      {week.ideas.map((idea) => (
                        <li
                          key={idea.id}
                          className="border-t pt-2 text-sm"
                          style={{ borderColor: "var(--adm-border)" }}
                        >
                          <p className="font-medium">
                            [{idea.locale}] {idea.hook}
                          </p>
                          <p style={{ color: "var(--adm-muted)" }}>{idea.caption}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </AdminPanel.Body>
      </AdminPanel.Root>
    </div>
  );
}

function IdeaEditorCard({
  idea,
  pending,
  onSave,
  onApprove,
  onReject,
}: {
  idea: MarketingIdeaRow;
  pending: boolean;
  onSave: (idea: MarketingIdeaRow, patch: Partial<MarketingIdeaRow>) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [hook, setHook] = useState(idea.hook);
  const [script, setScript] = useState(idea.script);
  const [shots, setShots] = useState(shotListToText(idea.shotList));
  const [caption, setCaption] = useState(idea.caption);
  const [plannedFor, setPlannedFor] = useState(
    idea.plannedFor ? idea.plannedFor.slice(0, 10) : "",
  );

  return (
    <div
      className="space-y-3 border-t pt-4"
      style={{ borderColor: "var(--adm-border)" }}
      data-idea-id={idea.id}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--adm-muted)" }}>
        <span>{idea.status}</span>
        <span>·</span>
        <span>{idea.locale}</span>
        <span>·</span>
        <span>{idea.productIds.length} products</span>
      </div>
      <AdminTextField name={`hook-${idea.id}`} label="Hook" value={hook} onChange={(e) => setHook(e.target.value)} />
      <AdminLongTextField
        name={`script-${idea.id}`}
        label="Script"
        value={script}
        onChange={setScript}
      />
      <AdminLongTextField
        name={`shots-${idea.id}`}
        label="Shot list (one per line)"
        value={shots}
        onChange={setShots}
      />
      <AdminLongTextField
        name={`caption-${idea.id}`}
        label="Caption"
        value={caption}
        onChange={setCaption}
      />
      <AdminTextField
        name={`planned-${idea.id}`}
        label="Planned for (YYYY-MM-DD)"
        value={plannedFor}
        onChange={(e) => setPlannedFor(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <AdminButton
          variant="secondary"
          busy={pending}
          onClick={() =>
            onSave(idea, {
              hook,
              script,
              shotList: textToShotList(shots),
              caption,
              plannedFor: plannedFor ? new Date(`${plannedFor}T12:00:00.000Z`).toISOString() : null,
            })
          }
        >
          Save edits
        </AdminButton>
        <AdminButton variant="primary" busy={pending} onClick={onApprove} disabled={idea.status === "approved"}>
          Approve
        </AdminButton>
        <AdminButton variant="danger" busy={pending} onClick={onReject} disabled={idea.status === "rejected"}>
          Reject
        </AdminButton>
      </div>
    </div>
  );
}
