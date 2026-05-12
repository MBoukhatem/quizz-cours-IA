import {
  useCallback,
  useReducer,
  useRef,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { ingest, generateQuiz, submitQuiz } from '../lib/api';
import type { Quiz, Citation, EvaluationResult } from '../lib/types';
import QuizPlayer from '../components/QuizPlayer';
import EvaluationView from '../components/EvaluationView';

const ACCEPTED = '.pdf,.docx,.md,.txt';

interface UploadedFile {
  source: string;
  chunks: number;
}

type HomeState =
  | { status: 'idle'; dragging: boolean }
  | { status: 'uploading'; fileName: string }
  | { status: 'ready'; file: UploadedFile; numQuestions: number }
  | { status: 'generating'; file: UploadedFile; numQuestions: number }
  | { status: 'playing'; file: UploadedFile; quiz: Quiz; citations: Citation[] }
  | { status: 'submitting'; file: UploadedFile; quiz: Quiz; citations: Citation[]; answers: Record<string, string> }
  | { status: 'done'; file: UploadedFile; result: EvaluationResult; quiz: Quiz }
  | { status: 'error'; message: string; previous: HomeState };

type HomeAction =
  | { type: 'drag'; dragging: boolean }
  | { type: 'upload.start'; fileName: string }
  | { type: 'upload.done'; file: UploadedFile }
  | { type: 'upload.fail'; message: string; previous: HomeState }
  | { type: 'numQuestions'; value: number }
  | { type: 'generate.start' }
  | { type: 'generate.done'; quiz: Quiz; citations: Citation[] }
  | { type: 'generate.cancel' }
  | { type: 'generate.fail'; message: string; previous: HomeState }
  | { type: 'submit.start'; answers: Record<string, string> }
  | { type: 'submit.done'; result: EvaluationResult }
  | { type: 'submit.fail'; message: string; previous: HomeState }
  | { type: 'restart.quiz' }
  | { type: 'restart.file' }
  | { type: 'error.dismiss' };

const INITIAL_STATE: HomeState = { status: 'idle', dragging: false };

const FILE_STORAGE_KEY = 'quizz.lastFile';

function loadInitialState(): HomeState {
  if (typeof window === 'undefined') return INITIAL_STATE;
  try {
    const raw = sessionStorage.getItem(FILE_STORAGE_KEY);
    if (raw) {
      const file = JSON.parse(raw) as UploadedFile;
      if (file?.source && typeof file.chunks === 'number') {
        return { status: 'ready', file, numQuestions: 5 };
      }
    }
  } catch {
    /* ignore corrupted entries */
  }
  return INITIAL_STATE;
}

function reducer(state: HomeState, action: HomeAction): HomeState {
  switch (action.type) {
    case 'drag':
      if (state.status !== 'idle') return state;
      return { status: 'idle', dragging: action.dragging };

    case 'upload.start':
      if (state.status !== 'idle' && state.status !== 'error') return state;
      return { status: 'uploading', fileName: action.fileName };

    case 'upload.done':
      if (state.status !== 'uploading') return state;
      return { status: 'ready', file: action.file, numQuestions: 5 };

    case 'upload.fail':
      return { status: 'error', message: action.message, previous: action.previous };

    case 'numQuestions':
      if (state.status !== 'ready') return state;
      return { ...state, numQuestions: action.value };

    case 'generate.start':
      if (state.status !== 'ready') return state;
      return { status: 'generating', file: state.file, numQuestions: state.numQuestions };

    case 'generate.done':
      if (state.status !== 'generating') return state;
      return { status: 'playing', file: state.file, quiz: action.quiz, citations: action.citations };

    case 'generate.cancel':
      if (state.status !== 'generating') return state;
      return { status: 'ready', file: state.file, numQuestions: state.numQuestions };

    case 'generate.fail':
      return { status: 'error', message: action.message, previous: action.previous };

    case 'submit.start':
      if (state.status !== 'playing') return state;
      return {
        status: 'submitting',
        file: state.file,
        quiz: state.quiz,
        citations: state.citations,
        answers: action.answers,
      };

    case 'submit.done':
      if (state.status !== 'submitting') return state;
      return { status: 'done', file: state.file, result: action.result, quiz: state.quiz };

    case 'submit.fail':
      return { status: 'error', message: action.message, previous: action.previous };

    case 'restart.quiz':
      if (state.status !== 'done') return state;
      return { status: 'ready', file: state.file, numQuestions: 5 };

    case 'restart.file':
      return INITIAL_STATE;

    case 'error.dismiss':
      if (state.status !== 'error') return state;
      return state.previous;

    default:
      return state;
  }
}

/* ---------- Visual primitives ---------- */

function Spinner({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-5 py-16 animate-fade-in">
      <div className="relative h-12 w-12">
        <span
          className="absolute inset-0 rounded-full border-2 border-ink-800"
          aria-hidden
        />
        <span
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-400 border-r-accent-400 animate-spin"
          aria-hidden
        />
        <span className="absolute inset-2 rounded-full bg-brand-gradient-soft blur-md animate-pulse-soft" aria-hidden />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-ink-200">{label}</p>
        {sub && <p className="text-xs text-ink-500">{sub}</p>}
      </div>
    </div>
  );
}

interface DropZoneProps {
  dragging: boolean;
  onFile: (file: File) => void;
  onDragChange: (dragging: boolean) => void;
}

function DropZone({ dragging, onFile, onDragChange }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function trigger() { inputRef.current?.click(); }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    onDragChange(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger(); }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Déposer un fichier ou cliquer pour parcourir"
      onClick={trigger}
      onKeyDown={onKeyDown}
      onDragOver={(e) => { e.preventDefault(); onDragChange(true); }}
      onDragLeave={() => onDragChange(false)}
      onDrop={onDrop}
      className={`group relative w-full overflow-hidden rounded-2xl border-2 border-dashed
        p-8 sm:p-10 text-center cursor-pointer
        transition-all duration-200 ease-out animate-fade-in
        ${
          dragging
            ? 'border-brand-400 bg-brand-500/10 scale-[1.01] shadow-glow-brand'
            : 'border-ink-800 bg-ink-900/40 hover:border-ink-700 hover:bg-ink-900/70'
        }`}
    >
      {/* Decorative dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
          maskImage: 'radial-gradient(ellipse 60% 70% at 50% 50%, black 0%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 70% at 50% 50%, black 0%, transparent 100%)',
        }}
      />
      {/* Background flourish */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ${
          dragging ? 'opacity-100' : 'group-hover:opacity-60'
        }`}
        style={{
          background:
            'radial-gradient(circle at 50% 0%, rgba(99,102,241,0.22), transparent 60%)',
        }}
      />

      <div className="relative flex flex-col items-center gap-5">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-200
            ${
              dragging
                ? 'border-brand-400 bg-brand-500/20 scale-110'
                : 'border-ink-800 bg-ink-850 group-hover:border-ink-700 group-hover:scale-105'
            }`}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={dragging ? 'text-brand-300' : 'text-ink-400 group-hover:text-ink-200'}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <div className="space-y-1.5">
          <p className="text-base font-medium text-ink-100">
            {dragging ? 'Relâchez pour importer' : 'Glissez votre document ici'}
          </p>
          <p className="text-sm text-ink-400">
            ou{' '}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); trigger(); }}
              className="font-medium text-brand-300 hover:text-brand-200 underline decoration-brand-500/40 underline-offset-4 transition-colors"
            >
              parcourez vos fichiers
            </button>
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
          {['PDF', 'DOCX', 'Markdown', 'TXT'].map((f) => (
            <span key={f} className="chip">{f}</span>
          ))}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        onChange={onInputChange}
        className="sr-only"
        aria-label="Sélecteur de fichier"
      />
    </div>
  );
}

