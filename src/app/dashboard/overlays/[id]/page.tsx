import { redirect } from "next/navigation";

/** The customizer moved to /studio/<id> (full screen); keep old links working. */
export default async function OldOverlayPage({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/studio/${(await params).id}`);
}
