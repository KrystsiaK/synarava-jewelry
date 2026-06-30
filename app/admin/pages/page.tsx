import { savePageAction } from "@/app/admin/actions";
import { AdminHelp } from "@/components/admin/admin-help";
import { getAdminCatalogData } from "@/lib/content/catalog";
import { LocaleTabStrip } from "@/components/admin/admin-primitives";

export default async function AdminPagesPage() {
  const { pages } = await getAdminCatalogData();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // PGS ]</p>
        <h1 className="adm-page-title">
          Pages
        </h1>
        <p className="adm-page-subtitle">
          Editorial CMS for home, about, manifesto, and locale-aware content work.
        </p>
      </div>

      {/* i18n notice */}
      <div
        className="adm-panel flex items-start gap-3 p-4"
      >
        <span style={{ color: "var(--adm-accent)", fontSize: "0.8rem" }}>◆</span>
        <div className="adm-label-row">
          <span className="adm-title-sm">Locale status: EN only</span>
          <AdminHelp>
            Edits here affect the EN locale only. BE and RU translation support is planned and will be wired in a future release.
          </AdminHelp>
        </div>
      </div>

      {/* Page forms */}
      <div className="grid gap-6">
        {pages.map((page) => {
          const content = (page.content ?? {}) as Record<string, string | undefined>;

          return (
            <form key={page.id} action={savePageAction} className="adm-panel grid gap-5 p-5 md:p-6">
              <input type="hidden" name="slug" value={page.slug} />

              {/* Page header */}
              <div
                className="flex flex-wrap items-start justify-between gap-4 pb-5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div>
                  <p className="adm-section-tag">
                    [ PAGE // {page.slug.toUpperCase()} ]
                  </p>
                  <h2 className="adm-title-sm mt-2">
                    {page.title}
                  </h2>
                </div>
                <button type="submit" className="adm-btn-primary">
                  Save page
                </button>
              </div>

              {/* Locale tabs — i18n groundwork */}
              <LocaleTabStrip />

              {/* Fields */}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="adm-label">Title</span>
                  <input name="title" defaultValue={page.title} className="adm-field" />
                </label>
                <label className="grid gap-2">
                  <span className="adm-label">Eyebrow</span>
                  <input
                    name="eyebrow"
                    defaultValue={content.eyebrow ?? ""}
                    className="adm-field"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="adm-label">Excerpt</span>
                <textarea
                  name="excerpt"
                  defaultValue={page.excerpt ?? ""}
                  rows={3}
                  className="adm-field"
                />
              </label>

              <label className="grid gap-2">
                <span className="adm-label">Body</span>
                <textarea
                  name="body"
                  defaultValue={content.body ?? ""}
                  rows={5}
                  className="adm-field"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="adm-label">CTA label</span>
                  <input
                    name="ctaLabel"
                    defaultValue={content.ctaLabel ?? ""}
                    className="adm-field"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="adm-label">CTA href</span>
                  <input
                    name="ctaHref"
                    defaultValue={content.ctaHref ?? ""}
                    className="adm-field"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="adm-label">Quote</span>
                <textarea
                  name="quote"
                  defaultValue={content.quote ?? ""}
                  rows={4}
                  className="adm-field"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="adm-label">Secondary title</span>
                  <input
                    name="secondaryTitle"
                    defaultValue={content.secondaryTitle ?? ""}
                    className="adm-field"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="adm-label">Secondary body</span>
                  <textarea
                    name="secondaryBody"
                    defaultValue={content.secondaryBody ?? ""}
                    rows={3}
                    className="adm-field"
                  />
                </label>
              </div>

              <div
                className="flex justify-end pt-4"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <button type="submit" className="adm-btn-primary">
                  Save page
                </button>
              </div>
            </form>
          );
        })}
      </div>
    </div>
  );
}
