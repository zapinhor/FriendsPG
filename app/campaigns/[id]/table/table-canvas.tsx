"use client";

import { useEffect, useRef, useState } from "react";
import { Application, Assets, Container, FederatedPointerEvent, Graphics, Sprite } from "pixi.js";
import type { SceneProp } from "@/types/entities";

type Scene = { id: string; name: string; background_url: string | null; width: number; height: number };
type TransformPatch = Partial<Pick<SceneProp, "x" | "y" | "width" | "height">>;
type TableCanvasProps = {
  scene: Scene | null;
  props: SceneProp[];
  canManage: boolean;
  selectedPropId: string | null;
  onSelectProp: (id: string | null) => void;
  onPreviewTransform: (id: string, patch: TransformPatch) => void;
  onTransformProp: (id: string, patch: TransformPatch) => void | Promise<void>;
};

type HandleDirection = { x: -1 | 0 | 1; y: -1 | 0 | 1; cursor: string };
type PropView = {
  prop: SceneProp;
  container: Container;
  sprite: Sprite;
  outline: Graphics;
  handles: Array<{ graphic: Graphics; direction: HandleDirection }>;
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_SPEED = 0.0015;
const FIT_PADDING = 80;
const MIN_PROP_SIZE = 24;
const HANDLE_SIZE = 12;
const HANDLE_DIRECTIONS: HandleDirection[] = [
  { x: -1, y: -1, cursor: "nwse-resize" }, { x: 0, y: -1, cursor: "ns-resize" },
  { x: 1, y: -1, cursor: "nesw-resize" }, { x: 1, y: 0, cursor: "ew-resize" },
  { x: 1, y: 1, cursor: "nwse-resize" }, { x: 0, y: 1, cursor: "ns-resize" },
  { x: -1, y: 1, cursor: "nesw-resize" }, { x: -1, y: 0, cursor: "ew-resize" },
];

function positionHandle(view: PropView, handle: PropView["handles"][number]) {
  handle.graphic.position.set(
    handle.direction.x * view.prop.width / 2,
    handle.direction.y * view.prop.height / 2,
  );
}

function renderPropView(view: PropView, selected: boolean, canManage: boolean) {
  const { prop, container, sprite, outline, handles } = view;
  container.position.set(prop.x, prop.y);
  container.rotation = prop.rotation * Math.PI / 180;
  sprite.width = prop.width;
  sprite.height = prop.height;
  sprite.scale.x = Math.abs(sprite.scale.x) * (prop.flip_horizontal ? -1 : 1);
  sprite.scale.y = Math.abs(sprite.scale.y) * (prop.flip_vertical ? -1 : 1);
  sprite.eventMode = canManage && !prop.is_locked ? "static" : "none";
  sprite.cursor = canManage && !prop.is_locked ? "move" : "default";
  outline.clear().rect(-prop.width / 2, -prop.height / 2, prop.width, prop.height).stroke({ color: 0x9eb7ff, width: 3 });
  outline.visible = selected;
  for (const handle of handles) {
    positionHandle(view, handle);
    handle.graphic.visible = selected && canManage && !prop.is_locked;
    handle.graphic.eventMode = handle.graphic.visible ? "static" : "none";
  }
}

export function TableCanvas({ scene, props, canManage, selectedPropId, onSelectProp, onPreviewTransform, onTransformProp }: TableCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const viewsRef = useRef(new Map<string, PropView>());
  const callbacksRef = useRef({ onSelectProp, onPreviewTransform, onTransformProp });
  const [canvasVersion, setCanvasVersion] = useState(0);

  useEffect(() => {
    callbacksRef.current = { onSelectProp, onPreviewTransform, onTransformProp };
  }, [onSelectProp, onPreviewTransform, onTransformProp]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const hostElement = host;
    const views = viewsRef.current;
    const app = new Application();
    let cancelled = false;
    let initialized = false;
    let observer: ResizeObserver | undefined;
    let removeWheel: (() => void) | undefined;

    async function setup() {
      await app.init({ resizeTo: hostElement, antialias: true, background: "#11131a" });
      initialized = true;
      if (cancelled) { app.destroy(true, { children: true }); return; }
      hostElement.appendChild(app.canvas);
      const world = new Container();
      const sceneWidth = scene?.width ?? 1920;
      const sceneHeight = scene?.height ?? 1080;
      app.stage.addChild(world);
      world.addChild(new Graphics().rect(0, 0, sceneWidth, sceneHeight).fill("#1b1e27"));
      appRef.current = app;
      worldRef.current = world;
      views.clear();

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

      function fitScene() {
        const scale = Math.min(Math.max(1, app.screen.width - FIT_PADDING * 2) / sceneWidth, Math.max(1, app.screen.height - FIT_PADDING * 2) / sceneHeight, 1);
        world.scale.set(scale);
        world.x = (app.screen.width - sceneWidth * scale) / 2;
        world.y = (app.screen.height - sceneHeight * scale) / 2;
      }
      fitScene();

      let panning = false;
      let lastX = 0;
      let lastY = 0;
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;
      app.stage.on("pointerdown", (event: FederatedPointerEvent) => {
        callbacksRef.current.onSelectProp(null);
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
      const stopPan = () => { panning = false; app.canvas.style.cursor = "grab"; };
      app.stage.on("pointerup", stopPan);
      app.stage.on("pointerupoutside", stopPan);
      app.canvas.style.cursor = "grab";

      const wheel = (event: WheelEvent) => {
        event.preventDefault();
        const rect = app.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const current = world.scale.x;
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current * Math.exp(-event.deltaY * ZOOM_SPEED)));
        if (next === current) return;
        const pointX = (mouseX - world.x) / current;
        const pointY = (mouseY - world.y) / current;
        world.scale.set(next);
        world.x = mouseX - pointX * next;
        world.y = mouseY - pointY * next;
      };
      app.canvas.addEventListener("wheel", wheel, { passive: false });
      removeWheel = () => app.canvas.removeEventListener("wheel", wheel);
      observer = new ResizeObserver(fitScene);
      observer.observe(hostElement);
      setCanvasVersion((value) => value + 1);
    }

    void setup();
    return () => {
      cancelled = true;
      observer?.disconnect();
      removeWheel?.();
      appRef.current = null;
      worldRef.current = null;
      views.clear();
      if (initialized) app.destroy(true, { children: true });
    };
  }, [scene]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const propWorld = world;
    let cancelled = false;
    const incomingIds = new Set(props.map((prop) => prop.id));
    for (const [id, view] of viewsRef.current) {
      if (!incomingIds.has(id)) { propWorld.removeChild(view.container); view.container.destroy({ children: true }); viewsRef.current.delete(id); }
    }

    async function addMissing() {
      for (const prop of [...props].sort((a, b) => a.z_index - b.z_index || a.created_at.localeCompare(b.created_at))) {
        let view = viewsRef.current.get(prop.id);
        if (!view) {
          try {
            const texture = await Assets.load(prop.image_url);
            if (cancelled || !worldRef.current) return;
            const container = new Container();
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            const outline = new Graphics();
            outline.eventMode = "none";
            container.addChild(sprite, outline);
            view = { prop, container, sprite, outline, handles: [] };

            let dragging = false;
            let offsetX = 0;
            let offsetY = 0;
            let lastPreviewAt = 0;
            sprite.on("pointerdown", (event: FederatedPointerEvent) => {
              event.stopPropagation();
              callbacksRef.current.onSelectProp(prop.id);
              const current = viewsRef.current.get(prop.id);
              if (!current || current.prop.is_locked) return;
              dragging = true;
              const local = propWorld.toLocal(event.global);
              offsetX = local.x - current.prop.x;
              offsetY = local.y - current.prop.y;
              sprite.alpha = 0.85;
            });
            sprite.on("globalpointermove", (event: FederatedPointerEvent) => {
              if (!dragging) return;
              const current = viewsRef.current.get(prop.id);
              if (!current) return;
              const local = propWorld.toLocal(event.global);
              current.prop = { ...current.prop, x: local.x - offsetX, y: local.y - offsetY };
              renderPropView(current, true, canManage);
              const now = performance.now();
              if (now - lastPreviewAt >= 33) { lastPreviewAt = now; callbacksRef.current.onPreviewTransform(prop.id, { x: current.prop.x, y: current.prop.y }); }
            });
            const finishDrag = () => {
              if (!dragging) return;
              dragging = false;
              sprite.alpha = 1;
              const current = viewsRef.current.get(prop.id);
              if (current) void callbacksRef.current.onTransformProp(prop.id, { x: current.prop.x, y: current.prop.y });
            };
            sprite.on("pointerup", finishDrag);
            sprite.on("pointerupoutside", finishDrag);

            for (const direction of HANDLE_DIRECTIONS) {
              const graphic = new Graphics().rect(-HANDLE_SIZE / 2, -HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE).fill(0xf4f7ff).stroke({ color: 0x526da8, width: 2 });
              graphic.cursor = direction.cursor;
              const handle = { graphic, direction };
              view.handles.push(handle);
              container.addChild(graphic);
              let resizing = false;
              let startPointerX = 0;
              let startPointerY = 0;
              let startProp: SceneProp | null = null;
              let lastResizePreviewAt = 0;
              graphic.on("pointerdown", (event: FederatedPointerEvent) => {
                event.stopPropagation();
                const current = viewsRef.current.get(prop.id);
                if (!current || current.prop.is_locked) return;
                callbacksRef.current.onSelectProp(prop.id);
                resizing = true;
                startPointerX = event.global.x;
                startPointerY = event.global.y;
                startProp = { ...current.prop };
              });
              graphic.on("globalpointermove", (event: FederatedPointerEvent) => {
                if (!resizing || !startProp) return;
                const current = viewsRef.current.get(prop.id);
                if (!current) return;
                const scale = propWorld.scale.x || 1;
                const globalDx = (event.global.x - startPointerX) / scale;
                const globalDy = (event.global.y - startPointerY) / scale;
                const cos = Math.cos(-startProp.rotation * Math.PI / 180);
                const sin = Math.sin(-startProp.rotation * Math.PI / 180);
                const localDx = globalDx * cos - globalDy * sin;
                const localDy = globalDx * sin + globalDy * cos;
                const widthDelta = direction.x === 0 ? 0 : localDx * direction.x;
                const heightDelta = direction.y === 0 ? 0 : localDy * direction.y;
                const width = Math.max(MIN_PROP_SIZE, startProp.width + widthDelta);
                const height = Math.max(MIN_PROP_SIZE, startProp.height + heightDelta);
                const effectiveDx = direction.x === 0 ? 0 : (width - startProp.width) * direction.x / 2;
                const effectiveDy = direction.y === 0 ? 0 : (height - startProp.height) * direction.y / 2;
                const angle = startProp.rotation * Math.PI / 180;
                const centerDx = effectiveDx * Math.cos(angle) - effectiveDy * Math.sin(angle);
                const centerDy = effectiveDx * Math.sin(angle) + effectiveDy * Math.cos(angle);
                current.prop = { ...current.prop, x: startProp.x + centerDx, y: startProp.y + centerDy, width, height };
                renderPropView(current, true, canManage);
                const now = performance.now();
                if (now - lastResizePreviewAt >= 33) {
                  lastResizePreviewAt = now;
                  callbacksRef.current.onPreviewTransform(prop.id, { x: current.prop.x, y: current.prop.y, width, height });
                }
              });
              const finishResize = () => {
                if (!resizing) return;
                resizing = false;
                const current = viewsRef.current.get(prop.id);
                if (current) void callbacksRef.current.onTransformProp(prop.id, { x: current.prop.x, y: current.prop.y, width: current.prop.width, height: current.prop.height });
              };
              graphic.on("pointerup", finishResize);
              graphic.on("pointerupoutside", finishResize);
            }
            viewsRef.current.set(prop.id, view);
            propWorld.addChild(container);
          } catch (error) { console.error(`Não foi possível carregar o prop ${prop.name}:`, error); continue; }
        }
        view.prop = prop;
        renderPropView(view, selectedPropId === prop.id, canManage);
        propWorld.setChildIndex(view.container, propWorld.children.length - 1);
      }
    }
    void addMissing();
    return () => { cancelled = true; };
  }, [props, selectedPropId, canManage, canvasVersion]);

  return <div ref={hostRef} className="absolute inset-0 overflow-hidden" />;
}
