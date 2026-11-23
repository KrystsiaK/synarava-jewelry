"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  approveContentIdeaAction,
  downloadObservationsCsvAction,
  exportObservationsToGoogleSheetAction,
  generateMarketingIdeasAction,
  rejectContentIdeaAction,
  retryCalendarSyncAction,
  scanCompetitorsAction,
  updateContentIdeaAction,
} from "@/app/admin/actions/marketing";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  AdminAlert,
  AdminButton,
  AdminCheckboxField,
  AdminEntityList,
  AdminLongTextField,
  AdminModal,
  AdminPanel,
  AdminSectionTabs,
  AdminSelectField,
  AdminTextField,
} from "@/components/synarava-cms";
import type { ExportPeriod } from "@/lib/marketing/export/csv";
import {
  buildMonthAgenda,
  buildMonthGrid,
  shiftMonth,
  visibleDayChips,
  type CalendarIdeaInput,
} from "@/lib/marketing/ideas/calendar";
import type { LocalizedCopy } from "@/lib/marketing/ideas/localized";

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
  productIds: string[];
  signalIds: string[];
  whyRu: string;
  hook: LocalizedCopy;
  script: string;
  shotList: string[];
  caption: LocalizedCopy;
  plannedFor: string | null;
  calendarEventId: string | null;
  calendarSyncedAt: string | null;
  calendarSyncError: string | null;
};

export type MarketingProductOption = { id: string; name: string };

export type MarketingLastScanDomain = {
  domain: string;
  fetched: number;
  written: number;
  unparsed: number;
  skippedRobots: number;
  sitemapComplete: boolean;
  firstError: string | null;
};

export type MarketingLastScan = {
  createdAt: string;
  writtenTotal: number;
  unparsedTotal: number;
  durationMs: number;
  truncated: boolean;
  domains: MarketingLastScanDomain[];
};

type TabId = "observations" | "ideas" | "calendar";

const TABS = [
  { id: "observations", label: "Observations" },
  { id: "ideas", label: "Ideas" },
  { id: "calendar", label: "Calendar" },
] as const;

const AUDIENCE_TABS = [
  { id: "en", label: "EN" },
  { id: "pt", label: "PT" },
] as const;

const OBS_COLUMNS = [
  { key: "brand", label: "Brand" },
  { key: "url", label: "URL" },
  { key: "fetched", label: "Fetched" },
  { key: "kind", label: "Kind" },
  { key: "price", label: "Price" },
  { key: "source", label: "Source" },
];

const SCAN_COLUMNS = [
  { key: "domain", label: "Domain" },
  { key: "fetched", label: "Fetched" },
  { key: "written", label: "Written" },
  { key: "unparsed", label: "Unparsed" },
  { key: "robots", label: "Skipped robots" },
  { key: "sitemap", label: "Sitemap" },
  { key: "error", label: "First error" },
];

const OBS_GRID =
  "xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)_7rem_5rem_6rem_5rem]";
const SCAN_GRID =
  "xl:grid-cols-[minmax(0,1.2fr)_4.5rem_4.5rem_5rem_6rem_5.5rem_minmax(0,1.4fr)]";

function shotListToText(shots: string[]): string {
  return shots.join("\n");
}

