import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteButton } from "./accept-button";
import type { InvitePreview } from "@/types/entities";

export default async function InvitePreviewPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const [{ data: preview }, { data: userData }] = await Promise.all([
    supabase.rpc("preview_invite", { invite_code: code }).single(),
    supabase.auth.getUser(),
  ]);

  const invite = preview as InvitePreview | null;
  const user = userData.user;

  if (!invite || !invite.campaign_id) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl">Convite não encontrado</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Confira o código com quem te enviou o convite.
        </p>
      </main>
    );
  }

  if (!invite.valid) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl">Convite expirado</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Peça ao Mestre um novo link de convite para {invite.campaign_name}.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="panel p-6">
        <span className="text-xs text-ink-muted">Convite para</span>
        <h1 className="mt-1 text-3xl">{invite.campaign_name}</h1>
        {invite.campaign_description && (
          <p className="mt-2 text-sm text-ink-muted">
            {invite.campaign_description}
          </p>
        )}
        {invite.gm_display_name && (
          <p className="mt-3 text-sm text-ink-muted">
            Mestrado por {invite.gm_display_name}
          </p>
        )}

        <div className="mt-6">
          {user ? (
            <AcceptInviteButton code={code} />
          ) : (
            <Link
              href={`/login?next=/invite/${encodeURIComponent(code)}`}
              className="btn-primary block text-center"
            >
              Entrar para aceitar o convite
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
