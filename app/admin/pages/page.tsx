import { savePageAction } from "@/app/admin/actions";
import { AdminHelp } from "@/components/admin/admin-help";
import { PageDeleteButton } from "@/components/admin/page-delete-button";
import { getAdminCatalogData } from "@/lib/content/catalog";
import { LocaleTabStrip } from "@/components/admin/admin-primitives";

function getPublicPageUrl(slug: string) {
  if (slug === "home") return "/";
  if (slug === "manifesto") return "/about/manifesto";
  if (slug === "about") return "/about";
  return `/${slug}`;
}

function isProtectedPage(slug: string) {
  return slug === "home" || slug === "about" || slug === "manifesto";
}

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

      <form action={savePageAction} className="adm-panel grid gap-5 p-5 md:p-6">
        <div
          className="flex flex-wrap items-start justify-between gap-4 pb-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <p className="adm-section-tag">
              [ PAGE // NEW ]
            </p>
            <h2 className="adm-title-sm mt-2">
              Untitled page
            </h2>
            <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--adm-muted)" }}>
              New custom pages are published at <code>/{`slug`}</code>. Built-in routes like
              <code> /about</code> and <code> /about/manifesto</code> stay managed by their existing records.
            </p>
          </div>
          <button type="submit" className="adm-btn-primary">
            Create page
          </button>
        </div>

        <LocaleTabStrip />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="adm-label">Title</span>
            <input
              name="title"
              placeholder="Journal"
              className="adm-field"
            />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">Slug</span>
            <input
              name="slug"
              placeholder="journal"
              className="adm-field"
            />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">Eyebrow</span>
            <input
              name="eyebrow"
              placeholder="Editorial note"
              className="adm-field"
            />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="adm-label">Excerpt</span>
          <textarea
            name="excerpt"
            rows={3}
            className="adm-field"
            placeholder="Short summary for the page intro and metadata."
          />
        </label>

        <label className="grid gap-2">
          <span className="adm-label">Body</span>
          <textarea
            name="body"
            rows={5}
            className="adm-field"
            placeholder="Main editorial body copy."
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="adm-label">CTA label</span>
            <input
              name="ctaLabel"
              placeholder="Shop all products"
              className="adm-field"
            />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">CTA href</span>
            <input
              name="ctaHref"
              placeholder="/shop"
              className="adm-field"
            />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="adm-label">Quote</span>
          <textarea
            name="quote"
            rows={4}
            className="adm-field"
            placeholder="Optional quote or highlighted statement."
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="adm-label">Secondary title</span>
            <input
              name="secondaryTitle"
              placeholder="Further reading"
              className="adm-field"
            />
          </label>
          <label className="grid gap-2">
            <span className="adm-label">Secondary body</span>
            <textarea
              name="secondaryBody"
              rows={3}
              className="adm-field"
              placeholder="Optional follow-up copy block."
            />
          </label>
        </div>

        <div
          className="flex justify-end pt-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button type="submit" className="adm-btn-primary">
            Create page
          </button>
        </div>
      </form>

      {/* Page forms */}
      <div className="grid gap-6">
        {pages.map((page) => {
          const content = (page.content ?? {}) as Record<string, string | undefined>;
          const protectedPage = isProtectedPage(page.slug);

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
                  <p className="mt-2 text-sm" style={{ color: "var(--adm-muted)" }}>
                    Public URL: <code>{getPublicPageUrl(page.slug)}</code>
                  </p>
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
                className="flex flex-wrap items-start justify-between gap-4 pt-4"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                {protectedPage ? (
                  <p className="text-sm" style={{ color: "var(--adm-muted)" }}>
                    System page. Editing is allowed, deletion is blocked.
                  </p>
                ) : (
                  <PageDeleteButton slug={page.slug} title={page.title} />
                )}
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
