"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Asset = {
  id: string;
  name: string;
  url: string | null;
  storage_path: string | null;
  preview_url: string | null;
};

type AssetManagerProps = {
  campaignId: string;
  assets: Asset[];
  canManage: boolean;
};

function isValidExternalUrl(value: string) {
  try {
    const parsed = new URL(value);

    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    );
  } catch {
    return false;
  }
}

export function AssetManager({
  campaignId,
  assets,
  canManage,
}: AssetManagerProps) {
  const router = useRouter();
  const supabase = createClient();

  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const [creating, setCreating] = useState(false);
  const [deletingAssetId, setDeletingAssetId] =
    useState<string | null>(null);

  const [error, setError] = useState<string | null>(
    null,
  );

  async function createAsset(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!canManage) return;

    const trimmedName = name.trim();
    const trimmedUrl = url.trim();

    if (!trimmedName) {
      setError("Informe um nome para o asset.");
      return;
    }

    if (!trimmedUrl) {
      setError("Informe o link da imagem.");
      return;
    }

    if (!isValidExternalUrl(trimmedUrl)) {
      setError(
        "Informe uma URL válida começando com http:// ou https://.",
      );
      return;
    }

    setCreating(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setCreating(false);
      setError("Sua sessão não pôde ser validada.");
      return;
    }

    const { error: insertError } = await supabase
      .from("assets")
      .insert({
        campaign_id: campaignId,
        uploaded_by: user.id,
        name: trimmedName,
        url: trimmedUrl,
      });

    setCreating(false);

    if (insertError) {
      console.error(insertError);
      setError("Não foi possível adicionar o asset.");
      return;
    }

    setName("");
    setUrl("");
    setShowForm(false);

    router.refresh();
  }

  async function deleteAsset(asset: Asset) {
    if (!canManage) return;

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o asset "${asset.name}"?`,
    );

    if (!confirmed) return;

    setDeletingAssetId(asset.id);
    setError(null);

    /*
     * Compatibilidade com os assets antigos que foram
     * enviados ao Supabase Storage durante os testes.
     */
    if (asset.storage_path) {
      const { error: storageError } =
        await supabase.storage
          .from("campaign-assets")
          .remove([asset.storage_path]);

      if (storageError) {
        console.error(storageError);
        setDeletingAssetId(null);

        setError(
          "Não foi possível excluir o arquivo antigo do Storage.",
        );

        return;
      }
    }

    const { error: databaseError } = await supabase
      .from("assets")
      .delete()
      .eq("id", asset.id)
      .eq("campaign_id", campaignId);

    setDeletingAssetId(null);

    if (databaseError) {
      console.error(databaseError);

      setError(
        "Não foi possível excluir o asset.",
      );

      return;
    }

    router.refresh();
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">
            Assets
          </h2>

          <p className="mt-1 text-xs text-ink-muted">
            Biblioteca de imagens da campanha.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowForm((current) => !current);
              setError(null);
            }}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs transition hover:bg-white/10"
          >
            + Novo
          </button>
        )}
      </div>

      {canManage && showForm && (
        <form
          onSubmit={createAsset}
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
              placeholder="Ex.: Mapa da floresta"
              required
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-muted">
              Link da imagem
            </label>

            <input
              type="url"
              value={url}
              onChange={(event) =>
                setUrl(event.target.value)
              }
              placeholder="https://..."
              required
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>

          <div className="rounded-lg border border-white/5 bg-black/20 p-3">
            <p className="text-[11px] leading-relaxed text-ink-muted">
              Dica: você pode hospedar a imagem no
              Discord e colar aqui o link direto do
              arquivo.
            </p>

            <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">
              Links externos dependem do serviço onde a
              imagem está hospedada e podem deixar de
              funcionar caso o arquivo seja removido.
            </p>
          </div>

          {url && isValidExternalUrl(url) && (
            <div className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Preview do asset"
                className="aspect-video w-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display =
                    "none";
                }}
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-white px-3 py-2 text-xs text-black disabled:opacity-50"
            >
              {creating
                ? "Adicionando..."
                : "Adicionar asset"}
            </button>

            <button
              type="button"
              disabled={creating}
              onClick={() => {
                setShowForm(false);
                setName("");
                setUrl("");
                setError(null);
              }}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/10"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {assets.length === 0 ? (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-center">
          <p className="text-xs text-ink-muted">
            Nenhum asset adicionado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]"
            >
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-black/20">
                {asset.preview_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.preview_url}
                    alt={asset.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="px-2 text-center text-xs text-ink-muted">
                    Sem preview
                  </span>
                )}
              </div>

              <div className="p-2">
                <p
                  className="truncate text-xs"
                  title={asset.name}
                >
                  {asset.name}
                </p>

                {asset.storage_path && (
                  <p className="mt-1 text-[9px] uppercase tracking-wide text-ink-muted">
                    Asset antigo
                  </p>
                )}

                {canManage && (
                  <button
                    type="button"
                    disabled={
                      deletingAssetId !== null
                    }
                    onClick={() =>
                      deleteAsset(asset)
                    }
                    className="mt-2 text-[11px] text-red-400 hover:text-red-300 disabled:opacity-40"
                  >
                    {deletingAssetId === asset.id
                      ? "Excluindo..."
                      : "Excluir"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-4 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}