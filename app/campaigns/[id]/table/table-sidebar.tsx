"use client";

import { useState } from "react";
import { AssetManager } from "./asset-manager";
import { SceneSidebar } from "./scene-sidebar";
import { CharacterManager } from "./character-manager";
import type { Character, SceneToken } from "@/types/entities";

type Scene = {
  id: string;
  name: string;
  is_active: boolean;
};

type Asset = {
  id: string;
  name: string;
  url: string | null;
  storage_path: string | null;
  preview_url: string | null;
};

type TableSidebarProps = {
  campaignId: string;
  userId: string;
  scene: { id: string; width: number; height: number } | null;
  scenes: Scene[];
  assets: Asset[];
  canManage: boolean;
  characters: Character[];
  members: { user_id: string; display_name: string }[];
  tokens: SceneToken[];
  onTokenCreated: (token: SceneToken) => void;
};

type SidebarTab =
  | "scenes"
  | "assets"
  | "characters";

export function TableSidebar({
  campaignId,
  userId,
  scene,
  scenes,
  assets,
  characters,
  members,
  tokens,
  onTokenCreated,
  canManage,
}: TableSidebarProps) {
  const [activeTab, setActiveTab] =
    useState<SidebarTab>("scenes");

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-white/10 bg-[#101117]">
      {canManage ? (
        <div className="grid grid-cols-3 border-b border-white/10">
          <button
            type="button"
            onClick={() =>
              setActiveTab("scenes")
            }
            className={[
              "px-4 py-3 text-sm transition",
              activeTab === "scenes"
                ? "bg-white/10 text-white"
                : "text-ink-muted hover:bg-white/5 hover:text-white",
            ].join(" ")}
          >
            Cenas
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("characters")}
            className={["px-2 py-3 text-sm transition", activeTab === "characters" ? "bg-white/10 text-white" : "text-ink-muted hover:bg-white/5 hover:text-white"].join(" ")}
          >
            Personagens
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab("assets")
            }
            className={[
              "px-4 py-3 text-sm transition",
              activeTab === "assets"
                ? "bg-white/10 text-white"
                : "text-ink-muted hover:bg-white/5 hover:text-white",
            ].join(" ")}
          >
            Assets
          </button>
        </div>
      ) : (
        <div className="border-b border-white/10 px-4 py-3">
          <span className="text-sm text-white">
            Cena
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "characters" && canManage ? (
          <CharacterManager
            campaignId={campaignId}
            userId={userId}
            scene={scene}
            characters={characters}
            members={members}
            tokens={tokens}
            onTokenCreated={onTokenCreated}
          />
        ) : activeTab === "assets" && canManage ? (
          <AssetManager
            campaignId={campaignId}
            assets={assets}
            canManage={canManage}
          />
        ) : (
          <SceneSidebar
            campaignId={campaignId}
            scenes={scenes}
            assets={canManage ? assets : []}
            canManage={canManage}
          />
        )}
      </div>
    </aside>
  );
}
