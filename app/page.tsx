import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <span className="mb-6 h-px w-16 bg-ember-soft" aria-hidden />
      <h1 className="text-5xl leading-tight text-ink">
        Sua mesa, sempre pronta para a próxima sessão
      </h1>
      <p className="mt-5 max-w-xl text-ink-muted">
        Mapas, fichas, personagens e a trilha sonora da campanha, tudo no
        lugar onde seu grupo já vai se encontrar: o navegador.
      </p>
      <div className="mt-9 flex gap-3">
        <Link href="/signup">
          <Button variant="primary">Criar conta</Button>
        </Link>
        <Link href="/login">
          <Button variant="secondary">Entrar</Button>
        </Link>
      </div>
    </main>
  );
}
