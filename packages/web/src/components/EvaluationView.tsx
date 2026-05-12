import type { EvaluationResult, QuestionFeedback } from '../lib/types';

interface EvaluationViewProps {
  result: EvaluationResult;
}

type Tone = 'success' | 'warn' | 'fail';

function toneOf(score: number): Tone {
  if (score >= 0.8) return 'success';
  if (score >= 0.5) return 'warn';
  return 'fail';
}

const toneStyles: Record<Tone, { ring: string; pill: string; text: string; bar: string; dot: string }> = {
  success: {
    ring: 'border-emerald-500/30 bg-emerald-500/[0.06]',
    pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    text: 'text-emerald-300',
    bar: 'bg-emerald-400',
    dot: 'bg-emerald-400',
  },
  warn: {
    ring: 'border-amber-500/30 bg-amber-500/[0.06]',
    pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    text: 'text-amber-300',
    bar: 'bg-amber-400',
    dot: 'bg-amber-400',
  },
  fail: {
    ring: 'border-rose-500/30 bg-rose-500/[0.06]',
    pill: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    text: 'text-rose-300',
    bar: 'bg-rose-400',
    dot: 'bg-rose-400',
  },
};

function FeedbackCard({ item, index }: { item: QuestionFeedback; index: number }) {
  const tone = toneOf(item.score);
  const s = toneStyles[tone];
  const pct = Math.round(item.score * 100);

  return (
    <article
      className={`rounded-xl border ${s.ring} p-4 sm:p-5 transition-all duration-200 hover:border-opacity-60 animate-slide-up`}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
            Question {index + 1}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${s.pill}`}>
            {item.correct ? 'correcte' : 'à revoir'}
          </span>
        </div>
        <span className={`font-display text-xl font-semibold tabular-nums tracking-tighter2 ${s.text}`}>
          {pct}%
        </span>
      </div>
      <p className="text-sm text-ink-200 leading-relaxed text-pretty">{item.feedback}</p>
    </article>
  );
}

function CircularScore({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (c * pct) / 100;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <defs>
          <linearGradient id="score-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="url(#score-grad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="flex items-baseline gap-0.5 leading-none">
          <span className="font-display text-[44px] font-semibold tracking-tightest gradient-text tabular-nums">
            {pct}
          </span>
          <span className="font-display text-xl font-semibold tracking-tightest text-ink-400">%</span>
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-500 mt-1.5">
          score
        </span>
      </div>
    </div>
  );
}

export default function EvaluationView({ result }: EvaluationViewProps) {
  const correctCount = result.feedback.filter((f) => f.correct).length;
  const total = result.feedback.length;
  const verdict =
    result.totalScore >= 0.8
      ? { title: 'Excellent travail', sub: 'Vous maîtrisez ce contenu.', tone: 'success' as const }
      : result.totalScore >= 0.5
        ? { title: 'Bon début', sub: 'Quelques notions à consolider.', tone: 'warn' as const }
        : { title: 'À revoir', sub: 'Reprenez les sections clés du document.', tone: 'fail' as const };
  const verdictAccent =
    verdict.tone === 'success' ? 'text-emerald-300'
    : verdict.tone === 'warn' ? 'text-amber-300'
    : 'text-rose-300';

  return (
    <div className="space-y-6">
      {/* Hero score card */}
      <div className="relative overflow-hidden surface p-6 sm:p-8 animate-pop-in">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-10 h-64 w-64 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.5), transparent 70%)' }}
        />
        <div className="relative flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <CircularScore score={result.totalScore} />
          <div className="flex-1 text-center sm:text-left space-y-2">
            <span className="chip">Résultat</span>
            <h2 className={`font-display text-3xl sm:text-4xl font-semibold tracking-tightest leading-tight ${verdictAccent}`}>
              {verdict.title}
            </h2>
            <p className="text-sm text-ink-300 text-pretty">{verdict.sub}</p>
            <div className="flex items-center justify-center sm:justify-start gap-4 pt-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-ink-300 font-medium tabular-nums">{correctCount}</span>
                <span className="text-ink-500">correctes</span>
              </div>
              <div className="h-3 w-px bg-ink-800" />
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                <span className="text-ink-300 font-medium tabular-nums">{total - correctCount}</span>
                <span className="text-ink-500">à revoir</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Per-question feedback */}
      <div className="space-y-3">
        <p className="eyebrow px-1">Détail par question</p>
        {result.feedback.map((item, i) => (
          <FeedbackCard key={item.questionId} item={item} index={i} />
        ))}
      </div>
    </div>
  );
}
