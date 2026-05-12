import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { UseThreadResult } from '../hooks/useThread';

interface LayoutProps {
  thread: UseThreadResult;
  children: ReactNode;
}

function LogoMark() {
  return (
    <span
      aria-hidden
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient shadow-glow-brand"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-white">
        <path d="M5 4h10l4 4v12H5z" />
        <path d="M9 10h6M9 14h6M9 18h3" />
      </svg>
    </span>
  );
}

export default function Layout({ thread, children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-ink-950/70 border-b border-ink-850">
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center gap-4">
          <Link
            to="/"
            onClick={thread.reset}
            className="flex items-center gap-2.5 group"
            aria-label="Quizz Cours IA — accueil"
          >
            <LogoMark />
            <span className="font-display font-semibold text-ink-100 tracking-tighter2 text-[15px] group-hover:text-white transition-colors">
              Quizz<span className="text-ink-400 font-normal">·</span>IA
            </span>
          </Link>

          <span className="hidden sm:inline-flex chip">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
            beta
          </span>

          <div className="ml-auto flex items-center gap-2">
            <div
              className="hidden md:flex items-center gap-2 rounded-full bg-ink-850/70 border border-ink-800 px-3 py-1.5 text-[11px] text-ink-400"
              title={thread.threadId}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-500">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              <span className="font-mono">{thread.threadId.slice(0, 8)}</span>
            </div>
            <button
              type="button"
              onClick={thread.reset}
              className="btn-ghost text-xs px-3 py-1.5"
              aria-label="Démarrer une nouvelle session"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </svg>
              Nouvelle session
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">{children}</main>

      <footer className="border-t border-ink-850 mt-12">
        <div className="mx-auto max-w-5xl px-6 py-5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-ink-500">
          <span>
            Conçu pour réviser plus vite. Aucun fichier conservé après la session.
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            propulsé par RAG local
          </span>
        </div>
      </footer>
    </div>
  );
}
