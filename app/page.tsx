import type { Metadata } from "next";
import { getPageBySlug, listCollections } from "@/lib/content/catalog";
import { getSiteVideos } from "@/lib/site-videos";
import { HomePage } from "@/components/home/home-page";

export const metadata: Metadata = {
  title: { absolute: "Synarava — Handcrafted Belarusian Couture Jewelry" },
  description:
    "Handcrafted jewelry that bridges ancient Slavic mysticism and contemporary architectural avant-garde. Explore our couture collections.",
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    images: [
      {
        url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDnsVq-0rj6MUqa5fbd7AAEe7cTiEGdTbjaX0-QqyRfQDJrorZweFoBNZ9jrp4c5G9YxZY1YWEUDZj3h6LEwB8covlq0TcBcRfzSY4jFtqnYKLYse3lFNPVEc424F0tMy1wYDp092U7vCp5UzzIntBvw7JQ59n6WrUHpbCWeChOdTgF_4v06jNFD2JXKrfMDAkHrNMfBf0IPjfNxpQZ6r8uZbhg3XInDox3KcDlWb6Aph9_5uCM04fmHM8cLz5jVaCrlmvjRqx1YyIr",
        width: 1200,
        height: 630,
        alt: "Synarava — Belarusian Couture Jewelry",
      },
    ],
  },
};

export default async function Page() {
  const [page, collectionData, videos] = await Promise.all([
    getPageBySlug("home"),
    listCollections(),
    getSiteVideos(),
  ]);

  const collections = collectionData.slice(0, 3).map((c, i) => ({
    series: c.eyebrow,
    title: c.name,
    price: i === 0 ? "€240" : i === 1 ? "€185" : "€310",
    image: c.heroImage,
    href: `/collections/${c.slug}`,
  }));

  const content = (page?.content ?? {}) as Record<string, string>;

  return (
    <HomePage
      title={page?.title}
      excerpt={page?.excerpt}
      content={content}
      collections={collections}
      heroVideoSrc={[videos.homeBeads, videos.homeModel, videos.braceletFilm, videos.materialsFilm]}
    />
  );
}
