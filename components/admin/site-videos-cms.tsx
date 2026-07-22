"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveSiteVideosAction, type SiteVideosActionState } from "@/app/admin/actions";
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
  const [state, setState] = useState<SiteVideosActionState>({});
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await saveSiteVideosAction(formData);
      setState(result);
      if (result.error) {
        pushToast({ message: result.error, tone: "error" });
        return;
      }
      if (result.success) {
        formRef.current?.reset();
        pushToast({ message: result.success, tone: "success" });
        router.refresh();
      }
    });
  }

  return (
    <section className="adm-panel grid gap-6 p-5 md:p-6">
      <div className="grid gap-2">
        <p className="adm-section-tag">[ S3 MEDIA LIBRARY ]</p>
        <h2 className="adm-title-sm">Storefront video</h2>
        <p className="max-w-2xl text-sm leading-6" style={{ color: "var(--adm-muted)" }}>
          Upload MP4 or WebM files directly to the configured S3 bucket. Replacing a video changes every storefront placement listed below after cache revalidation.
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
            <video className="aspect-video max-h-52 w-full rounded object-cover md:max-w-md" src={videos[slot]} muted playsInline preload="metadata" />
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
