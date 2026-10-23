"use client";

import { ArrowUpRight, BookOpen } from "lucide-react";
import Link from "next/link";

import { AdminListWorkspace } from "@/components/admin/shared/admin-list-workspace";
import { AdminStatusBadge } from "@/components/admin/shared/admin-status-badge";
import type { HelpArticleMeta } from "@/lib/admin/help-docs";

export function AdminHelpIndex({ articles }: { articles: HelpArticleMeta[] }) {
  const sections = Map.groupBy(articles, (article) => article.section);

  return (
    <AdminListWorkspace.Root className="adm-help-index">
      <AdminListWorkspace.Header
        tag="Help library"
        title="Understand the system. Work with confidence."
        meta="Team guidance is reviewed in the repository and shown here exactly where you work."
      />
      <AdminListWorkspace.Body>
        <div className="adm-help-index__intro">
          <BookOpen aria-hidden="true" />
          <p>
            Start with the guide that matches your task. Draft articles are useful working notes;
            verified articles have been checked against the current admin.
          </p>
        </div>
        <div className="adm-help-index__sections">
          {Array.from(sections, ([section, sectionArticles]) => (
            <section key={section} className="adm-help-index__section" aria-labelledby={`help-section-${section}`}>
              <div className="adm-help-index__section-heading">
                <h2 id={`help-section-${section}`}>{section}</h2>
                <span>{sectionArticles.length} {sectionArticles.length === 1 ? "article" : "articles"}</span>
              </div>
              <div className="adm-help-index__articles">
                {sectionArticles.map((article) => (
                  <Link key={article.slug} href={`/admin/help/${article.slug}`} className="adm-help-index__article">
                    <div>
                      <h3>{article.title}</h3>
                      <p>Last checked {article.updatedOn}</p>
                    </div>
                    <div className="adm-help-index__article-action">
                      <AdminStatusBadge tone={article.status === "verified" ? "published" : "draft"}>
                        {article.status === "verified" ? `Verified ${article.verifiedOn}` : "Draft"}
                      </AdminStatusBadge>
                      <ArrowUpRight aria-hidden="true" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </AdminListWorkspace.Body>
    </AdminListWorkspace.Root>
  );
}
