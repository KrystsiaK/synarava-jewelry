"use client";

import { AlertTriangle, ArrowLeft, Info, Lightbulb } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { AdminCollapsiblePanel } from "@/components/admin/shared/admin-collapsible-panel";
import { AdminPanel } from "@/components/admin/shared/admin-panel";
import { AdminStatusBadge } from "@/components/admin/shared/admin-status-badge";
import type { HelpArticle } from "@/lib/admin/help-docs";
import { headingId } from "@/lib/admin/help-docs-shared";

type CustomBlockType = "note" | "warning" | "good-to-know" | "steps" | "what-if" | "diagram";
type ArticleSegment =
  | { type: "markdown"; content: string }
  | { type: CustomBlockType; content: string; attributes: Record<string, string> };

const GLOSSARY: Record<string, string> = {
  sync: "A check and transfer between the Synarava copy and Shopify. Save and Sync are separate actions.",
  draft: "Hidden from the storefront. The product remains available for editing in the admin.",
  published: "Visible on the storefront when all required product information is present.",
};

function parseAttributes(value: string): Record<string, string> {
  return Object.fromEntries(
    Array.from(value.matchAll(/([a-z-]+)=(?:"([^"]*)"|'([^']*)'|([^\s]+))/g), (match) => [
      match[1],
      match[2] ?? match[3] ?? match[4] ?? "",
    ]),
  );
}

export function parseHelpBlocks(source: string): ArticleSegment[] {
  const lines = source.split("\n");
  const segments: ArticleSegment[] = [];
  let markdown: string[] = [];

  function flushMarkdown() {
    const content = markdown.join("\n").trim();
    if (content) segments.push({ type: "markdown", content });
    markdown = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const opening = lines[index].match(/^:::(note|warning|good-to-know|steps|what-if|diagram)(?:\s+(.*))?$/);
    if (!opening) {
      markdown.push(lines[index]);
      continue;
    }

    flushMarkdown();
    const body: string[] = [];
    index += 1;
    while (index < lines.length && lines[index].trim() !== ":::") {
      body.push(lines[index]);
      index += 1;
    }
    segments.push({
      type: opening[1] as CustomBlockType,
      content: body.join("\n").trim(),
      attributes: parseAttributes(opening[2] ?? ""),
    });
  }
  flushMarkdown();
  return segments;
}

function safeAssetUrl(src: string | undefined): string {
  if (!src) return "";
  const match = src.match(/^assets\/([a-z0-9-]+\.(?:avif|gif|jpe?g|png|webp))$/i);
  return match ? `/admin/help/assets/${match[1]}` : "";
}

function helpUrlTransform(url: string, key: string): string {
  if (key === "src") return safeAssetUrl(url);
  if (url.startsWith("glossary:")) return url;
  return defaultUrlTransform(url);
}

const markdownComponents: Components = {
  h2: ({ children }) => {
    const label = String(children);
    return <h2 id={headingId(label)}>{children}</h2>;
  },
  table: ({ children }) => (
    <div className="adm-help-table-scroll" tabIndex={0}>
      <table>{children}</table>
    </div>
  ),
  a: ({ href, children }) => {
    if (href?.startsWith("glossary:")) {
      const term = href.slice("glossary:".length).toLowerCase();
      const explanation = GLOSSARY[term];
      return explanation ? (
        <abbr className="adm-help-glossary" tabIndex={0} title={explanation}>
          {children}
          <span role="tooltip">{explanation}</span>
        </abbr>
      ) : (
        <>{children}</>
      );
    }
    const external = Boolean(href && /^https?:\/\//.test(href));
    return (
      <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {children}
      </a>
    );
  },
  img: ({ src, alt }) => {
    const safeSrc = safeAssetUrl(typeof src === "string" ? src : undefined);
    return safeSrc ? (
      // Authenticated documentation images are served by the allowlisted asset route.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={safeSrc} alt={alt ?? ""} loading="lazy" />
    ) : null;
  },
};

function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
      urlTransform={helpUrlTransform}
      skipHtml
    >
      {children}
    </ReactMarkdown>
  );
}

