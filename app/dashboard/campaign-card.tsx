import Link from "next/link";
import type { CampaignSummary } from "@/types/entities";

const ROLE_LABEL: Record<CampaignSummary["my_role"], string> = {
  owner: "Você é o Mestre",
  gm: "Você é GM",
  player: "Você é jogador",
};

export function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  return (
    <div className="panel flex gap-4 p-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-panel bg-panel-raised">
        {campaign.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={campaign.cover_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-ink-muted">
            {campaign.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between">
        <div>
          <h3 className="text-xl">{campaign.name}</h3>
          <p className="text-sm text-ink-muted">
            {campaign.system_name || "Sistema não definido"} ·{" "}
            {campaign.member_count}{" "}
            {campaign.member_count === 1 ? "jogador" : "jogadores"}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-muted">
            {ROLE_LABEL[campaign.my_role]}
          </span>
          <Link
            href={`/campaigns/${campaign.id}`}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
