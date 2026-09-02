// Tipos das entidades da Fase 1. Nas próximas fases: Scene, SceneObject,
// Asset, Character, SheetTemplate, SheetField, AudioTrack, PlayerPresence.

export type CampaignRole = "owner" | "gm" | "player";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  owner_id: string;
  system_name: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CampaignMember {
  campaign_id: string;
  user_id: string;
  role: CampaignRole;
  joined_at: string;
}

/** Campanha do jogador, já com contagem de membros e o papel dele. */
export interface CampaignSummary extends Campaign {
  member_count: number;
  my_role: CampaignRole;
  gm_display_name: string | null;
}

export interface CampaignInvite {
  id: string;
  campaign_id: string;
  code: string;
  created_by: string;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  created_at: string;
}

export interface InvitePreview {
  campaign_id: string;
  campaign_name: string;
  campaign_description: string | null;
  gm_display_name: string | null;
  valid: boolean;
}
