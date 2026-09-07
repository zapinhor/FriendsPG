"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TablePermissionsProps = {
  campaignId: string;
  canEdit: boolean;
  allowPlayerPropMovement: boolean;
};

export function TablePermissions({
  campaignId,
  canEdit,
  allowPlayerPropMovement,
}: TablePermissionsProps) {
  const router = useRouter();
  const supabase = createClient();
  const [enabled, setEnabled] = useState(allowPlayerPropMovement);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updatePermission(nextValue: boolean) {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("set_campaign_table_permissions", {
      target_campaign_id: campaignId,
      allow_player_prop_movement: nextValue,
    });
    setSaving(false);
    if (rpcError) {
      setError("Não foi possível salvar a permissão da mesa.");
      return;
    }
    setEnabled(nextValue);
    router.refresh();
  }

  return (
    <section className="panel mt-6 p-6">
      <h2 className="text-lg">Permissões da mesa</h2>
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          disabled={!canEdit || saving}
          onChange={(event) => void updatePermission(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-indigo-400"
        />
        <span>
          <span className="block">Jogadores podem mover objetos desbloqueados</span>
          <span className="mt-1 block text-xs text-ink-muted">
            Eles não podem criar, excluir, redimensionar, girar, bloquear ou mudar a ordem dos objetos.
          </span>
        </span>
      </label>
      {!canEdit && (
        <p className="mt-3 text-xs text-ink-muted">
          Apenas o dono da campanha pode alterar esta permissão.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
    </section>
  );
}
