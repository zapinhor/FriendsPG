"use client";

import { useEffect, useRef } from "react";
import { Application, Assets, Container, FederatedPointerEvent, Graphics, Sprite } from "pixi.js";
import type { SceneProp } from "@/types/entities";

type Scene = { id: string; name: string; background_url: string | null; width: number; height: number };
type TableCanvasProps = {
  scene: Scene | null;
  props: SceneProp[];
  canManage: boolean;
  selectedPropId: string | null;
  onSelectProp: (id: string | null) => void;
  onPreviewMove: (id: string, x: number, y: number) => void;
  onMoveProp: (id: string, x: number, y: number) => void | Promise<void>;
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_SPEED = 0.0015;
const FIT_PADDING = 80;

export function TableCanvas({ scene, props, canManage, selectedPropId, onSelectProp, onPreviewMove, onMoveProp }: TableCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelectProp);
  const previewMoveRef = useRef(onPreviewMove);
  const moveRef = useRef(onMoveProp);

  useEffect(() => {
    selectRef.current = onSelectProp;
    previewMoveRef.current = onPreviewMove;
    moveRef.current = onMoveProp;
  }, [onSelectProp, onPreviewMove, onMoveProp]);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;
    const host = target;
    const app = new Application();
    let cancelled = false;
    let initialized = false;
    let resizeObserver: ResizeObserver | undefined;
    let removeWheel: (() => void) | undefined;

    async function setup() {
      await app.init({ resizeTo: host, antialias: true, background: "#11131a" });
      initialized = true;
      if (cancelled) { app.destroy(true, { children: true }); return; }
      host.appendChild(app.canvas);
      const world = new Container();
      const sceneWidth = scene?.width ?? 1920;
      const sceneHeight = scene?.height ?? 1080;
      app.stage.addChild(world);
      world.addChild(new Graphics().rect(0, 0, sceneWidth, sceneHeight).fill("#1b1e27"));

      if (scene?.background_url) {
        try {
          const texture = await Assets.load(scene.background_url);
          if (cancelled) return;
          const map = new Sprite(texture);
          map.width = sceneWidth;
          map.height = sceneHeight;
          world.addChild(map);
        } catch (error) { console.error("Não foi possível carregar o mapa da cena:", error); }
      }

      for (const prop of [...props].sort((a, b) => a.z_index - b.z_index || a.created_at.localeCompare(b.created_at))) {
        try {
          const texture = await Assets.load(prop.image_url);
          if (cancelled) return;
          const sprite = new Sprite(texture);
          sprite.anchor.set(0.5);
          sprite.position.set(prop.x, prop.y);
          sprite.width = prop.width;
          sprite.height = prop.height;
          sprite.scale.x *= prop.flip_horizontal ? -1 : 1;
          sprite.scale.y *= prop.flip_vertical ? -1 : 1;
          sprite.rotation = (prop.rotation * Math.PI) / 180;
          sprite.eventMode = canManage && !prop.is_locked ? "static" : "none";
          sprite.cursor = canManage && !prop.is_locked ? "move" : "default";
          if (selectedPropId === prop.id) {
            sprite.tint = 0xdde8ff;
            sprite.addChild(new Graphics().rect(-prop.width / 2 - 4, -prop.height / 2 - 4, prop.width + 8, prop.height + 8).stroke({ color: 0x9eb7ff, width: 3 }));
          }

          let dragging = false;
          let offsetX = 0;
          let offsetY = 0;
          let lastBroadcastAt = 0;
          sprite.on("pointerdown", (event: FederatedPointerEvent) => {
            event.stopPropagation();
            selectRef.current(prop.id);
            if (!canManage || prop.is_locked) return;
            dragging = true;
            const local = world.toLocal(event.global);
            offsetX = local.x - sprite.x;
            offsetY = local.y - sprite.y;
            sprite.alpha = 0.85;
          });
          sprite.on("globalpointermove", (event: FederatedPointerEvent) => {
            if (!dragging) return;
            const local = world.toLocal(event.global);
            sprite.position.set(local.x - offsetX, local.y - offsetY);
            const now = performance.now();
            if (now - lastBroadcastAt >= 33) {
              lastBroadcastAt = now;
              previewMoveRef.current(prop.id, sprite.x, sprite.y);
            }
          });
          const finishDrag = () => {
            if (!dragging) return;
            dragging = false;
            sprite.alpha = 1;
            void moveRef.current(prop.id, sprite.x, sprite.y);
          };
          sprite.on("pointerup", finishDrag);
          sprite.on("pointerupoutside", finishDrag);
          world.addChild(sprite);
        } catch (error) { console.error(`Não foi possível carregar o prop ${prop.name}:`, error); }
      }

      function fitSceneToScreen() {
        const scale = Math.min(Math.max(1, app.screen.width - FIT_PADDING * 2) / sceneWidth, Math.max(1, app.screen.height - FIT_PADDING * 2) / sceneHeight, 1);
        world.scale.set(scale);
        world.x = (app.screen.width - sceneWidth * scale) / 2;
        world.y = (app.screen.height - sceneHeight * scale) / 2;
      }
      fitSceneToScreen();

      let panning = false;
      let lastX = 0;
      let lastY = 0;
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;
      app.stage.on("pointerdown", (event: FederatedPointerEvent) => {
        selectRef.current(null);
        panning = true;
        lastX = event.global.x;
        lastY = event.global.y;
        app.canvas.style.cursor = "grabbing";
      });
      app.stage.on("pointermove", (event: FederatedPointerEvent) => {
        if (!panning) return;
        world.x += event.global.x - lastX;
        world.y += event.global.y - lastY;
        lastX = event.global.x;
        lastY = event.global.y;
      });
      const stopPanning = () => { panning = false; app.canvas.style.cursor = "grab"; };
      app.stage.on("pointerup", stopPanning);
      app.stage.on("pointerupoutside", stopPanning);
      app.canvas.style.cursor = "grab";

      const handleWheel = (event: WheelEvent) => {
        event.preventDefault();
        const rect = app.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const current = world.scale.x;
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current * Math.exp(-event.deltaY * ZOOM_SPEED)));
        if (next === current) return;
        const worldX = (mouseX - world.x) / current;
        const worldY = (mouseY - world.y) / current;
        world.scale.set(next);
        world.x = mouseX - worldX * next;
        world.y = mouseY - worldY * next;
      };
      app.canvas.addEventListener("wheel", handleWheel, { passive: false });
      removeWheel = () => app.canvas.removeEventListener("wheel", handleWheel);
      resizeObserver = new ResizeObserver(fitSceneToScreen);
      resizeObserver.observe(host);
    }

    void setup();
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      removeWheel?.();
      if (initialized) app.destroy(true, { children: true });
    };
  }, [scene, props, canManage, selectedPropId]);

  return <div ref={containerRef} className="absolute inset-0 overflow-hidden" />;
}
