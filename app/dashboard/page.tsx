import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CampaignCard } from "./campaign-card";
import type { Campaign, CampaignSummary } from "@/types/entities";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { AccountMenu } from "@/components/account-menu";

async function loadCampaigns(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CampaignSummary[]> {
  const { data: memberships } = await supabase
    .from("campaign_members")
    .select("role, campaigns(*)")
    .eq("user_id", userId);

  if (!memberships || memberships.length === 0) return [];

  const summaries = await Promise.all(
    memberships.map(async (m) => {
      const campaign = m.campaigns as unknown as Campaign;

      const [{ count }, { data: gm }] = await Promise.all([
        supabase
          .from("campaign_members")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaign.id),
        supabase
          .from("campaign_members")
          .select("profiles(display_name)")
          .eq("campaign_id", campaign.id)
          .eq("role", "owner")
          .maybeSingle(),
      ]);

      return {
        ...campaign,
        member_count: count ?? 1,
        my_role: m.role,
        gm_display_name:
          (gm?.profiles as unknown as { display_name: string } | null)
            ?.display_name ?? null,
      } satisfies CampaignSummary;
    })
  );

  return summaries;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const campaigns = await loadCampaigns(supabase, user.id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl">Minhas campanhas</h1>
        <AccountMenu />
      </header>
      <div className="mb-8 flex justify-end gap-3">
          <Link href="/invite" className="btn-secondary">
            Entrar com convite
          </Link>
          <Link href="/campaigns/new" className="btn-primary">
            + Criar campanha
          </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="panel px-6 py-14 text-center">
          <p className="text-ink-muted">
            Você ainda não faz parte de nenhuma campanha.
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Crie a sua ou entre com um código de convite de um amigo.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </main>
  );
}
