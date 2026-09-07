"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Character, SceneProp, SceneToken } from "@/types/entities";
import { PropPanel } from "./prop-panel";
import { TableCanvas, type CanvasItem } from "./table-canvas";
import { TableSidebar } from "./table-sidebar";
import { TokenPanel } from "./token-panel";

type Scene = {
  id: string;
  name: string;
  background_url: string | null;
  width: number;
  height: number;
};

type Asset = {
  id: string;
  name: string;
  url: string | null;
  storage_path: string | null;
  preview_url: string | null;
};

type TableWorkspaceProps = {
  campaignId: string;
  userId: string;
  scene: Scene | null;
  scenes: { id: string; name: string; is_active: boolean }[];
  assets: Asset[];
  initialProps: SceneProp[];
  initialTokens: SceneToken[];
  characters: Character[];
  members: { user_id: string; display_name: string }[];
  canManage: boolean;
  canMoveProps: boolean;
};

type ScenePropUpdate = Partial<
  Pick<
    SceneProp,
    | "name"
    | "x"
    | "y"
    | "width"
    | "height"
    | "rotation"
    | "flip_horizontal"
    | "flip_vertical"
    | "z_index"
    | "is_locked"
  >
>;

type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "offline";

function upsertProp(current: SceneProp[], changed: SceneProp) {
  const index = current.findIndex((prop) => prop.id === changed.id);
  if (index === -1) return [...current, changed];
  return current.map((prop, propIndex) => (propIndex === index ? changed : prop));
}

function upsertToken(current: SceneToken[], changed: SceneToken) {
  return current.some((token) => token.id === changed.id)
    ? current.map((token) => token.id === changed.id ? changed : token)
    : [...current, changed];
}