interface ReadyPanelProps {
  file: UploadedFile;
  numQuestions: number;
  onChangeNumQuestions: (value: number) => void;
  onGenerate: () => void;
  onReset: () => void;
}

function ReadyPanel({ file, numQuestions, onChangeNumQuestions, onGenerate, onReset }: ReadyPanelProps) {
  const pct = ((numQuestions - 1) / 19) * 100;
  return (
    <div className="surface p-6 sm:p-7 space-y-7 animate-slide-up">
      {/* File card */}
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gradient-soft border border-brand-500/30">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-300">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Document indexé</p>
          <p className="text-[15px] font-medium text-ink-100 truncate mt-0.5" title={file.source}>{file.source}</p>
          <p className="text-xs text-ink-500 mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              prêt
            </span>
            <span className="text-ink-700">·</span>
            <span className="font-mono">{file.chunks} chunk{file.chunks !== 1 ? 's' : ''}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-ink-500 hover:text-ink-200 underline underline-offset-4 shrink-0 transition-colors"
        >
          Changer
        </button>
      </div>

      <div className="h-px bg-ink-800" />

      {/* Slider */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <label htmlFor="num-questions" className="text-sm font-medium text-ink-200">
            Nombre de questions
          </label>
          <span className="font-display text-3xl font-semibold tracking-tighter2 gradient-text tabular-nums">
            {numQuestions}
          </span>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 right-0 my-auto h-1.5 rounded-full bg-ink-800" />
          <div
            className="absolute inset-y-0 left-0 my-auto h-1.5 rounded-full bg-brand-gradient"
            style={{ width: `${pct}%` }}
          />
          <input
            id="num-questions"
            type="range"
            min={1}
            max={20}
            step={1}
            value={numQuestions}
            onChange={(e) => onChangeNumQuestions(Number(e.target.value))}
            className="relative w-full appearance-none bg-transparent h-6 cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-white
              [&::-webkit-slider-thumb]:shadow-glow-brand
              [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand-500
              [&::-webkit-slider-thumb]:transition-transform
              [&::-webkit-slider-thumb]:hover:scale-110
              [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-white
              [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-brand-500"
          />
        </div>
        <div className="flex justify-between text-[11px] text-ink-500 font-mono">
          <span>1</span>
          <span>5</span>
          <span>10</span>
          <span>15</span>
          <span>20</span>
        </div>
      </div>

      <button type="button" onClick={onGenerate} className="btn-primary w-full py-3 text-[15px]">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        Générer le quiz
      </button>
      <p className="text-[11px] text-ink-500 text-center -mt-3">
        Génération basée sur le contenu indexé · RAG local
      </p>
    </div>
  );
}

interface ErrorPanelProps {
  message: string;
  onRetry: () => void;
  onReset: () => void;
}

function ErrorPanel({ message, onRetry, onReset }: ErrorPanelProps) {
  return (
    <div className="rounded-2xl border border-rose-900/60 bg-rose-950/20 p-6 space-y-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500/15 border border-rose-500/30">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="eyebrow text-rose-300/80">Erreur</p>
          <p className="text-sm text-rose-200 mt-1 break-words">{message}</p>
        </div>
      </div>
      <div className="flex gap-2 pl-12">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-500 text-white text-sm font-medium hover:bg-rose-400 transition-colors"
        >
          Réessayer
        </button>
        <button type="button" onClick={onReset} className="btn-ghost">
          Recommencer
        </button>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function Home() {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);
  const threadIdRef = useRef<string>(crypto.randomUUID());
  const abortRef = useRef<AbortController | null>(null);

  const handleFile = useCallback(async (file: File, previous: HomeState) => {
    dispatch({ type: 'upload.start', fileName: file.name });
    try {
      const result = await ingest([file]);
      const info = result.ingested.find((r) => r.source === file.name) ?? result.ingested[0];
      if (!info) throw new Error('Aucun chunk généré pour ce fichier');
      const uploaded: UploadedFile = { source: info.source, chunks: info.chunks };
      sessionStorage.setItem(FILE_STORAGE_KEY, JSON.stringify(uploaded));
      dispatch({ type: 'upload.done', file: uploaded });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      dispatch({ type: 'upload.fail', message, previous });
    }
  }, []);

  const restartFile = useCallback(() => {
    sessionStorage.removeItem(FILE_STORAGE_KEY);
    dispatch({ type: 'restart.file' });
  }, []);

  const handleGenerate = useCallback(
    async (file: UploadedFile, numQuestions: number, previous: HomeState) => {
      const controller = new AbortController();
      abortRef.current = controller;
      dispatch({ type: 'generate.start' });
      try {
        const { quiz, citations } = await generateQuiz({
          threadId: threadIdRef.current,
          source: file.source,
          numQuestions,
          signal: controller.signal,
        });
        dispatch({ type: 'generate.done', quiz, citations });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        dispatch({ type: 'generate.fail', message, previous });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [],
  );

  const handleSubmit = useCallback(
    async (answers: Record<string, string>, quiz: Quiz, previous: HomeState) => {
      dispatch({ type: 'submit.start', answers });
      try {
        const result = await submitQuiz({
          sessionId: quiz.sessionId,
          threadId: threadIdRef.current,
          answers,
        });
        dispatch({ type: 'submit.done', result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        dispatch({ type: 'submit.fail', message, previous });
      }
    },
    [],
  );

  const cancelGenerate = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: 'generate.cancel' });
  }, []);

  // Hide hero in playing/done states to keep focus on content
  const showHero = state.status === 'idle' || state.status === 'uploading' || state.status === 'ready' || state.status === 'generating' || state.status === 'error';

  return (
    <div className="mx-auto w-full max-w-2xl px-5 sm:px-6 pt-10 pb-16 sm:pt-14">
      {showHero && (
        <header className="text-center space-y-4 mb-10 animate-fade-in">
          <span className="chip mx-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            Révisez n'importe quel cours en 1 minute
          </span>
          <h1 className="font-display text-[34px] sm:text-[44px] font-semibold tracking-tightest text-ink-50 leading-[1.05] max-w-xl mx-auto">
            <span className="block">Transformez vos cours</span>
            <span className="block gradient-text">en quiz instantanés</span>
          </h1>
          <p className="text-[15px] text-ink-400 max-w-md mx-auto text-pretty leading-relaxed">
            Glissez un document, ajustez la difficulté, obtenez un score détaillé en quelques secondes.
          </p>
        </header>
      )}

      <section className="animate-slide-up">
        {renderState(state, { handleFile, handleGenerate, handleSubmit, cancelGenerate, restartFile, dispatch })}
      </section>

      {state.status === 'idle' && <HowItWorks />}
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Déposez',
      body: 'PDF, Word, Markdown ou texte. Indexation locale en quelques secondes.',
      icon: (
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
      ),
    },
    {
      n: '02',
      title: 'Générez',
      body: 'Questions ciblées sur les passages les plus pertinents de votre document.',
      icon: (
        <>
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="9" />
        </>
      ),
    },
    {
      n: '03',
      title: 'Évaluez',
      body: 'Score détaillé par question avec justifications sourcées.',
      icon: (
        <>
          <path d="M3 3v18h18" />
          <path d="M7 16l4-4 4 2 5-7" />
        </>
      ),
    },
  ];
  return (
    <section className="mt-16 animate-fade-in" aria-labelledby="how-it-works">
      <div className="text-center mb-6">
        <p id="how-it-works" className="eyebrow">Comment ça marche</p>
      </div>
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {steps.map((s) => (
          <li
            key={s.n}
            className="surface surface-hover p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient-soft border border-brand-500/20 text-brand-300">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {s.icon}
                </svg>
              </span>
              <span className="font-mono text-[10px] text-ink-600 tracking-wider">{s.n}</span>
            </div>
            <div>
              <h3 className="font-display text-[15px] font-semibold text-ink-100 tracking-tighter2">{s.title}</h3>
              <p className="text-[13px] text-ink-400 leading-relaxed mt-1 text-pretty">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

interface RenderHandlers {
  handleFile: (file: File, previous: HomeState) => void;
  handleGenerate: (file: UploadedFile, numQuestions: number, previous: HomeState) => void;
  handleSubmit: (answers: Record<string, string>, quiz: Quiz, previous: HomeState) => void;
  cancelGenerate: () => void;
  restartFile: () => void;
  dispatch: (action: HomeAction) => void;
}

function renderState(state: HomeState, h: RenderHandlers) {
  switch (state.status) {
    case 'idle':
      return (
        <DropZone
          dragging={state.dragging}
          onFile={(file) => h.handleFile(file, state)}
          onDragChange={(dragging) => h.dispatch({ type: 'drag', dragging })}
        />
      );

    case 'uploading':
      return <Spinner label={`Indexation de ${state.fileName}`} sub="Découpage et création des embeddings…" />;

    case 'ready':
      return (
        <ReadyPanel
          file={state.file}
          numQuestions={state.numQuestions}
          onChangeNumQuestions={(value) => h.dispatch({ type: 'numQuestions', value })}
          onGenerate={() => h.handleGenerate(state.file, state.numQuestions, state)}
          onReset={() => h.restartFile()}
        />
      );

    case 'generating':
      return (
        <div className="surface p-6 space-y-2 animate-slide-up">
          <Spinner
            label={`Génération de ${state.numQuestions} question${state.numQuestions !== 1 ? 's' : ''}`}
            sub="Le modèle analyse les passages les plus pertinents…"
          />
          <div className="flex justify-center pb-2">
            <button type="button" onClick={h.cancelGenerate} className="btn-ghost">
              Annuler
            </button>
          </div>
        </div>
      );

    case 'playing':
      return (
        <div className="space-y-5 animate-fade-in">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 rounded-full border border-ink-800 bg-ink-900/60 px-3 py-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-gradient-soft border border-brand-500/20">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-300">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
              <span className="text-xs text-ink-300 truncate max-w-[260px]">{state.file.source}</span>
            </div>
            <button
              type="button"
              onClick={() => h.restartFile()}
              className="text-xs text-ink-400 hover:text-ink-200 underline underline-offset-2 transition-colors"
            >
              Changer de document
            </button>
          </div>
          <QuizPlayer quiz={state.quiz} onSubmit={(answers) => h.handleSubmit(answers, state.quiz, state)} />
        </div>
      );

    case 'submitting':
      return <Spinner label="Évaluation des réponses" sub="Comparaison avec les passages sources…" />;

    case 'done':
      return (
        <div className="space-y-6 animate-fade-in">
          <EvaluationView result={state.result} />
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={() => h.dispatch({ type: 'restart.quiz' })}
              className="btn-primary"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
              </svg>
              Nouveau quiz
            </button>
            <button
              type="button"
              onClick={() => h.restartFile()}
              className="btn-ghost"
            >
              Nouveau document
            </button>
          </div>
        </div>
      );

    case 'error': {
      const retry = () => {
        const prev = state.previous;
        if (prev.status === 'ready') {
          h.handleGenerate(prev.file, prev.numQuestions, prev);
        } else {
          h.dispatch({ type: 'error.dismiss' });
        }
      };
      return (
        <ErrorPanel
          message={state.message}
          onRetry={retry}
          onReset={() => h.restartFile()}
        />
      );
    }
  }
}
