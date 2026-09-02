import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateInvite } from "./create-invite";
import type { CampaignRole, Profile } from "@/types/entities";

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
                className="flex items-center justify-between py-2.5"
              >
                <span>{profile.display_name}</span>
                <span className="text-xs capitalize text-ink-muted">
                  {m.role}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