export function TableWorkspace({
  campaignId,
  userId,
  scene,
  scenes,
  assets,
  initialProps,
  initialTokens,
  characters,
  members,
  canManage,
  canMoveProps,
}: TableWorkspaceProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [props, setProps] = useState(initialProps);
  const [tokens, setTokens] = useState(initialTokens);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>(scene ? "connecting" : "offline");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const selectedProp = props.find((prop) => prop.id === selectedId) ?? null;
  const selectedToken = tokens.find((token) => token.id === selectedId) ?? null;
  const canvasItems: CanvasItem[] = [
    ...props.map((prop) => ({ ...prop, canMove: canManage || canMoveProps, canResize: canManage })),
    ...tokens.map((token) => ({
      ...token,
      canMove: canManage || token.controlled_by === userId,
      canResize: canManage,
    })),
  ];

  useEffect(() => {
    if (!scene) return;
    const activeScene = scene;
    let active = true;
    let currentChannel: RealtimeChannel | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;

    async function syncSceneProps() {
      const [{ data, error }, { data: tokenData, error: tokenError }] = await Promise.all([
        supabase.from("scene_props").select("*").eq("scene_id", activeScene.id).order("z_index").order("created_at"),
        supabase.from("scene_tokens").select("*").eq("scene_id", activeScene.id).order("z_index").order("created_at"),
      ]);
      if (!active) return;
      if (error) {
        console.error("Não foi possível sincronizar os objetos da cena:", error);
        return;
      }
      setProps(data ?? []);
      if (!tokenError) setTokens(tokenData ?? []);
      else console.error("Não foi possível sincronizar os tokens:", tokenError);
      setSelectedId((current) => current && (data?.some((prop) => prop.id === current) || tokenData?.some((token) => token.id === current)) ? current : null);
    }

    function receiveTransform(payload: Record<string, unknown>) {
      if (
        payload.clientId === clientIdRef.current ||
        typeof payload.propId !== "string" ||
        typeof payload.x !== "number" ||
        typeof payload.y !== "number" ||
        !Number.isFinite(payload.x) ||
        !Number.isFinite(payload.y)
      ) return;
      const width = typeof payload.width === "number" && Number.isFinite(payload.width) ? payload.width : undefined;
      const height = typeof payload.height === "number" && Number.isFinite(payload.height) ? payload.height : undefined;
      setProps((current) => current.map((prop) => (
        prop.id === payload.propId
          ? { ...prop, x: payload.x as number, y: payload.y as number, ...(width ? { width } : {}), ...(height ? { height } : {}) }
          : prop
      )));
      setTokens((current) => current.map((token) => (
        token.id === payload.propId
          ? { ...token, x: payload.x as number, y: payload.y as number, ...(width ? { width } : {}), ...(height ? { height } : {}) }
          : token
      )));
    }

    function scheduleReconnect(channel: RealtimeChannel) {
      if (!active || currentChannel !== channel || reconnectTimer) return;
      currentChannel = null;
      channelRef.current = null;
      setRealtimeStatus("reconnecting");
      const delay = Math.min(1000 * 2 ** reconnectAttempts, 10000);
      reconnectAttempts += 1;
      void supabase.removeChannel(channel).finally(() => {
        if (!active) return;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          void connect();
        }, delay);
      });
    }

    async function connect() {
      setRealtimeStatus(reconnectAttempts ? "reconnecting" : "connecting");
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session?.access_token) {
        if (active) setRealtimeStatus("offline");
        return;
      }
      await supabase.realtime.setAuth(session.access_token);
      if (!active) return;

      const channel = supabase.channel(`scene:${activeScene.id}`, {
        config: { private: true, broadcast: { self: false, ack: false } },
      });
      currentChannel = channel;
      channelRef.current = channel;
      channel
        .on("broadcast", { event: "prop-move" }, ({ payload }) => receiveTransform(payload))
        .on("broadcast", { event: "prop-upsert" }, ({ payload }) => {
          if (payload.clientId === clientIdRef.current) return;
          const changed = payload.prop as SceneProp | undefined;
          if (!changed?.id || changed.scene_id !== activeScene.id) return;
          setProps((current) => upsertProp(current, changed));
        })
        .on("broadcast", { event: "prop-delete" }, ({ payload }) => {
          if (payload.clientId === clientIdRef.current || typeof payload.propId !== "string") return;
          setProps((current) => current.filter((prop) => prop.id !== payload.propId));
          setSelectedId((current) => current === payload.propId ? null : current);
        })
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "scene_props", filter: `scene_id=eq.${activeScene.id}` },
          (payload) => {
            if (!active) return;
            const changed = payload.new as SceneProp;
            if (!changed?.id) return;
            setProps((current) => upsertProp(current, changed));
          },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "scene_tokens", filter: `scene_id=eq.${activeScene.id}` },
          (payload) => {
            const deletedId = (payload.old as { id?: string }).id;
            if (!active || !deletedId) return;
            setTokens((current) => current.filter((token) => token.id !== deletedId));
            setSelectedId((current) => current === deletedId ? null : current);
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "scene_tokens", filter: `scene_id=eq.${activeScene.id}` },
          (payload) => {
            const changed = payload.new as SceneToken;
            if (active && changed?.id) setTokens((current) => upsertToken(current, changed));
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "scene_tokens", filter: `scene_id=eq.${activeScene.id}` },
          (payload) => {
            const changed = payload.new as SceneToken;
            if (active && changed?.id) setTokens((current) => upsertToken(current, changed));
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "scene_props", filter: `scene_id=eq.${activeScene.id}` },
          (payload) => {
            if (!active) return;
            const changed = payload.new as SceneProp;
            if (!changed?.id) return;
            setProps((current) => upsertProp(current, changed));
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "scenes", filter: `campaign_id=eq.${campaignId}` },
          (payload) => {
            const changedScene = payload.new as { id?: string; is_active?: boolean };
            if (active && changedScene.is_active && changedScene.id !== activeScene.id) {
              router.refresh();
            }
          },
        )
        .subscribe((status, error) => {
          if (!active || currentChannel !== channel) return;
          if (status === "SUBSCRIBED") {
            reconnectAttempts = 0;
            setRealtimeStatus("connected");
            void syncSceneProps();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (error) console.error("Conexão Realtime interrompida:", error);
            scheduleReconnect(channel);
          }
        });
    }

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session?.access_token) void supabase.realtime.setAuth(session.access_token);
    });
    void connect();
    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      authSubscription.subscription.unsubscribe();
      channelRef.current = null;
      if (currentChannel) void supabase.removeChannel(currentChannel);
    };
  }, [campaignId, router, scene, supabase]);

  function previewTransform(
    id: string,
    patch: Partial<Pick<SceneProp, "x" | "y" | "width" | "height">>,
  ) {
    const token = tokens.find((item) => item.id === id);
    const prop = props.find((item) => item.id === id);
    const canPreview = canManage
      || Boolean(token && token.controlled_by === userId && !token.is_locked)
      || Boolean(prop && canMoveProps && !prop.is_locked);
    if (!canPreview) return;
    void channelRef.current?.send({
      type: "broadcast",
      event: "prop-move",
      payload: { propId: id, ...patch, clientId: clientIdRef.current },
    });
  }

  async function createProp(asset: Asset) {
    if (!scene || !asset.url || busy) return;
    setBusy(true);
    const highestLayer = props.reduce((highest, prop) => Math.max(highest, prop.z_index), -1);
    const { data, error } = await supabase
      .from("scene_props")
      .insert({
        scene_id: scene.id,
        campaign_id: campaignId,
        asset_id: asset.id,
        name: asset.name,
        image_url: asset.url,
        x: scene.width / 2,
        y: scene.height / 2,
        z_index: highestLayer + 1,
        created_by: userId,
      })
      .select()
      .single();
    setBusy(false);
    if (error) {
      console.error("Não foi possível criar o prop:", error);
      window.alert("Não foi possível adicionar o objeto à cena.");
      return;
    }
    setProps((current) => upsertProp(current, data));
    setSelectedId(data.id);
    void channelRef.current?.send({
      type: "broadcast",
      event: "prop-upsert",
      payload: { prop: data, clientId: clientIdRef.current },
    });
  }

  async function updateProp(id: string, patch: ScenePropUpdate) {
    const token = tokens.find((item) => item.id === id);
    if (token) {
      const isMoveOnly = Object.keys(patch).every((key) => key === "x" || key === "y");
      if (!canManage && (token.controlled_by !== userId || !isMoveOnly)) return;
      const tokenPatch: Partial<Pick<SceneToken, "x" | "y" | "width" | "height" | "rotation" | "z_index" | "is_locked">> = {};
      if (patch.x !== undefined) tokenPatch.x = patch.x;
      if (patch.y !== undefined) tokenPatch.y = patch.y;
      if (patch.width !== undefined) tokenPatch.width = patch.width;
      if (patch.height !== undefined) tokenPatch.height = patch.height;
      if (patch.rotation !== undefined) tokenPatch.rotation = patch.rotation;
      if (patch.z_index !== undefined) tokenPatch.z_index = patch.z_index;
      if (patch.is_locked !== undefined) tokenPatch.is_locked = patch.is_locked;
      const previousTokens = tokens;
      setTokens((current) => current.map((item) => item.id === id ? { ...item, ...tokenPatch } : item));
      const { data, error } = await supabase.from("scene_tokens").update(tokenPatch).eq("id", id).eq("campaign_id", campaignId).select().single();
      if (error) { console.error("Não foi possível atualizar o token:", error); setTokens(previousTokens); return; }
      setTokens((current) => upsertToken(current, data));
      return;
    }
    const isMoveOnly = Object.keys(patch).every((key) => key === "x" || key === "y");
    if (!canManage && (!canMoveProps || !isMoveOnly)) return;
    const previous = props;
    setProps((current) => current.map((prop) => (prop.id === id ? { ...prop, ...patch } : prop)));
    const { data, error } = await supabase
      .from("scene_props")
      .update(patch)
      .eq("id", id)
      .eq("campaign_id", campaignId)
      .select()
      .single();
    if (error) {
      console.error("Não foi possível atualizar o prop:", error);
      setProps(previous);
      return;
    }
    setProps((current) => current.map((prop) => (prop.id === id ? data : prop)));
  }

  async function duplicateProp(source: SceneProp) {
    if (!canManage || busy) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("scene_props")
      .insert({
        scene_id: source.scene_id,
        campaign_id: source.campaign_id,
        asset_id: source.asset_id,
        name: `${source.name} (cópia)`,
        image_url: source.image_url,
        x: source.x + 24,
        y: source.y + 24,
        width: source.width,
        height: source.height,
        rotation: source.rotation,
        flip_horizontal: source.flip_horizontal,
        flip_vertical: source.flip_vertical,
        z_index: source.z_index + 1,
        is_locked: false,
        created_by: userId,
      })
      .select()
      .single();
    setBusy(false);
    if (error) {
      console.error("Não foi possível duplicar o prop:", error);
      return;
    }
    setProps((current) => upsertProp(current, data));
    setSelectedId(data.id);
    void channelRef.current?.send({
      type: "broadcast",
      event: "prop-upsert",
      payload: { prop: data, clientId: clientIdRef.current },
    });
  }

  async function deleteProp(prop: SceneProp) {
    if (!canManage || !window.confirm(`Excluir o objeto "${prop.name}"?`)) return;
    const { error } = await supabase.from("scene_props").delete().eq("id", prop.id).eq("campaign_id", campaignId);
    if (error) {
      console.error("Não foi possível excluir o prop:", error);
      return;
    }
    setProps((current) => current.filter((item) => item.id !== prop.id));
    setSelectedId(null);
    void channelRef.current?.send({
      type: "broadcast",
      event: "prop-delete",
      payload: { propId: prop.id, clientId: clientIdRef.current },
    });
  }

  async function deleteToken(token: SceneToken) {
    if (!canManage || !window.confirm(`Excluir o token "${token.name}" desta cena?`)) return;
    const { error } = await supabase.from("scene_tokens").delete().eq("id", token.id).eq("campaign_id", campaignId);
    if (error) { console.error("Não foi possível excluir o token:", error); return; }
    setTokens((current) => current.filter((item) => item.id !== token.id));
    setSelectedId(null);
  }

  return (
    <div className="flex min-h-0 flex-1">
      <TableSidebar
        campaignId={campaignId}
        userId={userId}
        scene={scene}
        scenes={scenes}
        assets={assets}
        characters={characters}
        members={members}
        tokens={tokens}
        onTokenCreated={(token) => {
          setTokens((current) => upsertToken(current, token));
          setSelectedId(token.id);
        }}
        canManage={canManage}
      />
      <section className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] text-ink-muted backdrop-blur-sm">
          <span className={`h-1.5 w-1.5 rounded-full ${realtimeStatus === "connected" ? "bg-emerald-400" : realtimeStatus === "offline" ? "bg-red-400" : "bg-amber-400"}`} />
          {realtimeStatus === "connected" ? "Tempo real conectado" : realtimeStatus === "offline" ? "Tempo real offline" : "Reconectando…"}
        </div>
        <TableCanvas
          scene={scene}
          items={canvasItems}
          selectedPropId={selectedId}
          onSelectProp={setSelectedId}
          onPreviewTransform={previewTransform}
          onTransformProp={updateProp}
        />
      </section>
      {canManage && selectedToken ? (
        <TokenPanel
          key={`${selectedToken.id}:${selectedToken.updated_at}`}
          token={selectedToken}
          onUpdate={(patch) => updateProp(selectedToken.id, patch)}
          onDelete={() => deleteToken(selectedToken)}
        />
      ) : canManage && (
        <PropPanel
          assets={assets}
          props={[...props].sort((a, b) => b.z_index - a.z_index)}
          selectedProp={selectedProp}
          disabled={!scene || busy}
          onCreate={createProp}
          onSelect={setSelectedId}
          onUpdate={updateProp}
          onDuplicate={duplicateProp}
          onDelete={deleteProp}
        />
      )}
    </div>
  );
}
