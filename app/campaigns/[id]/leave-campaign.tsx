"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LeaveCampaignProps = {
  campaignId: string;
  userId: string;
};

export function LeaveCampaign({
  campaignId,
  userId,
}: LeaveCampaignProps) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLeave() {
    const confirmed = window.confirm(
      "Tem certeza que deseja sair desta campanha?"
    );

    if (!confirmed) return;

    setLoading(true);
    setError(null);

    const { error } = await supabase
      .from("campaign_members")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("user_id", userId);

    setLoading(false);

    if (error) {
      setError("Não foi possível sair da campanha.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        disabled={loading}
        onClick={handleLeave}
        className="btn-secondary text-sm"
      >
        {loading ? "Saindo..." : "Sair da campanha"}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}