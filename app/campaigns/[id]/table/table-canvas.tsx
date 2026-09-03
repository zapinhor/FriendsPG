"use client";

import { useEffect, useRef } from "react";
import {
  Application,
  Assets,
  Container,
  FederatedPointerEvent,
  Graphics,
  Sprite,
} from "pixi.js";

type Scene = {
  id: string;
  name: string;
  background_url: string | null;
  width: number;
  height: number;
};

type TableCanvasProps = {
  scene: Scene | null;
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_SPEED = 0.0015;
const FIT_PADDING = 80;

export function TableCanvas({ scene }: TableCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const app = new Application();

    let cancelled = false;
    let initialized = false;

    async function setup(target: HTMLDivElement) {
      await app.init({
        resizeTo: target,
        antialias: true,
        background: "#11131a",
      });

      initialized = true;

      if (cancelled) {
        app.destroy(true, {
          children: true,
        });

        return;
      }

      target.appendChild(app.canvas);

      const world = new Container();

      app.stage.addChild(world);

      const sceneWidth = scene?.width ?? 1920;
      const sceneHeight = scene?.height ?? 1080;

      // Fundo base da cena
      const background = new Graphics()
        .rect(0, 0, sceneWidth, sceneHeight)
        .fill("#1b1e27");

      world.addChild(background);

      // Mapa da cena
      if (scene?.background_url) {
        try {
          const texture = await Assets.load(scene.background_url);

          if (cancelled) return;

          const mapSprite = new Sprite(texture);

          mapSprite.width = sceneWidth;
          mapSprite.height = sceneHeight;

          world.addChild(mapSprite);
        } catch (error) {
          console.error("Não foi possível carregar o mapa da cena:", error);
        }
      }

      function fitSceneToScreen() {
        const availableWidth = Math.max(
          1,
          app.screen.width - FIT_PADDING * 2
        );

        const availableHeight = Math.max(
          1,
          app.screen.height - FIT_PADDING * 2
        );

        const scaleX = availableWidth / sceneWidth;
        const scaleY = availableHeight / sceneHeight;

        const scale = Math.min(scaleX, scaleY, 1);

        world.scale.set(scale);

        world.x = (app.screen.width - sceneWidth * scale) / 2;
        world.y = (app.screen.height - sceneHeight * scale) / 2;
      }

      // Faz a cena caber na tela ao abrir
      fitSceneToScreen();

      // PAN
      let dragging = false;
      let lastX = 0;
      let lastY = 0;

      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;

      app.stage.on("pointerdown", (event: FederatedPointerEvent) => {
        dragging = true;

        lastX = event.global.x;
        lastY = event.global.y;

        app.canvas.style.cursor = "grabbing";
      });

      app.stage.on("pointermove", (event: FederatedPointerEvent) => {
        if (!dragging) return;

        const dx = event.global.x - lastX;
        const dy = event.global.y - lastY;

        world.x += dx;
        world.y += dy;

        lastX = event.global.x;
        lastY = event.global.y;
      });

      function stopDragging() {
        dragging = false;
        app.canvas.style.cursor = "grab";
      }

      app.stage.on("pointerup", stopDragging);
      app.stage.on("pointerupoutside", stopDragging);

      app.canvas.style.cursor = "grab";

      // ZOOM
      function handleWheel(event: WheelEvent) {
        event.preventDefault();

        const rect = app.canvas.getBoundingClientRect();

        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const currentScale = world.scale.x;

        const zoomFactor = Math.exp(-event.deltaY * ZOOM_SPEED);

        const newScale = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, currentScale * zoomFactor)
        );

        if (newScale === currentScale) return;

        const worldX = (mouseX - world.x) / currentScale;
        const worldY = (mouseY - world.y) / currentScale;

        world.scale.set(newScale);

        world.x = mouseX - worldX * newScale;
        world.y = mouseY - worldY * newScale;
      }

      app.canvas.addEventListener("wheel", handleWheel, {
        passive: false,
      });

      // Reencaixa se o tamanho da janela mudar
      const resizeObserver = new ResizeObserver(() => {
        fitSceneToScreen();
      });

      resizeObserver.observe(target);

      return () => {
        resizeObserver.disconnect();

        app.canvas.removeEventListener("wheel", handleWheel);
      };
    }

    let cleanupSetup: (() => void) | undefined;

    void setup(container).then((cleanup) => {
      cleanupSetup = cleanup;
    });

    return () => {
      cancelled = true;

      cleanupSetup?.();

      if (initialized) {
        app.destroy(true, {
          children: true,
        });
      }
    };
  }, [scene]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
    />
  );
}