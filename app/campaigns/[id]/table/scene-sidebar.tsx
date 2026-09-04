"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Scene = {
  id: string;
  name: string;
  is_active: boolean;
};

type Asset = {
  id: string;
  name: string;
  preview_url: string | null;
};

type SceneSidebarProps = {
  campaignId: string;
  scenes: Scene[];
  assets: Asset[];
  canManage: boolean;
};

export function SceneSidebar({
  campaignId,
  scenes,
  assets,
  canManage,
}: SceneSidebarProps) {
  const router = useRouter();
  const supabase = createClient();

  const [loadingSceneId, setLoadingSceneId] =
    useState<string | null>(null);

  const [deletingSceneId, setDeletingSceneId] =
    useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  const [name, setName] = useState("");
  const [backgroundAssetId, setBackgroundAssetId] =
    useState("");
  const [width, setWidth] = useState("1920");
  const [height, setHeight] = useState("1080");

  const [error, setError] =
    useState<string | null>(null);

  const selectedAsset =
    assets.find(
      (asset) => asset.id === backgroundAssetId,
    ) ?? null;

  async function activateScene(sceneId: string) {
    if (!canManage) return;

    setLoadingSceneId(sceneId);
    setError(null);

    const { error } = await supabase.rpc(
      "set_active_scene",
      {
        target_campaign_id: campaignId,
        target_scene_id: sceneId,
      },
    );

    setLoadingSceneId(null);

    if (error) {
      console.error(error);
      setError("Não foi possível trocar a cena.");
      return;
    }

    router.refresh();
  }

  async function createScene(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!canManage) return;

    const parsedWidth = Number(width);
    const parsedHeight = Number(height);

    if (!name.trim()) {
      setError("Informe um nome para a cena.");
      return;
    }

    if (
      !Number.isInteger(parsedWidth) ||
      !Number.isInteger(parsedHeight) ||
      parsedWidth <= 0 ||
      parsedHeight <= 0
    ) {
      setError(
        "Largura e altura precisam ser maiores que zero.",
      );
      return;
    }

    setCreating(true);
    setError(null);

    const { error } = await supabase
      .from("scenes")
      .insert({
        campaign_id: campaignId,
        name: name.trim(),

        background_asset_id:
          backgroundAssetId || null,

        background_url: null,

        width: parsedWidth,
        height: parsedHeight,
        is_active: false,
      });

    setCreating(false);

    if (error) {
      console.error(error);
      setError("Não foi possível criar a cena.");
      return;
    }

    setName("");
    setBackgroundAssetId("");
    setWidth("1920");
    setHeight("1080");
    setShowCreateForm(false);

    router.refresh();
  }

  async function deleteScene(scene: Scene) {
    if (!canManage) return;

    if (scene.is_active) {
      setError(
        "Troque para outra cena antes de excluir a cena ativa.",
      );
      return;
    }

    if (scenes.length <= 1) {
      setError(
        "A campanha precisa ter pelo menos uma cena.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir a cena "${scene.name}"?`,
    );

    if (!confirmed) return;

    setDeletingSceneId(scene.id);
    setError(null);

    const { error } = await supabase
      .from("scenes")
      .delete()
      .eq("id", scene.id)
      .eq("campaign_id", campaignId);

    setDeletingSceneId(null);

    if (error) {
      console.error(error);
      setError("Não foi possível excluir a cena.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">
            Cenas
          </h2>

          <p className="mt-1 text-xs text-ink-muted">
            {canManage
              ? "Gerencie as cenas desta campanha."
              : "Cena atual da campanha."}
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowCreateForm(
                (current) => !current,
              );
              setError(null);
            }}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs hover:bg-white/10"
          >
            + Nova
          </button>
        )}
      </div>

      {canManage && showCreateForm && (
        <form
          onSubmit={createScene}
          className="mb-4 space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3"
        >
          <div>
            <label className="mb-1 block text-xs text-ink-muted">
              Nome
            </label>

            <input
              type="text"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="Ex.: Floresta"
              required
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-muted">
              Mapa
            </label>

            <select
              value={backgroundAssetId}
              onChange={(event) =>
                setBackgroundAssetId(
                  event.target.value,
                )
              }
              className="w-full rounded-lg border border-white/10 bg-[#15171e] px-3 py-2 text-sm outline-none focus:border-white/30"
            >
              <option value="">
                Sem mapa
              </option>

              {assets.map((asset) => (
                <option
                  key={asset.id}
                  value={asset.id}
                >
                  {asset.name}
                </option>
              ))}
            </select>
          </div>

          {selectedAsset?.preview_url && (
            <div className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedAsset.preview_url}
                alt={selectedAsset.name}
                className="aspect-video w-full object-cover"
              />
            </div>
          )}

          {assets.length === 0 && (
            <p className="text-[10px] leading-relaxed text-ink-muted">
              Nenhum asset disponível. Adicione uma
              imagem na aba Assets primeiro.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-ink-muted">
                Largura
              </label>

              <input
                type="number"
                min="1"
                value={width}
                onChange={(event) =>
                  setWidth(event.target.value)
                }
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-ink-muted">
                Altura
              </label>

              <input
                type="number"
                min="1"
                value={height}
                onChange={(event) =>
                  setHeight(event.target.value)
                }
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-white px-3 py-2 text-xs text-black disabled:opacity-50"
            >
              {creating
                ? "Criando..."
                : "Criar cena"}
            </button>

            <button
              type="button"
              onClick={() =>
                setShowCreateForm(false)
              }
              disabled={creating}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/10"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {scenes.length === 0 && (
          <p className="text-xs text-ink-muted">
            Nenhuma cena criada.
          </p>
        )}

        {scenes.map((scene) => (
          <div
            key={scene.id}
            className={[
              "rounded-lg border p-2",
              scene.is_active
                ? "border-white/20 bg-white/10"
                : "border-white/5 bg-white/[0.03]",
            ].join(" ")}
          >
            <button
              type="button"
              disabled={
                !canManage ||
                loadingSceneId !== null ||
                scene.is_active
              }
              onClick={() =>
                activateScene(scene.id)
              }
              className={[
                "w-full px-1 py-1 text-left text-sm",
                canManage &&
                !scene.is_active
                  ? "cursor-pointer"
                  : "cursor-default",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <span>{scene.name}</span>

                {scene.is_active && (
                  <span className="text-[10px] uppercase text-ink-muted">
                    Ativa
                  </span>
                )}
              </div>

              {loadingSceneId === scene.id && (
                <span className="mt-1 block text-xs text-ink-muted">
                  Trocando...
                </span>
              )}
            </button>

            {canManage && (
              <div className="mt-2 flex gap-2 border-t border-white/5 pt-2">
                {!scene.is_active && (
                  <button
                    type="button"
                    disabled={
                      loadingSceneId !== null
                    }
                    onClick={() =>
                      activateScene(scene.id)
                    }
                    className="text-xs text-ink-muted hover:text-white"
                  >
                    Ativar
                  </button>
                )}

                <button
                  type="button"
                  disabled={
                    deletingSceneId !== null ||
                    scene.is_active
                  }
                  onClick={() =>
                    deleteScene(scene)
                  }
                  className="text-xs text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deletingSceneId === scene.id
                    ? "Excluindo..."
                    : "Excluir"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-4 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}