"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthMessage } from "@/components/auth/auth-form-primitives";
import { useAdminToast } from "@/components/admin/admin-toast";
import type { SiteVideos } from "@/lib/site-videos";

const VIDEO_FIELDS: Array<{
  slot: keyof SiteVideos;
  label: string;
  description: string;
}> = [
  { slot: "homeBeads", label: "Home — beads", description: "First video in the home-page hero rotation." },
  { slot: "homeModel", label: "Home — model", description: "Second video in the home-page hero rotation." },
  { slot: "braceletFilm", label: "Bracelet film", description: "Used on Home, About hero, and product fit-film sections." },
  { slot: "materialsFilm", label: "Materials film", description: "Used on Home and the About page's “On the body” section." },
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
        const preparedResponse = await fetch("/admin/api/videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "prepare",
            slot,
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          }),
        });
        const prepared = await preparedResponse.json();
        if (!preparedResponse.ok) throw new Error(prepared.error || "Could not prepare the bucket upload.");

        const uploadResponse = await fetch(prepared.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
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
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Video upload failed.";
      setState({ error: message });
      pushToast({ message, tone: "error" });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="adm-panel grid gap-6 p-5 md:p-6">
      <div className="grid gap-2">
        <p className="adm-section-tag">[ S3 MEDIA LIBRARY ]</p>
        <h2 className="adm-title-sm">Storefront video</h2>
        <p className="max-w-2xl text-sm leading-6" style={{ color: "var(--adm-muted)" }}>
          Upload MP4 or WebM files directly from this browser to Railway Bucket. Replacing a video changes every storefront placement listed below after cache revalidation. The bucket must allow PUT requests from this admin origin in its CORS policy.
        </p>
      </div>

      <AuthMessage error={state.error} />

      <form ref={formRef} action={submit} className="grid gap-5">
        {VIDEO_FIELDS.map(({ slot, label, description }) => (
          <fieldset key={slot} className="grid gap-3 border-t pt-5" style={{ borderColor: "var(--adm-border)" }}>
            <div className="grid gap-1 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-6">
              <div>
                <legend className="adm-label">{label}</legend>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--adm-muted)" }}>{description}</p>
              </div>
              <p className="break-all text-xs md:max-w-sm" style={{ color: "var(--adm-muted)" }}>
                Current: {videos[slot]}
              </p>
            </div>
            {videos[slot] ? (
              <video className="aspect-video max-h-52 w-full rounded object-cover md:max-w-md" src={videos[slot]} muted playsInline preload="metadata" />
            ) : (
              <div className="grid aspect-video max-h-52 w-full place-items-center rounded border text-xs uppercase tracking-[0.12em] md:max-w-md" style={{ borderColor: "var(--adm-border)", color: "var(--adm-muted)" }}>
                No video uploaded
              </div>
            )}
            <input
              name={slot}
              type="file"
              accept="video/mp4,video/webm"
              className="adm-field"
              disabled={isPending}
            />
          </fieldset>
        ))}

        <div className="flex justify-end pt-2">
          <button type="submit" className="adm-btn-primary" disabled={isPending}>
            {isPending ? "Uploading…" : "Upload selected videos"}
          </button>
        </div>
      </form>
    </section>
  );
}
