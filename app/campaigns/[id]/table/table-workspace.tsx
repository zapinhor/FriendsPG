"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
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

export function TableWorkspace({
  campaignId,
  userId,
  scene,
  scenes,
  assets,
  initialProps,
  canManage,
}: TableWorkspaceProps) {
  const supabase = useMemo(() => createClient(), []);
  const [props, setProps] = useState(initialProps);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const selectedProp = props.find((prop) => prop.id === selectedId) ?? null;

  useEffect(() => {
    if (!scene) return;
    let active = true;
    const channel = supabase.channel(`scene:${scene.id}`, {
      config: { private: true, broadcast: { self: false, ack: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "prop-move" }, ({ payload }) => {
        if (
          payload?.clientId === clientIdRef.current ||
          typeof payload?.propId !== "string" ||
          typeof payload?.x !== "number" ||
          typeof payload?.y !== "number" ||
          !Number.isFinite(payload.x) ||
          !Number.isFinite(payload.y)
        ) return;
        const width = typeof payload.width === "number" && Number.isFinite(payload.width) ? payload.width : undefined;
        const height = typeof payload.height === "number" && Number.isFinite(payload.height) ? payload.height : undefined;
        setProps((current) => current.map((prop) => (
          prop.id === payload.propId
            ? { ...prop, x: payload.x, y: payload.y, ...(width ? { width } : {}), ...(height ? { height } : {}) }
            : prop
        )));
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scene_props", filter: `scene_id=eq.${scene.id}` },
        (payload) => {
          if (!active) return;
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id?: string }).id;
            if (deletedId) setProps((current) => current.filter((prop) => prop.id !== deletedId));
            return;
          }
          const changed = payload.new as SceneProp;
          if (!changed?.id) return;
          setProps((current) => {
            const exists = current.some((prop) => prop.id === changed.id);
            return exists
              ? current.map((prop) => (prop.id === changed.id ? changed : prop))
              : [...current, changed];
          });
        },
      );

    void supabase.realtime.setAuth().then(() => channel.subscribe());
    return () => {
      active = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [scene, supabase]);

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
    setProps((current) => [...current, data]);
    setSelectedId(data.id);
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
    setProps((current) => [...current, data]);
    setSelectedId(data.id);
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
  }

  return (
    <div className="flex min-h-0 flex-1">
      <TableSidebar campaignId={campaignId} scenes={scenes} assets={assets} canManage={canManage} />
      <section className="relative min-w-0 flex-1">
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
