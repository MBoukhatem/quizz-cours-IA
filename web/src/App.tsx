import { useCallback, useEffect, useRef, useState } from "react";
import MessageBubble from "./components/MessageBubble";
import TopBar from "./components/TopBar";
import {
  getStatus,
  postIngest,
  postQuery,
  postReset,
  setModel as apiSetModel,
} from "./api";
import type { ChatMessage, StatusResponse } from "./types";

const MIN_Q = 1;
const MAX_Q = 20;

function clampCount(n: number): number {
  if (Number.isNaN(n)) return 5;
  return Math.min(MAX_Q, Math.max(MIN_Q, Math.round(n)));
}

function buildQuizPrompt(count: number): string {
  return `Génère un quiz de ${count} questions à partir du document importé. Couvre l'ensemble des concepts principaux du document.`;
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasDocs = (status?.chunks ?? 0) > 0;

  const refreshStatus = useCallback(async () => {
    try {
      const s = await getStatus();
      setStatus(s);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setMessages((m) => [
        ...m,
        { role: "system", kind: "error", content: `Statut indisponible : ${msg}` },
      ]);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleSend = async () => {
    if (busy || !hasDocs) return;
    const safeCount = clampCount(count);
    const prompt = buildQuizPrompt(safeCount);
    setMessages((m) => [
      ...m,
      { role: "user", content: `Quiz de ${safeCount} questions sur le document importé` },
    ]);
    setBusy(true);
    try {
      const res = await postQuery(prompt);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.final_answer,
          quiz: res.quiz ?? null,
          thoughts: res.thoughts,
          injectionDetected: res.injection_detected,
        },
      ]);
      refreshStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setMessages((m) => [
        ...m,
        { role: "system", kind: "error", content: `Erreur : ${msg}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (file: File) => {
    setBusy(true);
    setMessages((m) => [
      ...m,
      { role: "system", kind: "info", content: `Import de « ${file.name} »…` },
    ]);
    try {
      const res = await postIngest(file);
      setMessages((m) => [
        ...m,
        {
          role: "system",
          kind: "info",
          content: `« ${res.filename} » importé · ${res.chunks} chunks indexés.`,
        },
      ]);
      refreshStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setMessages((m) => [
        ...m,
        { role: "system", kind: "error", content: `Import échoué : ${msg}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const handleModelChange = async (model: string) => {
    try {
      const res = await apiSetModel(model);
      setStatus((s) => (s ? { ...s, model: res.current } : s));
      setMessages((m) => [
        ...m,
        { role: "system", kind: "info", content: `Modèle actif : ${res.current}` },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setMessages((m) => [
        ...m,
        { role: "system", kind: "error", content: `Changement de modèle échoué : ${msg}` },
      ]);
    }
  };

  const handleReset = async () => {
    if (!confirm("Vider le store vectoriel et la mémoire ?")) return;
    setBusy(true);
    try {
      await postReset();
      setMessages([
        {
          role: "system",
          kind: "info",
          content: "Store et mémoire réinitialisés.",
        },
      ]);
      refreshStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setMessages((m) => [
        ...m,
        { role: "system", kind: "error", content: `Reset échoué : ${msg}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar
        status={status}
        busy={busy}
        onUpload={handleUpload}
        onReset={handleReset}
        onModelChange={handleModelChange}
      />

      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-3 px-4 py-6">
          {messages.length === 0 && (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center">
              <div className="text-base font-medium text-neutral-900">
                Générez un quiz à partir de vos documents
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                {hasDocs
                  ? "Choisissez un nombre de questions (1 – 20), puis cliquez sur Générer."
                  : "Commencez par importer un cours (PDF, DOCX, TXT, MD) via le bouton en haut à droite."}
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="max-w-2xl rounded-2xl rounded-bl-sm border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-500 shadow-sm">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400" />
                  Réflexion en cours…
                </span>
              </div>
            </div>
          )}
        </div>
      </main>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="border-t border-neutral-200 bg-white"
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="text-xs text-neutral-500">
            {hasDocs
              ? `${status?.chunks} chunks prêts pour la génération.`
              : "Aucun document importé — utilisez « Importer un document » en haut."}
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <span>Nombre de questions</span>
              <input
                type="number"
                min={MIN_Q}
                max={MAX_Q}
                value={count}
                onChange={(e) =>
                  setCount(clampCount(parseInt(e.target.value, 10)))
                }
                className="w-16 rounded-lg border border-neutral-300 bg-white px-2 py-2 text-sm shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !hasDocs}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Générer le quiz
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
