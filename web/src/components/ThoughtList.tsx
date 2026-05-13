import type { Thought } from "../types";
import { useState } from "react";

type Props = {
  thoughts: Thought[];
};

const stageColor: Record<string, string> = {
  Routeur: "text-cyan-700 bg-cyan-50 border-cyan-200",
  RAG: "text-emerald-700 bg-emerald-50 border-emerald-200",
  Outil: "text-amber-700 bg-amber-50 border-amber-200",
  Final: "text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200",
};

export default function ThoughtList({ thoughts }: Props) {
  const [open, setOpen] = useState(false);

  if (!thoughts || thoughts.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-medium text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
      >
        {open ? "Masquer le raisonnement" : `Voir le raisonnement (${thoughts.length})`}
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {thoughts.map((t, i) => {
            const color =
              stageColor[t.stage] ||
              "text-neutral-600 bg-neutral-50 border-neutral-200";
            return (
              <li
                key={i}
                className={`flex items-start gap-2 rounded border px-2 py-1 text-xs ${color}`}
              >
                <span className="font-semibold">{t.stage}</span>
                <span className="flex-1 whitespace-pre-wrap break-words text-neutral-700">
                  {t.content}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
