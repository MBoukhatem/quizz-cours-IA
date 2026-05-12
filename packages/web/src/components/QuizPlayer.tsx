import { useState, type FormEvent } from 'react';
import type { Quiz, McqQuestion, TrueFalseQuestion, OpenQuestion, Question } from '../lib/types';

interface QuizPlayerProps {
  quiz: Quiz;
  onSubmit: (answers: Record<string, string>) => void;
}

function McqField({
  q,
  value,
  onChange,
}: {
  q: McqQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{q.text}</legend>
      {q.options.map((opt, i) => {
        const selected = value === opt;
        return (
          <label
            key={i}
            className={`group flex items-start gap-3 cursor-pointer rounded-xl border px-4 py-3
              transition-all duration-150 ease-out
              ${
                selected
                  ? 'border-brand-500/60 bg-brand-500/10 shadow-[0_0_0_1px_rgb(99_102_241_/_0.4)]'
                  : 'border-ink-800 bg-ink-900/40 hover:border-ink-700 hover:bg-ink-850'
              }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all
                ${selected ? 'border-brand-400 bg-brand-500' : 'border-ink-700 group-hover:border-ink-600'}`}
              aria-hidden
            >
              {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            </span>
            <input
              type="radio"
              name={q.id}
              value={opt}
              checked={selected}
              onChange={() => onChange(opt)}
              className="sr-only"
            />
            <span className={`text-sm leading-relaxed ${selected ? 'text-ink-50' : 'text-ink-200 group-hover:text-ink-100'}`}>
              {opt}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function TrueFalseField({
  q,
  value,
  onChange,
}: {
  q: TrueFalseQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const items: Array<{ v: 'true' | 'false'; label: string; icon: string }> = [
    { v: 'true', label: 'Vrai', icon: 'M5 13l4 4L19 7' },
    { v: 'false', label: 'Faux', icon: 'M18 6L6 18M6 6l12 12' },
  ];
  return (
    <fieldset>
      <legend className="sr-only">{q.text}</legend>
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ v, label, icon }) => {
          const selected = value === v;
          return (
            <label
              key={v}
              className={`flex items-center justify-center gap-2 cursor-pointer rounded-xl border px-4 py-3 text-sm font-medium
                transition-all duration-150 ease-out
                ${
                  selected
                    ? 'border-brand-500/60 bg-brand-500/10 text-ink-50 shadow-[0_0_0_1px_rgb(99_102_241_/_0.4)]'
                    : 'border-ink-800 bg-ink-900/40 text-ink-300 hover:border-ink-700 hover:bg-ink-850 hover:text-ink-100'
                }`}
            >
              <input
                type="radio"
                name={q.id}
                value={v}
                checked={selected}
                onChange={() => onChange(v)}
                className="sr-only"
              />
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={selected ? 'text-brand-300' : 'text-ink-500'}>
                <path d={icon} />
              </svg>
              {label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function OpenField({
  q,
  value,
  onChange,
}: {
  q: OpenQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">{q.text}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="Rédigez votre réponse…"
        className="w-full rounded-xl border border-ink-800 bg-ink-900/60 px-4 py-3
          text-sm text-ink-100 placeholder-ink-600
          focus:outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/30
          resize-y transition-colors"
      />
    </label>
  );
}

function QuestionBlock({
  q,
  index,
  value,
  onChange,
}: {
  q: Question;
  index: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const typeLabel = q.type === 'mcq' ? 'QCM' : q.type === 'true_false' ? 'Vrai/Faux' : 'Ouverte';
  const answered = (value ?? '').trim() !== '';

  return (
    <article className="surface p-5 sm:p-6 space-y-4 animate-fade-in">
      <header className="flex items-start gap-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums tracking-tight
            ${answered ? 'bg-brand-gradient text-white shadow-glow-brand' : 'bg-ink-800 text-ink-400 border border-ink-700'}`}
          aria-hidden
        >
          {answered ? (
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            index + 1
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">
              Question {index + 1}
            </span>
            <span className="chip py-0.5 text-[10px]">{typeLabel}</span>
          </div>
          <p className="text-[15px] font-medium text-ink-100 leading-relaxed text-pretty">{q.text}</p>
        </div>
      </header>

      <div className="pl-10">
        {q.type === 'mcq' && <McqField q={q} value={value} onChange={onChange} />}
        {q.type === 'true_false' && <TrueFalseField q={q} value={value} onChange={onChange} />}
        {q.type === 'open' && <OpenField q={q} value={value} onChange={onChange} />}
      </div>
    </article>
  );
}

export default function QuizPlayer({ quiz, onSubmit }: QuizPlayerProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const answeredCount = quiz.questions.filter((q) => (answers[q.id] ?? '').trim() !== '').length;
  const total = quiz.questions.length;
  const allAnswered = answeredCount === total;
  const pct = total > 0 ? (answeredCount / total) * 100 : 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(answers);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Sticky progress header */}
      <div className="sticky top-14 z-20 -mx-5 sm:-mx-6 px-5 sm:px-6 py-3 backdrop-blur-xl bg-ink-950/80 border-b border-ink-850">
        <div className="flex items-center justify-between gap-4 mb-2">
          <h3 className="font-display text-lg font-semibold tracking-tighter2 text-ink-50 truncate">
            {quiz.title}
          </h3>
          <span className="text-xs font-medium text-ink-400 tabular-nums shrink-0">
            <span className="text-ink-100 font-semibold">{answeredCount}</span>
            <span className="text-ink-600">/</span>
            <span>{total}</span>
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-ink-800 overflow-hidden">
          <div
            className="h-full bg-brand-gradient rounded-full transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="space-y-4 pb-28">
        {quiz.questions.map((q, i) => (
          <QuestionBlock
            key={q.id}
            q={q}
            index={i}
            value={answers[q.id] ?? ''}
            onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
          />
        ))}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-30 px-5 sm:px-6 pt-4 pb-5
          backdrop-blur-xl bg-gradient-to-t from-ink-950 via-ink-950/95 to-ink-950/0
          pointer-events-none"
      >
        <div className="mx-auto max-w-2xl flex items-center justify-between gap-3 pointer-events-auto">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-ink-800 bg-ink-900/80 backdrop-blur px-3 py-1.5 shadow-card">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse-soft" />
            <span className="text-xs text-ink-300">
              <span className="text-ink-50 font-semibold tabular-nums">{answeredCount}</span>
              <span className="text-ink-600 mx-1">/</span>
              <span className="tabular-nums">{total}</span>
              <span className="text-ink-500 ml-1.5">répondues</span>
            </span>
          </div>
          <button
            type="submit"
            disabled={!allAnswered}
            className="btn-primary px-6 py-3 text-[15px] sm:ml-auto"
          >
            {allAnswered ? (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                Soumettre les réponses
              </>
            ) : (
              <>
                Répondez à {total - answeredCount} question{total - answeredCount !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
