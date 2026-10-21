import type { Meta, StoryObj } from "@storybook/react";

import { TranslationsCms, type ReconcileDifferenceRow } from "@/components/admin/translations/translations-cms";
import type { ReconcileRunSummary } from "@/lib/shopify/reconciliation-types";

const run: ReconcileRunSummary = {
  id: "run-story",
  trigger: "MANUAL",
  status: "SUCCEEDED",
  checkedCount: 14,
  differenceCount: 2,
  error: null,
  startedAt: "2026-10-20T09:30:00.000Z",
  completedAt: "2026-10-20T09:30:04.000Z",
  createdAt: "2026-10-20T09:30:00.000Z",
};

const differences: ReconcileDifferenceRow[] = [
  {
    id: "story-title",
    runId: run.id,
    bindingId: "story-binding-title",
    rootEntityType: "PRODUCT",
    rootEntityId: "lava-ring",
    entityLabel: "Lava Ring",
    locale: "pt-PT",
    targetKind: "NATIVE",
    fieldKey: "title",
    fieldLabel: "Title",
    kind: "CONFLICT",
    baseValue: "Anel Lava",
    localValue: "Anel de Lava",
    shopifyValue: "Anel Vulcânico",
    localFingerprint: "local-title",
    shopifyFingerprint: "shopify-title",
    shopifyUpdatedAt: "2026-10-20T09:20:00.000Z",
    shopifyOutdated: false,
    href: "/admin/products/lava-ring",
  },
  {
    id: "story-description",
    runId: run.id,
    bindingId: "story-binding-description",
    rootEntityType: "PRODUCT",
    rootEntityId: "lava-ring",
    entityLabel: "Lava Ring",
    locale: "pt-PT",
    targetKind: "METAOBJECT",
    fieldKey: "description",
    fieldLabel: "Description",
    kind: "LOCAL_ONLY",
    baseValue: "Prata reciclada.",
    localValue: "Esculpido à mão em prata reciclada, com acabamento acetinado.",
    shopifyValue: "Prata reciclada.",
    localFingerprint: "local-description",
    shopifyFingerprint: "shopify-description",
    shopifyUpdatedAt: "2026-10-20T09:20:00.000Z",
    shopifyOutdated: false,
    href: "/admin/products/lava-ring",
  },
];

function TranslationsPageStory({ rows = differences }: { rows?: ReconcileDifferenceRow[] }) {
  return (
    <main className="admin-terminal min-h-dvh bg-[var(--adm-bg)] p-4 text-[var(--adm-ink)] md:p-8">
      <div className="mx-auto grid max-w-6xl gap-7">
        <header>
          <h1 className="adm-page-title">Translations</h1>
          <p className="adm-page-subtitle">
            Compare Synarava and Shopify translations, then choose which side wins for each difference.
          </p>
        </header>
        <TranslationsCms initialRun={{ ...run, differenceCount: rows.length }} differences={rows} />
      </div>
    </main>
  );
}

const meta = {
  title: "Admin/Translations/Page",
  component: TranslationsPageStory,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
  },
} satisfies Meta<typeof TranslationsPageStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Differences: Story = {};

export const AllCurrent: Story = {
  args: { rows: [] },
};