function Callout({ type, content }: { type: "note" | "warning" | "good-to-know"; content: string }) {
  const labels = { note: "Good to know", warning: "Warning", "good-to-know": "Good to know" };
  const Icon = type === "warning" ? AlertTriangle : type === "note" ? Info : Lightbulb;
  return (
    <aside className="adm-help-callout" data-tone={type}>
      <div className="adm-help-callout__label">
        <Icon aria-hidden="true" />
        <span>{labels[type]}</span>
      </div>
      <div className="adm-help-callout__body"><Markdown>{content}</Markdown></div>
    </aside>
  );
}

function splitTitledItems(content: string): Array<{ title: string; body: string }> {
  const matches = Array.from(content.matchAll(/^###\s+(.+)$/gm));
  return matches.map((match, index) => ({
    title: match[1].trim(),
    body: content.slice((match.index ?? 0) + match[0].length, matches[index + 1]?.index).trim(),
  }));
}

function StepsBlock({ content }: { content: string }) {
  const steps = splitTitledItems(content);
  return (
    <ol className="adm-help-steps" aria-label={`${steps.length} steps`}>
      {steps.map((step, index) => (
        <li className="adm-help-step" key={step.title}>
          <div className="adm-help-step__number" aria-hidden="true">{index + 1}</div>
          <div className="adm-help-step__content">
            <p className="adm-help-step__progress">Step {index + 1} of {steps.length}</p>
            <h3>{step.title}</h3>
            <Markdown>{step.body}</Markdown>
          </div>
        </li>
      ))}
    </ol>
  );
}

function WhatIfBlock({ content }: { content: string }) {
  const cases = splitTitledItems(content);
  return (
    <div className="adm-help-what-if">
      {cases.map((item) => (
        <AdminCollapsiblePanel
          key={item.title}
          title={item.title}
          className="adm-help-what-if__item"
          bodyClassName="adm-help-what-if__body"
        >
          <Markdown>{item.body}</Markdown>
        </AdminCollapsiblePanel>
      ))}
    </div>
  );
}

function HowItWorksDiagram({ name, label }: { name?: string; label?: string }) {
  const productOwnership = name === "product-ownership";
  const diagramId = useId().replace(/:/g, "");
  const titleId = `${diagramId}-title`;
  const captionId = `${diagramId}-caption`;
  const desktopMarkerId = `${diagramId}-arrow-desktop`;
  const mobileMarkerId = `${diagramId}-arrow-mobile`;
  return (
    <figure className="adm-help-diagram" aria-labelledby={`${titleId} ${captionId}`}>
      <div className="adm-help-diagram__heading">
        <p id={titleId}>How it works</p>
        <span>{label ?? (productOwnership ? "One product, two clear owners" : "Synarava and Shopify")}</span>
      </div>
      <div role="img" aria-label="Information moves between Synarava and Shopify through separate Save and Sync actions">
      <svg className="adm-help-diagram__desktop" viewBox="0 0 760 220" aria-hidden="true" focusable="false">
        <defs>
          <marker id={desktopMarkerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>
        <rect x="24" y="42" width="240" height="136" rx="18" />
        <text x="48" y="82" className="adm-help-diagram__label">SYNARAVA</text>
        <text x="48" y="116">Editorial product details</text>
        <text x="48" y="145">Save keeps local work</text>
        <rect x="496" y="42" width="240" height="136" rx="18" />
        <text x="520" y="82" className="adm-help-diagram__label">SHOPIFY</text>
        <text x="520" y="116">Commerce product data</text>
        <text x="520" y="145">Sync checks each field</text>
        <path d="M 286 88 C 346 50, 414 50, 474 88" markerEnd={`url(#${desktopMarkerId})`} />
        <path d="M 474 142 C 414 180, 346 180, 286 142" markerEnd={`url(#${desktopMarkerId})`} />
        <text x="380" y="62" textAnchor="middle" className="adm-help-diagram__action">PUSH</text>
        <text x="380" y="182" textAnchor="middle" className="adm-help-diagram__action">PULL</text>
      </svg>
      <svg className="adm-help-diagram__mobile" viewBox="0 0 340 430" aria-hidden="true" focusable="false">
        <defs>
          <marker id={mobileMarkerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>
        <rect x="20" y="24" width="300" height="132" rx="18" />
        <text x="44" y="64" className="adm-help-diagram__label">SYNARAVA</text>
        <text x="44" y="99">Editorial product details</text>
        <text x="44" y="128">Save keeps local work</text>
        <path d="M 138 176 C 120 206, 120 224, 138 250" markerEnd={`url(#${mobileMarkerId})`} />
        <path d="M 202 250 C 220 224, 220 206, 202 176" markerEnd={`url(#${mobileMarkerId})`} />
        <text x="104" y="219" textAnchor="middle" className="adm-help-diagram__action">PUSH</text>
        <text x="236" y="219" textAnchor="middle" className="adm-help-diagram__action">PULL</text>
        <rect x="20" y="274" width="300" height="132" rx="18" />
        <text x="44" y="314" className="adm-help-diagram__label">SHOPIFY</text>
        <text x="44" y="349">Commerce product data</text>
        <text x="44" y="378">Sync checks each field</text>
      </svg>
      </div>
      <figcaption id={captionId}>Save records your full product locally. Sync compares or transfers Shopify-owned fields.</figcaption>
    </figure>
  );
}

export type AdminHelpArticleProps = { article: HelpArticle };

export function AdminHelpArticle({ article }: AdminHelpArticleProps) {
  const segments = parseHelpBlocks(article.body);
  const statusLabel = article.status === "verified"
    ? `Verified ${article.verifiedOn}`
    : "Draft, not verified yet";

  return (
    <div className="adm-help-article-shell">
      <div className="adm-help-article-topline">
        <Link href="/admin/help" className="adm-btn-ghost">
          <ArrowLeft aria-hidden="true" />
          All help articles
        </Link>
      </div>

      <AdminPanel.Root className="adm-help-article">
        <AdminPanel.Header className="adm-panel__header--ruled adm-help-article__header">
          <div>
            <h1 className="adm-help-article__title">{article.title}</h1>
            <div className="adm-help-article__meta">
              <span>{article.section} help article</span>
              <AdminStatusBadge tone={article.status === "verified" ? "published" : "draft"}>
                {statusLabel}
              </AdminStatusBadge>
              <span>Last checked {article.updatedOn}</span>
            </div>
          </div>
        </AdminPanel.Header>

        <AdminPanel.Body className="adm-help-article__body">
          <nav className="adm-help-toc" aria-label="On this page">
            <p>On this page</p>
            <ol>
              {article.headings.map((heading) => (
                <li key={heading.id}><a href={`#${heading.id}`}>{heading.label}</a></li>
              ))}
            </ol>
          </nav>

          <article className="adm-help-prose">
            {segments.map((segment, index) => {
              const key = `${segment.type}-${index}`;
              if (segment.type === "markdown") return <Markdown key={key}>{segment.content}</Markdown>;
              if (segment.type === "note" || segment.type === "warning" || segment.type === "good-to-know") {
                return <Callout key={key} type={segment.type} content={segment.content} />;
              }
              if (segment.type === "steps") return <StepsBlock key={key} content={segment.content} />;
              if (segment.type === "what-if") return <WhatIfBlock key={key} content={segment.content} />;
              return <HowItWorksDiagram key={key} name={segment.attributes.name} label={segment.attributes.label} />;
            })}
          </article>
        </AdminPanel.Body>
      </AdminPanel.Root>
    </div>
  );
}
