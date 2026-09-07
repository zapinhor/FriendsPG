"use client";

import type { SceneToken } from "@/types/entities";

type Patch = Partial<Pick<SceneToken, "x" | "y" | "width" | "height" | "rotation" | "z_index" | "is_locked">>;
type NumberField = "x" | "y" | "width" | "height" | "rotation" | "z_index";

const NUMBER_FIELDS: { key: NumberField; label: string; min?: number; max?: number }[] = [
  { key: "x", label: "X" },
  { key: "y", label: "Y" },
  { key: "width", label: "Largura", min: 24, max: 10_000 },
  { key: "height", label: "Altura", min: 24, max: 10_000 },
  { key: "rotation", label: "Rotação" },
  { key: "z_index", label: "Camada" },
];

export function TokenPanel({
  token,
  onUpdate,
  onDelete,
}: {
  token: SceneToken;
  onUpdate: (patch: Patch) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-white/10 bg-[#101117] p-4">
      <p className="text-[11px] uppercase tracking-wide text-indigo-300">Token de personagem</p>
      <h2 className="mt-1 truncate text-sm font-medium" title={token.name}>{token.name}</h2>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {NUMBER_FIELDS.map((field) => (
          <label key={field.key} className="text-[10px] text-ink-muted">
            <span>{field.label}</span>
            <input
              type="number"
              min={field.min}
              max={field.max}
              defaultValue={token[field.key]}
              onBlur={(event) => {
                const value = Number(event.currentTarget.value);
                if (!Number.isFinite(value)) return;
                void onUpdate({ [field.key]: field.key === "z_index" ? Math.trunc(value) : value });
              }}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white"
            />
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void onUpdate({ is_locked: !token.is_locked })}
        className="mt-4 rounded-md border border-white/10 px-3 py-2 text-xs hover:bg-white/10"
      >
        {token.is_locked ? "Destravar token" : "Travar token"}
      </button>
      <button
        type="button"
        onClick={() => void onDelete()}
        className="mt-2 rounded-md border border-red-400/20 px-3 py-2 text-xs text-red-300 hover:bg-red-400/10"
      >
        Excluir token desta cena
      </button>
    </aside>
  );
}
