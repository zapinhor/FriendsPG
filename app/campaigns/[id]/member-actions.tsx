"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CampaignRole } from "@/types/entities";

type MemberActionsProps = {
  campaignId: string;
  userId: string;
  memberRole: CampaignRole;
  currentUserRole: CampaignRole;
};

export function MemberActions({
  campaignId,
  userId,
  memberRole,
  currentUserRole,
}: MemberActionsProps) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canChangeRole = currentUserRole === "owner" && memberRole !== "owner";

  const canRemove =
    memberRole !== "owner" &&
    (currentUserRole === "owner" ||
      (currentUserRole === "gm" && memberRole === "player"));

  async function changeRole(newRole: "gm" | "player") {
    setLoading(true);
    setError(null);

    const { error } = await supabase.rpc("set_campaign_member_role", {
      target_campaign_id: campaignId,
      target_user_id: userId,
      new_role: newRole,
    });

    setLoading(false);

    if (error) {
      setError("Não foi possível alterar a função do membro.");
      return;
    }

    router.refresh();
  }

  async function removeMember() {
    const confirmed = window.confirm(
      "Tem certeza que deseja remover este membro da campanha?"
    );

    if (!confirmed) return;

    setLoading(true);
    setError(null);

    const { error } = await supabase.rpc("remove_campaign_member", {
      target_campaign_id: campaignId,
      target_user_id: userId,
    });

    setLoading(false);

    if (error) {
      setError("Não foi possível remover o membro.");
      return;
    }

    router.refresh();
  }

  if (!canChangeRole && !canRemove) {
    return null;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {canChangeRole && memberRole === "player" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => changeRole("gm")}
            className="btn-secondary text-xs"
          >
            Promover para GM
          </button>
        )}

        {canChangeRole && memberRole === "gm" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => changeRole("player")}
            className="btn-secondary text-xs"
          >
            Rebaixar para Player
          </button>
        )}

        {canRemove && (
          <button
            type="button"
            disabled={loading}
            onClick={removeMember}
            className="btn-secondary text-xs"
          >
            Remover
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}