function textToShotList(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function asCalendarInput(idea: MarketingIdeaRow): CalendarIdeaInput {
  return {
    id: idea.id,
    status: idea.status,
    productIds: idea.productIds,
    script: idea.script,
    shotList: idea.shotList,
    hook: idea.hook,
    caption: idea.caption,
    whyRu: idea.whyRu,
    plannedFor: idea.plannedFor,
  };
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function MarketingCms({
  initialObservations,
  initialIdeas,
  products,
  lastScan = null,
  monthlyAiSpendUsd = 0,
  initialKind = "all",
  initialTab = "observations",
  calendarSyncEnabled = false,
  sheetsExportEnabled = false,
}: {
  initialObservations: MarketingObservationRow[];
  initialIdeas: MarketingIdeaRow[];
  products: MarketingProductOption[];
  lastScan?: MarketingLastScan | null;
  monthlyAiSpendUsd?: number;
  initialKind?: string;
  initialTab?: TabId;
  calendarSyncEnabled?: boolean;
  sheetsExportEnabled?: boolean;
}) {
  const { pushToast } = useAdminToast();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [kind, setKind] = useState(initialKind);
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>("30");
  const [ideas, setIdeas] = useState(initialIdeas);
  const [observations] = useState(initialObservations);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generateCost, setGenerateCost] = useState<{
    costUsd: number;
    model: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [focusIdeaId, setFocusIdeaId] = useState<string | null>(null);
  const [panelIdeaId, setPanelIdeaId] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const [monthCursor, setMonthCursor] = useState(() => ({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth(),
  }));
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const productNameById = useMemo(
    () => new Map(products.map((p) => [p.id, p.name])),
    [products],
  );

  const calendarIdeas = useMemo(() => ideas.map(asCalendarInput), [ideas]);

  const monthGrid = useMemo(
    () =>
      buildMonthGrid({
        year: monthCursor.year,
        month: monthCursor.month,
        ideas: calendarIdeas,
        productNameById,
        now,
      }),
    [monthCursor, calendarIdeas, productNameById, now],
  );

  const agenda = useMemo(
    () =>
      buildMonthAgenda({
        year: monthCursor.year,
        month: monthCursor.month,
        ideas: calendarIdeas,
        productNameById,
      }),
    [monthCursor, calendarIdeas, productNameById],
  );

  const panelIdea = panelIdeaId
    ? (ideas.find((i) => i.id === panelIdeaId) ?? null)
    : null;

  const filteredObservations = useMemo(() => {
    if (kind === "all") return observations;
    return observations.filter((o) => o.kind === kind);
  }, [observations, kind]);

  function toggleProduct(id: string) {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 10),
    );
  }

  function mergeIdea(idea: MarketingIdeaRow) {
    setIdeas((prev) =>
      prev.map((row) => (row.id === idea.id ? { ...row, ...idea } : row)),
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
      window.location.reload();
    });
  }

  function runCsvDownload() {
    setError(null);
    startTransition(async () => {
      const result = await downloadObservationsCsvAction({
        kind: kind as "all" | "initial" | "changed" | "removed",
        period: exportPeriod,
      });
      if (!result.ok) {
        setError(result.message);
        pushToast({ message: result.message, tone: "error" });
        return;
      }
      downloadBlob(result.filename, result.csv, "text/csv;charset=utf-8");
      pushToast({ message: `CSV: ${result.rowCount} rows`, tone: "success" });
    });
  }

  function runSheetExport() {
    setError(null);
    startTransition(async () => {
      const result = await exportObservationsToGoogleSheetAction();
      if (!result.ok) {
        setError(result.message);
        pushToast({ message: result.message, tone: "error" });
        return;
      }
      pushToast({
        message: `Sheet updated · ${result.observationRows} obs · ${result.summaryRows} brands`,
        tone: "success",
      });
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
        return {
          url: url.startsWith("http") ? url : "https://example.com/note",
          text,
        };
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
        productIds: idea.productIds,
        signalIds: idea.signalIds,
        whyRu: idea.whyRu,
        hook: idea.hook,
        script: idea.script,
        shotList: idea.shotList,
        caption: idea.caption,
        plannedFor: idea.plannedFor.toISOString(),
        calendarEventId: null,
        calendarSyncedAt: null,
        calendarSyncError: null,
      }));
      setIdeas((prev) => [...mapped, ...prev]);
      setGenerateCost({
        costUsd: result.usage.costUsd,
        model: result.usage.model,
      });
      const lowCountWarning = result.warnings.find((w) =>
        /^only \d+ valid ideas$/.test(w),
      );
      if (lowCountWarning) setError(lowCountWarning);
      pushToast({
        message: `Saved ${mapped.length} draft ideas · $${result.usage.costUsd.toFixed(4)} (${result.usage.model})${result.warnings.length ? ` · ${result.warnings.length} warnings` : ""}`,
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
        whyRu: patch.whyRu ?? idea.whyRu,
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
      mergeIdea({ ...idea, ...result.idea });
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
      mergeIdea({ ...idea, ...result.idea });
      pushToast({
        message: status === "approved" ? "Idea approved" : "Idea rejected",
        tone: "success",
      });
    });
  }

  function retrySync(idea: MarketingIdeaRow) {
    setError(null);
    startTransition(async () => {
      const result = await retryCalendarSyncAction(idea.id);
      if (!result.ok) {
        setError(result.message);
        pushToast({ message: result.message, tone: "error" });
        return;
      }
      mergeIdea({ ...idea, ...result.idea });
      pushToast({
        message: result.idea.calendarSyncError
          ? "Sync still failing"
          : "Synced to Google Calendar",
        tone: result.idea.calendarSyncError ? "error" : "success",
      });
    });
  }

  function openIdea(id: string) {
    setPanelIdeaId(id);
    setFocusIdeaId(id);
  }

  function goToIdeaCard(id: string) {
    setPanelIdeaId(null);
    setTab("ideas");
    setFocusIdeaId(id);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-idea-id="${id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="space-y-8" data-component="MarketingCms">
      <AdminAlert message={error} />

      <AdminPanel.Root>
        <AdminPanel.Header sticky className="adm-panel__header--ruled">
          <p className="adm-section-tag">Marketing Intelligence</p>
          <p className="adm-copy mt-1 max-w-2xl text-xs leading-5">
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
              <div className="flex flex-wrap items-end gap-3">
                <AdminSelectField
                  name="observation-kind"
                  label="Kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="initial">Initial</option>
                  <option value="changed">Changed</option>
                  <option value="removed">Removed</option>
                </AdminSelectField>
                <AdminSelectField
                  name="export-period"
                  label="Period"
                  value={exportPeriod}
                  onChange={(e) => setExportPeriod(e.target.value as ExportPeriod)}
                >
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="all">All</option>
                </AdminSelectField>
                <AdminButton variant="primary" busy={pending} onClick={runScan}>
                  Scan now
                </AdminButton>
                <AdminButton variant="secondary" busy={pending} onClick={runCsvDownload}>
                  Скачать CSV
                </AdminButton>
                {sheetsExportEnabled ? (
                  <AdminButton variant="secondary" busy={pending} onClick={runSheetExport}>
                    Обновить Google Таблицу
                  </AdminButton>
                ) : null}
              </div>

              {lastScan ? (
                <div className="space-y-2" data-component="MarketingLastScanSummary">
                  <p className="adm-copy text-sm">
                    Last scan{" "}
                    {new Date(lastScan.createdAt)
                      .toISOString()
                      .slice(0, 16)
                      .replace("T", " ")}{" "}
                    UTC · {lastScan.writtenTotal} written · {lastScan.unparsedTotal}{" "}
                    unparsed · {lastScan.durationMs}ms
                    {lastScan.truncated ? " · truncated" : ""}
                  </p>
                  <AdminEntityList.Root>
                    <AdminEntityList.Header columns={SCAN_COLUMNS} gridClassName={SCAN_GRID} />
                    {lastScan.domains.map((d) => (
                      <AdminEntityList.Row key={d.domain} gridClassName={SCAN_GRID}>
                        <span className="text-sm">{d.domain}</span>
                        <span className="text-sm">{d.fetched}</span>
                        <span className="text-sm">{d.written}</span>
                        <span className="text-sm">{d.unparsed}</span>
                        <span className="text-sm">{d.skippedRobots}</span>
                        <span className="text-sm">
                          {d.sitemapComplete ? "complete" : "incomplete"}
                        </span>
                        <span
                          className={`break-all text-sm ${d.firstError ? "text-[color:var(--adm-danger-ink)]" : "adm-copy"}`}
                        >
                          {d.firstError ?? "—"}
                        </span>
                      </AdminEntityList.Row>
                    ))}
                  </AdminEntityList.Root>
                </div>
              ) : (
                <p className="adm-copy text-xs">No prior scan summary yet.</p>
              )}

              <AdminEntityList.Root>
                <AdminEntityList.Header columns={OBS_COLUMNS} gridClassName={OBS_GRID} />
                {filteredObservations.map((row) => (
                  <AdminEntityList.Row key={row.id} gridClassName={OBS_GRID}>
                    <span className="text-sm">{row.brand}</span>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-sm underline"
                    >
                      {row.url.replace(/^https?:\/\//, "").slice(0, 48)}
                    </a>
                    <span className="whitespace-nowrap text-sm">
                      {new Date(row.fetchedAt)
                        .toISOString()
                        .slice(0, 16)
                        .replace("T", " ")}
                    </span>
                    <span className="text-sm">{row.kind}</span>
                    <span className="text-sm">
                      {row.price != null
                        ? `${row.price}${row.currency ? ` ${row.currency}` : ""}`
                        : "—"}
                    </span>
                    <span className="text-sm">{row.source}</span>
                  </AdminEntityList.Row>
                ))}
                {filteredObservations.length === 0 ? (
                  <AdminEntityList.Empty>
                    No observations yet. Run Scan now (respects robots + rate limits).
                  </AdminEntityList.Empty>
                ) : null}
              </AdminEntityList.Root>
            </div>
          ) : null}

          {tab === "ideas" ? (
            <div className="adm-inset-x space-y-6 py-5">
              <div className="space-y-3">
                <p className="text-sm font-medium">Generate from products</p>
                <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                  {products.map((p) => (
                    <AdminCheckboxField
                      key={p.id}
                      name={`product-${p.id}`}
                      label={p.name}
                      checked={selectedProducts.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                    />
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
                <p className="adm-copy text-xs">
                  AI spend this month: ${monthlyAiSpendUsd.toFixed(4)}
                </p>
                {generateCost ? (
                  <p className="text-xs" data-component="MarketingGenerateCost">
                    Last generate: ${generateCost.costUsd.toFixed(4)} · {generateCost.model}
                  </p>
                ) : null}
              </div>

              <div className="space-y-4">
                {ideas.map((idea) => (
                  <IdeaEditorCard
                    key={`${idea.id}:${idea.status}:${idea.plannedFor ?? ""}:${idea.calendarSyncError ?? ""}:${idea.calendarEventId ?? ""}`}
                    idea={idea}
                    pending={pending}
                    highlighted={focusIdeaId === idea.id}
                    calendarSyncEnabled={calendarSyncEnabled}
                    onSave={saveIdea}
                    onApprove={() => setStatus(idea, "approved")}
                    onReject={() => setStatus(idea, "rejected")}
                    onRetrySync={() => retrySync(idea)}
                  />
                ))}
                {ideas.length === 0 ? (
                  <p className="adm-copy text-sm">No ideas yet.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "calendar" ? (
            <div className="adm-inset-x space-y-4 py-5" data-component="MarketingCalendar">
              <div className="flex flex-wrap items-center gap-2">
                <AdminButton
                  variant="ghost"
                  onClick={() =>
                    setMonthCursor((c) => shiftMonth(c.year, c.month, -1))
                  }
                >
                  ‹
                </AdminButton>
                <p className="min-w-[10rem] text-center text-sm font-medium capitalize">
                  {monthGrid.label}
                </p>
                <AdminButton
                  variant="ghost"
                  onClick={() =>
                    setMonthCursor((c) => shiftMonth(c.year, c.month, 1))
                  }
                >
                  ›
                </AdminButton>
                <AdminButton
                  variant="secondary"
                  onClick={() =>
                    setMonthCursor({
                      year: now.getUTCFullYear(),
                      month: now.getUTCMonth(),
                    })
                  }
                >
                  Сегодня
                </AdminButton>
              </div>

              {isNarrow ? (
                <div className="space-y-4" data-component="MarketingCalendarAgenda">
                  {agenda.length === 0 ? (
                    <p className="adm-copy text-sm">
                      No approved scheduled ideas this month.
                    </p>
                  ) : (
                    agenda.map((day) => (
                      <div key={day.dateKey} className="space-y-2">
                        <h3 className="text-sm font-medium">{day.label}</h3>
                        <ul className="space-y-1">
                          {day.entries.map((entry) => (
                            <li key={entry.id}>
                              <button
                                type="button"
                                className="text-left text-sm underline"
                                onClick={() => openIdea(entry.id)}
                              >
                                {entry.chipLabel}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div
                  className="grid grid-cols-7 gap-px overflow-hidden rounded border border-[color:var(--adm-border)] bg-[color:var(--adm-border)] text-xs"
                  data-component="MarketingCalendarGrid"
                >
                  {monthGrid.weekdayLabels.map((label) => (
                    <div
                      key={label}
                      className="bg-[color:var(--adm-panel)] px-2 py-1 font-medium"
                    >
                      {label}
                    </div>
                  ))}
                  {monthGrid.cells.map((cell) => {
                    const { chips, overflow } = visibleDayChips(cell.entries);
                    return (
                      <div
                        key={cell.dateKey}
                        className={[
                          "min-h-[5.5rem] space-y-1 bg-[color:var(--adm-panel)] p-1.5",
                          cell.inMonth ? "" : "opacity-35",
                          cell.inMonth && cell.isPast ? "opacity-55" : "",
                          cell.isToday
                            ? "outline outline-2 outline-[color:var(--adm-accent)] -outline-offset-2"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        data-date={cell.dateKey}
                        data-today={cell.isToday ? "true" : undefined}
                      >
                        <p className="font-medium">{cell.dateKey.slice(8)}</p>
                        {chips.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            className="block w-full truncate rounded bg-[color:color-mix(in_srgb,var(--adm-accent)_18%,transparent)] px-1 py-0.5 text-left"
                            title={entry.chipLabel}
                            onClick={() => openIdea(entry.id)}
                          >
                            {entry.chipLabel}
                          </button>
                        ))}
                        {overflow > 0 ? (
                          <p className="adm-copy">+{overflow}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </AdminPanel.Body>
      </AdminPanel.Root>

      <AdminModal
        open={panelIdea != null}
        onClose={() => setPanelIdeaId(null)}
        ariaLabel="Idea details"
      >
        {panelIdea ? (
          <div className="max-h-[80vh] space-y-4 overflow-y-auto p-1">
            <IdeaEditorCard
              key={`${panelIdea.id}:${panelIdea.status}:${panelIdea.plannedFor ?? ""}:${panelIdea.calendarSyncError ?? ""}:${panelIdea.calendarEventId ?? ""}`}
              idea={panelIdea}
              pending={pending}
              highlighted
              calendarSyncEnabled={calendarSyncEnabled}
              onSave={saveIdea}
              onApprove={() => setStatus(panelIdea, "approved")}
              onReject={() => {
                setStatus(panelIdea, "rejected");
                setPanelIdeaId(null);
              }}
              onRetrySync={() => retrySync(panelIdea)}
            />
            <AdminButton variant="ghost" onClick={() => goToIdeaCard(panelIdea.id)}>
              Open in Ideas tab
            </AdminButton>
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}

function IdeaEditorCard({
  idea,
  pending,
  highlighted,
  calendarSyncEnabled,
  onSave,
  onApprove,
  onReject,
  onRetrySync,
}: {
  idea: MarketingIdeaRow;
  pending: boolean;
  highlighted?: boolean;
  calendarSyncEnabled: boolean;
  onSave: (idea: MarketingIdeaRow, patch: Partial<MarketingIdeaRow>) => void;
  onApprove: () => void;
  onReject: () => void;
  onRetrySync: () => void;
}) {
  const [whyRu, setWhyRu] = useState(idea.whyRu);
  const [script, setScript] = useState(idea.script);
  const [shots, setShots] = useState(shotListToText(idea.shotList));
  const [hook, setHook] = useState(idea.hook);
  const [caption, setCaption] = useState(idea.caption);
  const [audienceTab, setAudienceTab] = useState<"en" | "pt">("en");
  const [plannedFor, setPlannedFor] = useState(
    idea.plannedFor ? idea.plannedFor.slice(0, 10) : "",
  );

  return (
    <div
      className={[
        "space-y-3 border-t border-[color:var(--adm-border)] pt-4",
        highlighted
          ? "outline outline-1 outline-[color:var(--adm-accent)] outline-offset-4"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-idea-id={idea.id}
    >
      <div className="adm-copy flex flex-wrap items-center gap-2 text-xs">
        <span>{idea.status}</span>
        <span>·</span>
        <span>{idea.productIds.length} products</span>
      </div>

      <p className="adm-copy text-xs font-medium uppercase tracking-wide">Owner (RU)</p>
      <AdminLongTextField
        name={`whyRu-${idea.id}`}
        label="Why (RU)"
        value={whyRu}
        onChange={setWhyRu}
      />
      <AdminLongTextField
        name={`script-${idea.id}`}
        label="Script (RU)"
        value={script}
        onChange={setScript}
      />
      <AdminLongTextField
        name={`shots-${idea.id}`}
        label="Shot list (RU, one per line)"
        value={shots}
        onChange={setShots}
      />

      <p className="adm-copy text-xs font-medium uppercase tracking-wide">Audience</p>
      <AdminSectionTabs
        embedded
        items={[...AUDIENCE_TABS]}
        active={audienceTab}
        onChange={(id) => setAudienceTab(id as "en" | "pt")}
        aria-label={`Audience locale ${idea.id}`}
        idPrefix={`idea-aud-${idea.id}`}
      >
        <div className="space-y-3 pt-3">
          <AdminTextField
            name={`hook-${audienceTab}-${idea.id}`}
            label={`Hook (${audienceTab.toUpperCase()})`}
            value={hook[audienceTab]}
            onChange={(e) =>
              setHook((prev) => ({ ...prev, [audienceTab]: e.target.value }))
            }
          />
          <AdminLongTextField
            name={`caption-${audienceTab}-${idea.id}`}
            label={`Caption (${audienceTab.toUpperCase()})`}
            value={caption[audienceTab]}
            onChange={(value) =>
              setCaption((prev) => ({ ...prev, [audienceTab]: value }))
            }
          />
        </div>
      </AdminSectionTabs>

      <AdminTextField
        name={`planned-${idea.id}`}
        label="Planned for (YYYY-MM-DD)"
        value={plannedFor}
        onChange={(e) => setPlannedFor(e.target.value)}
      />

      {calendarSyncEnabled ? (
        <div className="space-y-1 text-xs" data-component="CalendarSyncStatus">
          {idea.calendarSyncError ? (
            <p className="text-[color:var(--adm-danger-ink)]">
              Не синхронизировано — повторить
            </p>
          ) : idea.calendarEventId ? (
            <p className="adm-copy">
              Google Calendar · synced
              {idea.calendarSyncedAt
                ? ` ${idea.calendarSyncedAt.slice(0, 16).replace("T", " ")}`
                : ""}
            </p>
          ) : (
            <p className="adm-copy">Google Calendar · not synced yet</p>
          )}
          {idea.calendarSyncError || idea.status === "approved" ? (
            <AdminButton variant="ghost" busy={pending} onClick={onRetrySync}>
              Повторить
            </AdminButton>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <AdminButton
          variant="secondary"
          busy={pending}
          onClick={() =>
            onSave(idea, {
              whyRu,
              script,
              shotList: textToShotList(shots),
              hook,
              caption,
              plannedFor: plannedFor
                ? new Date(`${plannedFor}T12:00:00.000Z`).toISOString()
                : null,
            })
          }
        >
          Save edits
        </AdminButton>
        <AdminButton
          variant="primary"
          busy={pending}
          onClick={onApprove}
          disabled={idea.status === "approved"}
        >
          Approve
        </AdminButton>
        <AdminButton
          variant="danger"
          busy={pending}
          onClick={onReject}
          disabled={idea.status === "rejected"}
        >
          Reject
        </AdminButton>
      </div>
    </div>
  );
}
