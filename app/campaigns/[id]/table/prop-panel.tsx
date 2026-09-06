"use client";

import type { SceneProp } from "@/types/entities";

type Asset = {
  id: string;
  name: string;
  url: string | null;
  storage_path: string | null;
  preview_url: string | null;
};

type EditableProp = Pick<
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
>;

type PropPanelProps = {
  assets: Asset[];
  props: SceneProp[];
  selectedProp: SceneProp | null;
  disabled: boolean;
  onCreate: (asset: Asset) => Promise<void>;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<EditableProp>) => Promise<void>;
  onDuplicate: (prop: SceneProp) => Promise<void>;
  onDelete: (prop: SceneProp) => Promise<void>;
};

function NumberField({
  label,
  value,
  min,
  onCommit,
}: {
  label: string;
  value: number;
  min?: number;
  onCommit: (value: number) => void;
}) {
  return (
    <label className="space-y-1 text-[11px] text-ink-muted">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        defaultValue={Math.round(value * 100) / 100}
        key={`${label}-${value}`}
        onBlur={(event) => {
          const next = Number(event.currentTarget.value);
          if (Number.isFinite(next) && (min === undefined || next >= min)) {
            onCommit(next);
          }
        }}
        className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none focus:border-white/30"
      />
    </label>
  );
}

export function PropPanel({
  assets,
  props,
  selectedProp,
  disabled,
  onCreate,
  onSelect,
  onUpdate,
  onDuplicate,
  onDelete,
}: PropPanelProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-white/10 bg-[#101117]">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-medium">Objetos da mesa</h2>
        <p className="mt-1 text-[11px] text-ink-muted">
          Adicione um asset e ajuste o objeto selecionado.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-2">
          {assets.filter((asset) => asset.url).map((asset) => (
            <button
              key={asset.id}
              type="button"
              disabled={disabled}
              onClick={() => void onCreate(asset)}
              title={`Adicionar ${asset.name}`}
              className="group overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] text-left disabled:opacity-40"
            >
              {asset.preview_url ? (
                // External URLs are intentionally used by the project.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.preview_url} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <div className="aspect-square bg-white/5" />
              )}
              <span className="block truncate px-2 py-1.5 text-[10px] text-ink-muted group-hover:text-white">
                + {asset.name}
              </span>
            </button>
          ))}
        </div>

        {assets.every((asset) => !asset.url) && (
          <p className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-ink-muted">
            Adicione imagens por URL na aba Assets para criar props.
          </p>
        )}

        <div className="my-4 h-px bg-white/10" />

        <div className="space-y-1">
          {props.map((prop) => (
            <button
              key={prop.id}
              type="button"
              onClick={() => onSelect(prop.id)}
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition ${
                selectedProp?.id === prop.id
                  ? "bg-white/10 text-white"
                  : "text-ink-muted hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="truncate">{prop.name}</span>
              <span aria-label={prop.is_locked ? "Travado" : "Destravado"}>
                {prop.is_locked ? "🔒" : `#${prop.z_index}`}
              </span>
            </button>
          ))}
        </div>

        {selectedProp && (
          <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <label className="space-y-1 text-[11px] text-ink-muted">
              <span>Nome</span>
              <input
                defaultValue={selectedProp.name}
                key={`name-${selectedProp.id}-${selectedProp.name}`}
                onBlur={(event) => {
                  const name = event.currentTarget.value.trim();
                  if (name && name !== selectedProp.name) void onUpdate(selectedProp.id, { name });
                }}
                className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none focus:border-white/30"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <NumberField label="X" value={selectedProp.x} onCommit={(x) => void onUpdate(selectedProp.id, { x })} />
              <NumberField label="Y" value={selectedProp.y} onCommit={(y) => void onUpdate(selectedProp.id, { y })} />
              <NumberField label="Largura" value={selectedProp.width} min={1} onCommit={(width) => void onUpdate(selectedProp.id, { width })} />
              <NumberField label="Altura" value={selectedProp.height} min={1} onCommit={(height) => void onUpdate(selectedProp.id, { height })} />
              <NumberField label="Rotação (°)" value={selectedProp.rotation} onCommit={(rotation) => void onUpdate(selectedProp.id, { rotation })} />
              <NumberField label="Camada" value={selectedProp.z_index} onCommit={(z_index) => void onUpdate(selectedProp.id, { z_index: Math.trunc(z_index) })} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void onUpdate(selectedProp.id, { flip_horizontal: !selectedProp.flip_horizontal })} className="rounded-md border border-white/10 px-2 py-2 text-xs hover:bg-white/10">
                ↔ Horizontal
              </button>
              <button type="button" onClick={() => void onUpdate(selectedProp.id, { flip_vertical: !selectedProp.flip_vertical })} className="rounded-md border border-white/10 px-2 py-2 text-xs hover:bg-white/10">
                ↕ Vertical
              </button>
              <button type="button" onClick={() => void onUpdate(selectedProp.id, { z_index: selectedProp.z_index - 1 })} className="rounded-md border border-white/10 px-2 py-2 text-xs hover:bg-white/10">
                Enviar atrás
              </button>
              <button type="button" onClick={() => void onUpdate(selectedProp.id, { z_index: selectedProp.z_index + 1 })} className="rounded-md border border-white/10 px-2 py-2 text-xs hover:bg-white/10">
                Trazer à frente
              </button>
              <button type="button" onClick={() => void onUpdate(selectedProp.id, { is_locked: !selectedProp.is_locked })} className="rounded-md border border-white/10 px-2 py-2 text-xs hover:bg-white/10">
                {selectedProp.is_locked ? "Destravar" : "Travar"}
              </button>
              <button type="button" onClick={() => void onDuplicate(selectedProp)} className="rounded-md border border-white/10 px-2 py-2 text-xs hover:bg-white/10">
                Duplicar
              </button>
            </div>

            <button type="button" onClick={() => void onDelete(selectedProp)} className="w-full rounded-md border border-red-400/20 px-2 py-2 text-xs text-red-300 hover:bg-red-400/10">
              Excluir objeto
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
