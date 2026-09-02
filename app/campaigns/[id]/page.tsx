import { MemberActions } from "./member-actions";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateInvite } from "./create-invite";
import Link from "next/link";
import type { CampaignRole, Profile } from "@/types/entities";
import Image from "next/image";
import { LeaveCampaign } from "./leave-campaign";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) notFound();

  const { data: members } = await supabase
    .from("campaign_members")
    .select("role, profiles(id, display_name, username, avatar_url)")
    .eq("campaign_id", id);

  const myMembership = members?.find(
    (m) => (m.profiles as unknown as Profile)?.id === user.id
  );
  const myRole = myMembership?.role as CampaignRole | undefined;
  const isAdmin = myRole === "owner" || myRole === "gm";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
    <div className="mb-6">
  <Link
    href="/dashboard"
    className="text-sm text-ink-muted hover:text-ink"
  >
    ← Voltar para minhas campanhas
  </Link>
</div>
      <header className="mb-8">
        <h1 className="text-3xl">{campaign.name}</h1>
        {campaign.description && (
          <p className="mt-1 text-ink-muted">{campaign.description}</p>
        )}
        {campaign.system_name && (
          <span className="mt-2 inline-block text-xs text-ink-muted">
            Sistema: {campaign.system_name}
          </span>
        )}
      </header>
      {myRole && myRole !== "owner" && (
  <div className="mb-6 flex justify-end">
    <LeaveCampaign
      campaignId={campaign.id}
      userId={user.id}
    />
  </div>
)}

      <section className="panel p-6">
        <h2 className="text-lg">A mesa ainda não está pronta</h2>
        <p className="mt-2 text-sm text-ink-muted">
          O canvas interativo, mapas, tokens e fichas fazem parte das
          próximas fases do projeto. Por enquanto, esta página cobre a
          gestão da campanha: membros e convites.
        </p>
      </section>

      {isAdmin && (
        <section className="panel mt-6 p-6">
          <h2 className="text-lg">Convidar jogadores</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Qualquer pessoa com o link pode entrar como jogador.
          </p>
          <div className="mt-4">
            <CreateInvite campaignId={campaign.id} />
          </div>
        </section>
      )}

      <section className="panel mt-6 p-6">
        <h2 className="text-lg">
          Membros{" "}
          <span className="text-sm text-ink-muted">
            ({members?.length ?? 0})
          </span>
        </h2>
        <ul className="mt-4 divide-y divide-hairline">
          {members?.map((m) => {
            const profile = m.profiles as unknown as Profile;
            return (
              <li
              key={profile.id}
              className="flex items-center justify-between gap-4 py-2.5"
            >
              <div className="flex items-center gap-3">
  {profile.avatar_url ? (
    <Image
  src={profile.avatar_url}
  alt={profile.display_name}
  width={36}
  height={36}
  className="h-9 w-9 rounded-full object-cover"
/>
  ) : (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-sm text-ink-muted">
      {profile.display_name.slice(0, 1).toUpperCase()}
    </div>
  )}

  <div>
    <span>{profile.display_name}</span>

    <span className="ml-3 text-xs capitalize text-ink-muted">
      {m.role}
    </span>
  </div>
</div>

              {myRole && (
                <MemberActions
                  campaignId={campaign.id}
                  userId={profile.id}
                  memberRole={m.role as CampaignRole}
                  currentUserRole={myRole}
              />
            )}
          </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
