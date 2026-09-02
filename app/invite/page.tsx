"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export default function InviteEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    let normalized = trimmed;
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      const inviteIndex = parts.lastIndexOf("invite");
      const urlCode = parts[inviteIndex + 1];
      if (inviteIndex >= 0 && urlCode) normalized = urlCode;
    } catch {
      const match = trimmed.match(/(?:^|\/)invite\/([^/?#]+)/i);
      const capturedCode = match?.[1];
      if (capturedCode) normalized = capturedCode;
    }
    router.push(`/invite/${encodeURIComponent(normalized.trim())}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-3xl">Entrar com convite</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Cole o código ou link que o Mestre te enviou.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Input
          label="Código do convite"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Ex: ABC123"
        />
        <Button type="submit" className="w-full">
          Continuar
        </Button>
      </form>
    </main>
  );
}
