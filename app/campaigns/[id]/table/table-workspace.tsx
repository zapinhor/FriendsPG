"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SceneProp } from "@/types/entities";
import { PropPanel } from "./prop-panel";
import { TableCanvas } from "./table-canvas";
import { TableSidebar } from "./table-sidebar";

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
  canManage: boolean;
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

export function TableWorkspace({
  campaignId,
  userId,
  scene,
  scenes,
  assets,
  initialProps,
  canManage,
}: TableWorkspaceProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [props, setProps] = useState(initialProps);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>(scene ? "connecting" : "offline");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const selectedProp = props.find((prop) => prop.id === selectedId) ?? null;

  useEffect(() => {
    if (!scene) return;
    const activeScene = scene;
    let active = true;
    let currentChannel: RealtimeChannel | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;

    async function syncSceneProps() {
      const { data, error } = await supabase
        .from("scene_props")
        .select("*")
        .eq("scene_id", activeScene.id)
        .order("z_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (!active) return;
      if (error) {
        console.error("Não foi possível sincronizar os objetos da cena:", error);
        return;
      }
      setProps(data ?? []);
      setSelectedId((current) => current && data?.some((prop) => prop.id === current) ? current : null);
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
    if (!canManage) return;
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
    if (!canManage) return;
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

  return (
    <div className="flex min-h-0 flex-1">
      <TableSidebar campaignId={campaignId} scenes={scenes} assets={assets} canManage={canManage} />
      <section className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] text-ink-muted backdrop-blur-sm">
          <span className={`h-1.5 w-1.5 rounded-full ${realtimeStatus === "connected" ? "bg-emerald-400" : realtimeStatus === "offline" ? "bg-red-400" : "bg-amber-400"}`} />
          {realtimeStatus === "connected" ? "Tempo real conectado" : realtimeStatus === "offline" ? "Tempo real offline" : "Reconectando…"}
        </div>
        <TableCanvas
          scene={scene}
          props={props}
          canManage={canManage}
          selectedPropId={selectedId}
          onSelectProp={setSelectedId}
          onPreviewTransform={previewTransform}
          onTransformProp={updateProp}
        />
      </section>
      {canManage && (
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
