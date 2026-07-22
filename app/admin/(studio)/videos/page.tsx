import { SiteVideosCms } from "@/components/admin/site-videos-cms";
import { getSiteVideos } from "@/lib/site-videos";

export default async function AdminVideosPage() {
  const videos = await getSiteVideos();

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // VID ]</p>
        <h1 className="adm-page-title">Videos</h1>
        <p className="adm-page-subtitle">
          Upload and replace every storefront video in S3.
        </p>
      </div>
      <SiteVideosCms videos={videos} />
    </div>
  );
}
