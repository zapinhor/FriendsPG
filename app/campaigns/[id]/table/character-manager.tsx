"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Character, SceneToken } from "@/types/entities";

type Props = {
  campaignId: string;
  userId: string;
  scene: { id: string; width: number; height: number } | null;
  characters: Character[];
  members: { user_id: string; display_name: string }[];
  tokens: SceneToken[];
  onTokenCreated: (token: SceneToken) => void;
};

export function CharacterManager({
  campaignId,
  userId,
  scene,
  characters,
  members,
  tokens,
  onTokenCreated,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [controller, setController] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");

  async function createCharacter(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const { error: insertError } = await supabase.from("characters").insert({
      campaign_id: campaignId,
      name: name.trim(),
      image_url: imageUrl.trim(),
      controlled_by: controller || null,
      created_by: userId,
    });

    setBusy(false);
    if (insertError) {
      console.error(insertError);
      setError("Não foi possível criar o personagem.");
      return;
    }

    setName("");
    setImageUrl("");
    setController("");
    setShowForm(false);
    router.refresh();
  }

  async function addToken(character: Character) {
    if (!scene) return;
    setBusy(true);
    setError(null);

    const highest = tokens.reduce((value, token) => Math.max(value, token.z_index), 99);
    const { data, error: insertError } = await supabase
      .from("scene_tokens")
      .insert({
        scene_id: scene.id,
        campaign_id: campaignId,
        character_id: character.id,
        name: character.name,
        image_url: character.image_url,
        controlled_by: character.controlled_by,
        x: scene.width / 2,
        y: scene.height / 2,
        z_index: highest + 1,
        created_by: userId,
      })
      .select()
      .single();

    setBusy(false);
    if (insertError) {
      console.error(insertError);
      setError("Não foi possível adicionar o token à cena.");
      return;
    }

    onTokenCreated(data);
  }

  async function updateController(character: Character, controlledBy: string | null) {
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("characters")
      .update({ controlled_by: controlledBy })
      .eq("id", character.id)
      .eq("campaign_id", campaignId);
    setBusy(false);

    if (updateError) {
      console.error(updateError);
      setError("Não foi possível alterar o controlador.");
      return;
    }

    router.refresh();
  }

  async function updateCharacter(event: FormEvent, character: Character) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("characters")
      .update({ name: editName.trim(), image_url: editImageUrl.trim() })
      .eq("id", character.id)
      .eq("campaign_id", campaignId);
    setBusy(false);

    if (updateError) {
      console.error(updateError);
      setError("Não foi possível atualizar o personagem.");
      return;
    }

    setEditingId(null);
    router.refresh();
  }

  async function deleteCharacter(character: Character) {
    if (!window.confirm(`Excluir "${character.name}" e todos os tokens dele?`)) return;
    setBusy(true);
    setError(null);
    const { error: deleteError } = await supabase
      .from("characters")
      .delete()
      .eq("id", character.id)
      .eq("campaign_id", campaignId);
    setBusy(false);

    if (deleteError) {
      console.error(deleteError);
      setError("Não foi possível excluir o personagem.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Personagens</h2>
          <p className="mt-1 text-xs text-ink-muted">Crie personagens e coloque tokens na cena.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs hover:bg-white/10"
        >
          + Novo
        </button>
      </div>

      {showForm && (
        <form onSubmit={createCharacter} className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-2 text-xs" />
          <input required type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="URL da imagem" className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-2 text-xs" />
          <select value={controller} onChange={(event) => setController(event.target.value)} className="w-full rounded-md border border-white/10 bg-[#171820] px-2 py-2 text-xs">
            <option value="">Sem jogador</option>
            {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}
          </select>
          <button disabled={busy} className="rounded-md bg-white px-3 py-2 text-xs text-black disabled:opacity-50">{busy ? "Criando…" : "Criar personagem"}</button>
        </form>
      )}

      <div className="space-y-2">
        {characters.map((character) => (
          <div key={character.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
            <div className="flex gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={character.image_url} alt={`Retrato de ${character.name}`} className="h-10 w-10 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-white">{character.name}</p>
                <select
                  value={character.controlled_by ?? ""}
                  disabled={busy}
                  onChange={(event) => void updateController(character, event.target.value || null)}
                  className="mt-1 w-full bg-transparent text-[10px] text-ink-muted"
                >
                  <option value="">Sem jogador</option>
                  {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-3">
              <button type="button" disabled={!scene || busy} onClick={() => void addToken(character)} className="text-[11px] text-indigo-300 disabled:opacity-40">+ Token nesta cena</button>
              <button type="button" disabled={busy} onClick={() => { setEditingId(character.id); setEditName(character.name); setEditImageUrl(character.image_url); }} className="text-[11px] text-ink-muted">Editar</button>
              <button type="button" disabled={busy} onClick={() => void deleteCharacter(character)} className="text-[11px] text-red-400">Excluir</button>
            </div>

            {editingId === character.id && (
              <form onSubmit={(event) => updateCharacter(event, character)} className="mt-2 space-y-2 border-t border-white/10 pt-2">
                <input required maxLength={120} value={editName} onChange={(event) => setEditName(event.target.value)} className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs" />
                <input required type="url" value={editImageUrl} onChange={(event) => setEditImageUrl(event.target.value)} className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs" />
                <div className="flex gap-2">
                  <button disabled={busy} className="rounded bg-white px-2 py-1 text-[11px] text-black">Salvar</button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-[11px] text-ink-muted">Cancelar</button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>

      {characters.length === 0 && <p className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-ink-muted">Nenhum personagem criado.</p>}
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
