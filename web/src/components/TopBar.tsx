import type { StatusResponse } from "../types";
import { useRef } from "react";

type Props = {
  status: StatusResponse | null;
  busy: boolean;
  onUpload: (file: File) => void;
  onReset: () => void;
  onModelChange: (model: string) => void;
};

export default function TopBar({
  status,
  busy,
  onUpload,
  onReset,
  onModelChange,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  const handlePick = () => fileInput.current?.click();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onUpload(f);
    e.target.value = "";
  };

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex flex-col">
          <div className="text-base font-semibold tracking-tight text-neutral-900">
            quizz-cours-IA
          </div>
          <div className="text-xs text-neutral-500">
            {status ? (
              <>
                {status.chunks} chunks · {status.history_size} msg ·{" "}
                {status.store_mode}
              </>
            ) : (
              "chargement…"
            )}
          </div>
        </div>

        <div className="flex-1" />

        <label className="flex items-center gap-1 text-xs text-neutral-600">
          <span>Modèle</span>
          <select
            value={status?.model ?? ""}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={busy || !status}
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 disabled:opacity-50"
          >
            {(status?.available_models ?? []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={handleFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={handlePick}
          disabled={busy}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Importer un document
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={busy}
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Réinitialiser
        </button>
      </div>
    </header>
  );
}
