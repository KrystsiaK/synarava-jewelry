import { permanentRedirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LegacyArtifactRedirect({ params }: Props) {
  const { id } = await params;
  permanentRedirect(`/products/${id}`);
}
