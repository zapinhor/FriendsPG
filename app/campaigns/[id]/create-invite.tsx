"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function CreateInvite({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Sessão expirada. Entre novamente.");
      setLoading(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("campaign_invites")
      .insert({ campaign_id: campaignId, created_by: user.id })
      .select("code")
      .single();

    setLoading(false);

    if (insertError || !data) {
      setError("Não foi possível gerar o convite.");
      return;
    }

    setLink(`${window.location.origin}/invite/${data.code}`);
    router.refresh();
  }

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      {!link ? (
        <Button onClick={handleCreate} disabled={loading} variant="secondary">
          {loading ? "Gerando…" : "Gerar link de convite"}
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <code className="input-field flex-1 truncate text-xs">{link}</code>
          <Button onClick={handleCopy} variant="secondary">
            {copied ? "Copiado!" : "Copiar"}
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
