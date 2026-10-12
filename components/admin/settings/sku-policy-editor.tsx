"use client";

import { useState, useTransition } from "react";

import {
  publishSkuPolicyAction,
  saveSkuPolicyDraftAction,
  type SkuPolicyEditorPayload,
} from "@/app/admin/actions/sku-policy";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  AdminAlert,
  AdminLongTextField,
  AdminPanel,
  AdminReadonlyField,
  AdminSectionTabs,
  AdminStatusBadge,
  AdminTextField,
} from "@/components/synarava-cms";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "assignments", label: "Assignments" },
  { id: "audit", label: "Audit" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function SkuPolicyEditor({ initial }: { initial: SkuPolicyEditorPayload }) {
  const { pushToast } = useAdminToast();
  const [isPending, startTransition] = useTransition();
  const [section, setSection] = useState<SectionId>("profile");
  const [error, setError] = useState<string | null>(null);
  const latest = initial.profiles[0];
  const [version, setVersion] = useState(String(latest?.version ?? 1));
  const [separator, setSeparator] = useState(latest?.separator ?? "-");
  const [suffixWidth, setSuffixWidth] = useState(String(latest?.suffixWidth ?? 3));
  const [allowedCharacters, setAllowedCharacters] = useState(
    latest?.allowedCharacters ?? "^[A-Z0-9]+(-[A-Z0-9.]+)*$",
  );
  const [familiesJson, setFamiliesJson] = useState(
    latest?.familiesJson ?? "{\n  \"jewelry.necklace\": \"JW-NECK\"\n}",
  );

  if (!initial.configured) {
    return (
      <AdminPanel.Root id="shared-sku-policy">
        <AdminPanel.Header className="adm-panel__header--ruled">
          <div className="adm-inset-x py-3">
            <p className="adm-section-tag mb-1">[ SYN-ADM // SKU POLICY ]</p>
            <h2 className="text-base font-medium">Portable SKU policy</h2>
          </div>
        </AdminPanel.Header>
        <AdminPanel.Body>
          <div className="adm-inset-x py-4 space-y-3">
            <AdminAlert
              message={`SKU service is not configured in this environment (${initial.reason}). Set server-only SKU_API_URL and SKU_API_TOKEN after the staging gate. Browser never receives the service secret.`}
            />
            <AdminReadonlyField label="Workspace" value="synarava-shop" owner="Synarava" />
          </div>
        </AdminPanel.Body>
      </AdminPanel.Root>
    );
  }

  function saveDraft() {
    setError(null);
    startTransition(async () => {
      const result = await saveSkuPolicyDraftAction({
        version: Number(version),
        separator,
        suffixWidth: Number(suffixWidth),
        allowedCharacters,
        familiesJson,
      });
      if (!result.ok) {
        setError(result.error ?? "Save failed");
        return;
      }
      pushToast({ tone: "success", message: result.message ?? "Draft saved" });
    });
  }

  function publish() {
    setError(null);
    startTransition(async () => {
      const result = await publishSkuPolicyAction(Number(version));
      if (!result.ok) {
        setError(result.error ?? "Publish failed");
        return;
      }
      pushToast({ tone: "success", message: result.message ?? "Published" });
    });
  }

  return (
    <AdminPanel.Root id="shared-sku-policy">
      <AdminPanel.Header className="adm-panel__header--ruled">
        <div className="adm-inset-x py-3 flex items-start justify-between gap-4">
          <div>
            <p className="adm-section-tag mb-1">[ SYN-ADM // SKU POLICY ]</p>
            <h2 className="text-base font-medium">Portable SKU policy</h2>
            <p className="text-sm opacity-70 mt-1">
              Business Owner: draft/publish versioned profiles. Runtime is sku-api, not Notion.
            </p>
          </div>
          <AdminStatusBadge tone="draft">{initial.workspaceKey}</AdminStatusBadge>
        </div>
      </AdminPanel.Header>
      <AdminPanel.Body>
        <AdminSectionTabs
          embedded
          items={SECTIONS.map((item) => ({ id: item.id, label: item.label }))}
          active={section}
          onChange={(id) => setSection(id as SectionId)}
        />
        <div className="adm-inset-x py-4 space-y-4">
          {error ? <AdminAlert message={error} /> : null}

          {section === "profile" ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <AdminTextField
                  label="Version"
                  value={version}
                  onChange={(event) => setVersion(event.target.value)}
                  owner="Synarava"
                />
                <AdminTextField
                  label="Separator"
                  value={separator}
                  onChange={(event) => setSeparator(event.target.value)}
                  owner="Synarava"
                />
                <AdminTextField
                  label="Suffix width"
                  value={suffixWidth}
                  onChange={(event) => setSuffixWidth(event.target.value)}
                  owner="Synarava"
                />
              </div>
              <AdminTextField
                label="Allowed characters (regex)"
                value={allowedCharacters}
                onChange={(event) => setAllowedCharacters(event.target.value)}
                owner="Synarava"
              />
              <AdminLongTextField
                label="Families JSON"
                value={familiesJson}
                onChange={setFamiliesJson}
                owner="Synarava"
                rows={10}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="adm-btn-secondary"
                  disabled={isPending}
                  onClick={saveDraft}
                >
                  Save draft
                </button>
                <button
                  type="button"
                  className="adm-btn-primary"
                  disabled={isPending}
                  onClick={publish}
                >
                  Publish version
                </button>
              </div>
              {initial.profiles.length > 0 ? (
                <ul className="text-sm space-y-1 opacity-80">
                  {initial.profiles.map((profile) => (
                    <li key={profile.version}>
                      v{profile.version} — {profile.status}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}

          {section === "assignments" ? (
            <div className="space-y-2">
              {initial.assignments.length === 0 ? (
                <p className="text-sm opacity-70">No assignments yet.</p>
              ) : (
                initial.assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--adm-rule)] py-2 text-sm"
                  >
                    <span className="font-mono">{assignment.sku}</span>
                    <span>
                      {assignment.source} · {assignment.status} · {assignment.lockState}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {section === "audit" ? (
            <div className="space-y-2">
              {initial.auditEvents.length === 0 ? (
                <p className="text-sm opacity-70">No audit events yet.</p>
              ) : (
                initial.auditEvents.map((event) => (
                  <div
                    key={event.id}
                    className="border-b border-[color:var(--adm-rule)] py-2 text-sm"
                  >
                    <div className="font-medium">
                      {event.action} · {event.actor}
                    </div>
                    <div className="opacity-70">
                      {event.createdAt} · {event.correlationId}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </AdminPanel.Body>
    </AdminPanel.Root>
  );
}
