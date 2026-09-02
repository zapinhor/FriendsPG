import Link from "next/link";

export default function CheckEmailPage() {
  return <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 text-center">
    <h1 className="text-3xl">Confirme seu e-mail</h1>
    <p className="mt-3 text-sm text-ink-muted">Enviamos um link de confirmação. Depois de confirmar, sua conta estará pronta para entrar.</p>
    <Link href="/login" className="btn-primary mt-8">Voltar ao login</Link>
  </main>;
}
