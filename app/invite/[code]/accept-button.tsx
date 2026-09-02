"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function AcceptInviteButton({ code }: { code: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: campaignId, error: rpcError } = await supabase.rpc(
      "accept_invite",
      { invite_code: code }
    );

    setLoading(false);

    if (rpcError || !campaignId) {
      setError("Não foi possível entrar na campanha. O convite pode ter expirado.");
      return;
    }

    router.push(`/campaigns/${campaignId}`);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleAccept} disabled={loading} className="w-full">
        {loading ? "Entrando…" : "Entrar na campanha"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
