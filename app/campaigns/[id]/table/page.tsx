import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CampaignRole } from "@/types/entities";
import { TableWorkspace } from "./table-workspace";

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

  if (!user) {
    redirect("/login");
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) {
    notFound();
  }

  const { data: membership } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("campaign_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const myRole =
    membership?.role as CampaignRole | undefined;

  const canManage =
    myRole === "owner" ||
    myRole === "gm";

  const { data: scenes } = await supabase
    .from("scenes")
    .select("*")
    .eq("campaign_id", id)
    .order("created_at", {
      ascending: true,
    });

  const allScenes = scenes ?? [];

  const activeScene =
    allScenes.find(
      (scene) => scene.is_active,
    ) ??
    allScenes[0] ??
    null;

  /*
   * Apenas Owner/GM carregam a biblioteca completa.
   *
   * Player não possui permissão de SELECT
   * na tabela assets.
   */
  let assetsWithPreview: {
    id: string;
    name: string;
    url: string | null;
    storage_path: string | null;
    preview_url: string | null;
  }[] = [];

  if (canManage) {
    const { data: assets } = await supabase
      .from("assets")
      .select(
        "id, name, url, storage_path",
      )
      .eq("campaign_id", id)
      .order("created_at", {
        ascending: false,
      });

    assetsWithPreview =
      await Promise.all(
        (assets ?? []).map(
          async (asset) => {
            if (asset.url) {
              return {
                ...asset,
                preview_url: asset.url,
              };
            }

            if (asset.storage_path) {
              const { data } =
                await supabase.storage
                  .from("campaign-assets")
                  .createSignedUrl(
                    asset.storage_path,
                    60 * 60,
                  );

              return {
                ...asset,
                preview_url:
                  data?.signedUrl ?? null,
              };
            }

            return {
              ...asset,
              preview_url: null,
            };
          },
        ),
      );
  }

  let resolvedBackgroundUrl:
    | string
    | null = null;

  if (activeScene) {
    if (canManage) {
      /*
       * Owner/GM já possuem a biblioteca
       * carregada, então resolvemos localmente.
       */
      if (
        activeScene.background_asset_id
      ) {
        const backgroundAsset =
          assetsWithPreview.find(
            (asset) =>
              asset.id ===
              activeScene.background_asset_id,
          );

        resolvedBackgroundUrl =
          backgroundAsset?.preview_url ??
          activeScene.background_url ??
          null;
      } else {
        resolvedBackgroundUrl =
          activeScene.background_url ??
          null;
      }
    } else {
      /*
       * Player recebe apenas a URL necessária
       * para renderizar a Scene disponível.
       */
      const { data: backgroundUrl } =
        await supabase.rpc(
          "get_scene_background_url",
          {
            target_scene_id:
              activeScene.id,
          },
        );

      resolvedBackgroundUrl =
        backgroundUrl ?? null;
    }
  }

  const resolvedActiveScene =
    activeScene
      ? {
          ...activeScene,
          background_url:
            resolvedBackgroundUrl,
        }
      : null;

  const visibleScenes = canManage
    ? allScenes
    : activeScene
      ? [activeScene]
      : [];

  const { data: sceneProps } = activeScene
    ? await supabase
        .from("scene_props")
        .select("*")
        .eq("scene_id", activeScene.id)
        .order("z_index", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <main className="flex min-h-screen flex-col bg-[#0c0d12]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-6">
        <div className="flex items-center gap-5">
          <Link
            href={`/campaigns/${campaign.id}`}
            className="text-sm text-ink-muted transition hover:text-white"
          >
            ← Voltar para campanha
          </Link>

          <div className="h-5 w-px bg-white/10" />

          <h1 className="font-medium">
            {campaign.name}
          </h1>
        </div>

        <span className="text-sm text-ink-muted">
          FriendsPG
        </span>
      </header>

      <TableWorkspace
          key={resolvedActiveScene?.id ?? "empty-scene"}
          campaignId={campaign.id}
          userId={user.id}
          scene={resolvedActiveScene}
          scenes={visibleScenes.map(
            (scene) => ({
              id: scene.id,
              name: scene.name,
              is_active:
                scene.is_active,
            }),
          )}
          assets={assetsWithPreview}
          initialProps={sceneProps ?? []}
          canManage={canManage}
      />
    </main>
  );
}
