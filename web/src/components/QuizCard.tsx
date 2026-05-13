import type { Quiz } from "../types";
import { useState } from "react";

type Props = {
  quiz: Quiz;
};

export default function QuizCard({ quiz }: Props) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const toggle = (i: number) =>
    setRevealed((r) => ({ ...r, [i]: !r[i] }));

  return (
    <div className="space-y-3">
      {quiz.topic && (
        <div className="text-sm font-medium text-neutral-600">
          Quiz · <span className="text-neutral-900">{quiz.topic}</span>
        </div>
      )}
      <ol className="space-y-3">
        {quiz.questions.map((q, i) => (
          <li
            key={i}
            className="rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-neutral-900 text-xs font-medium text-white">
                {i + 1}
              </span>
              <div className="flex-1">
                <div className="font-medium text-neutral-900">
                  {q.question}
                </div>
                {q.type && (
                  <div className="mt-0.5 text-xs uppercase tracking-wide text-neutral-400">
                    {q.type}
                  </div>
                )}
              </div>
            </div>

            {q.options && q.options.length > 0 && (
              <ul className="mt-2 ml-8 space-y-1 text-sm text-neutral-700">
                {q.options.map((opt, j) => (
                  <li key={j}>{opt}</li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => toggle(i)}
              className="mt-3 ml-8 text-xs font-medium text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
            >
              {revealed[i] ? "Masquer la réponse" : "Afficher la réponse"}
            </button>

            {revealed[i] && (
              <div className="mt-2 ml-8 space-y-1 rounded-md bg-neutral-50 p-3 text-sm">
                {q.answer && (
                  <div>
                    <span className="font-medium text-neutral-900">
                      Réponse :{" "}
                    </span>
                    <span className="text-neutral-800">{q.answer}</span>
                  </div>
                )}
                {q.explanation && (
                  <div className="text-neutral-700">{q.explanation}</div>
                )}
                {q.source && (
                  <div className="text-xs text-neutral-500">
                    Source : {q.source}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
