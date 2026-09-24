"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { useAdminToast } from "@/components/admin/shared/admin-toast";
import {
  AdminHelp,
  AdminPanelBody,
  AdminPanelHeader,
  AdminPanelRoot,
  AdminVideoField,
} from "@/components/synarava-cms";
import { refreshPreservingScroll } from "@/lib/admin/preserve-scroll";
import { resolveSiteVideoMimeType } from "@/lib/media/video-mime";
import type { SiteVideos } from "@/lib/site-videos";

const VIDEO_FIELDS: Array<{
  slot: keyof SiteVideos;
  label: string;
  description: string;
}> = [
  {
    slot: "homeBeads",
    label: "Home — beads",
    description: "First video in the home-page hero rotation. Replaces the Home hero image when any site video is set.",
  },
  {
    slot: "homeModel",
    label: "Home — model",
    description: "Second video in the home-page hero rotation.",
  },
  {
    slot: "braceletFilm",
    label: "Bracelet film",
    description: "Used on Home hero rotation, About hero (replaces About hero image), and product fit-film sections.",
  },
  {
    slot: "materialsFilm",
    label: "Materials film",
    description: "Used on Home hero rotation and the About page’s “On the body” section.",
  },
];

export function SiteVideosCms({ videos }: { videos: SiteVideos }) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const { pushToast } = useAdminToast();
  const [state, setState] = useState<{ error?: string }>({});
  const [isPending, setIsPending] = useState(false);

  async function submit(formData: FormData) {
    setIsPending(true);
    setState({});

    try {
      const files = VIDEO_FIELDS.flatMap(({ slot }) => {
        const file = formData.get(slot);
        return file instanceof File && file.size > 0 ? [{ slot, file }] : [];
      });
      if (files.length === 0) throw new Error("Choose at least one MP4 or WebM video to upload.");

      const uploads = await Promise.all(files.map(async ({ slot, file }) => {
        const mimeType = resolveSiteVideoMimeType({ mimeType: file.type, filename: file.name });
        if (!mimeType) {
          throw new Error(`“${file.name}” is not a supported MP4 or WebM video.`);
        }

        const preparedResponse = await fetch("/admin/api/videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "prepare",
            slot,
            filename: file.name,
            mimeType,
            sizeBytes: file.size,
          }),
        });
        const prepared = await preparedResponse.json();
        if (!preparedResponse.ok) throw new Error(prepared.error || "Could not prepare the bucket upload.");

        const uploadResponse = await fetch(prepared.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": mimeType,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
          body: file,
        });
        if (!uploadResponse.ok) throw new Error(`Bucket upload failed for ${file.name}.`);
        return prepared.upload;
      }));

      const completedResponse = await fetch("/admin/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", uploads }),
      });
      const completed = await completedResponse.json();
      if (!completedResponse.ok) throw new Error(completed.error || "Could not publish uploaded videos.");

      formRef.current?.reset();
      pushToast({ message: `${completed.count} video${completed.count === 1 ? "" : "s"} uploaded directly to Railway Bucket and published.`, tone: "success" });
      refreshPreservingScroll(router);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Video upload failed.";
      setState({ error: message });
      pushToast({ message, tone: "error" });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AdminPanelRoot data-component="SiteVideosCms">
      <AdminPanelHeader sticky={false} className="adm-band--lg">
        <div className="grid gap-3">
          <p className="adm-section-tag">[ S3 MEDIA LIBRARY ]</p>
          <h2 className="adm-title-sm">Site video</h2>
          <p className="max-w-2xl text-sm leading-6" style={{ color: "var(--adm-muted)" }}>
            Upload MP4 or WebM files directly from this browser to Railway Bucket. When a slot is set, it replaces the matching static hero image on the storefront. Replacing a video updates every placement listed under each field after cache revalidation. The bucket must allow PUT requests from this admin origin in its CORS policy.
          </p>
        </div>
      </AdminPanelHeader>

      <AdminPanelBody className="adm-inset-x grid gap-6 pb-6 pt-2">
        <AuthMessage error={state.error} />

        <form ref={formRef} action={submit} className="grid gap-0">
          {VIDEO_FIELDS.map(({ slot, label, description }, index) => (
            <div
              key={slot}
              className="grid gap-4 border-t py-6 first:border-t-0 first:pt-2 last:pb-2"
              style={{ borderColor: "var(--adm-border)" }}
              data-slot-index={index}
            >
              <AdminVideoField
                name={slot}
                label={label}
                help={<AdminHelp>{description}</AdminHelp>}
                currentVideoUrl={videos[slot] || null}
                disabled={isPending}
              />
            </div>
          ))}

          <div className="flex justify-end border-t pt-5" style={{ borderColor: "var(--adm-border)" }}>
            <button type="submit" className="adm-btn-primary" disabled={isPending}>
              {isPending ? "Uploading…" : "Upload selected videos"}
            </button>
          </div>
        </form>
      </AdminPanelBody>
    </AdminPanelRoot>
  );
}
