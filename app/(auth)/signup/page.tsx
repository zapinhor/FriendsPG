"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: displayName,
        },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(
        signUpError.message.includes("already registered")
          ? "Este e-mail ou nome de usuário já está em uso."
          : signUpError.message.includes("username_taken") || signUpError.message.includes("Database error")
          ? "Este nome de usuário já está em uso."
          : "Não foi possível criar a conta. Tente novamente."
      );
      return;
    }

    router.push(data.session ? "/dashboard" : "/signup/check-email");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-3xl">Criar conta</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Leva menos de um minuto.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Input
          label="Nome de exibição"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Como o grupo vai te ver na mesa"
        />
        <Input
          label="Nome de usuário"
          required
          pattern="[a-z0-9_]{3,20}"
          title="3 a 20 caracteres: letras minúsculas, números e underline"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          placeholder="ex: danilo_gm"
        />
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Senha"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="Mínimo de 8 caracteres."
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Criando conta…" : "Criar conta"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        Já tem conta?{" "}
        <Link href="/login" className="text-arcane hover:underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
