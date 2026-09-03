import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CampaignRole } from "@/types/entities";
import { TableCanvas } from "./table-canvas";
import { SceneSidebar } from "./scene-sidebar";

export default async function TablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) notFound();

  const { data: membership } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("campaign_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const myRole = membership?.role as CampaignRole | undefined;
  const canManage = myRole === "owner" || myRole === "gm";

  const { data: scenes } = await supabase
    .from("scenes")
    .select("*")
    .eq("campaign_id", id)
    .order("created_at", { ascending: true });

  const allScenes = scenes ?? [];

  const activeScene =
    allScenes.find((scene) => scene.is_active) ??
    allScenes[0] ??
    null;

  const visibleScenes = canManage
    ? allScenes
    : activeScene
      ? [activeScene]
      : [];

  return (
    <main className="flex min-h-screen flex-col bg-[#0c0d12]">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div>
          <Link
            href={`/campaigns/${campaign.id}`}
            className="text-sm text-ink-muted hover:text-white"
          >
            ← Voltar para campanha
          </Link>

          <h1 className="mt-1 text-lg">{campaign.name}</h1>
        </div>

        <span className="text-xs text-ink-muted">
          FriendsPG
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <SceneSidebar
          campaignId={campaign.id}
          scenes={visibleScenes.map((scene) => ({
            id: scene.id,
            name: scene.name,
            is_active: scene.is_active,
          }))}
          canManage={canManage}
        />

        <section className="relative min-w-0 flex-1">
          <TableCanvas scene={activeScene} />
        </section>
      </div>
    </main>
  );
}