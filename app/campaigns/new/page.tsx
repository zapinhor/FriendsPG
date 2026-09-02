"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemName, setSystemName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

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
      .from("campaigns")
      .insert({
        name,
        description: description || null,
        system_name: systemName || null,
        owner_id: user.id,
      })
      .select("id")
      .single();

    setLoading(false);

    if (insertError || !data) {
      setError("Não foi possível criar a campanha. Tente novamente.");
      return;
    }

    router.push(`/campaigns/${data.id}`);
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="text-3xl">Criar campanha</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Você será o Mestre desta mesa. Dá para ajustar tudo depois.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Input
          label="Nome da campanha"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: As Ruínas de Var'thak"
        />
        <Textarea
          label="Descrição"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Uma frase para lembrar o grupo do que se trata."
        />
        <Input
          label="Sistema"
          value={systemName}
          onChange={(e) => setSystemName(e.target.value)}
          placeholder="Ex: D&D 5e, Tormenta20, homebrew…"
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Criando…" : "Criar campanha"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </main>
  );
}
