import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { listSessions, submitQuiz } from '../lib/api';
import type { EvaluationResult, Quiz as QuizType, SessionSummary } from '../lib/types';
import QuizPlayer from '../components/QuizPlayer';
import EvaluationView from '../components/EvaluationView';

interface LocationState {
  result?: EvaluationResult;
}

interface QuizPageProps {
  threadId: string;
}

export default function Quiz({ threadId }: QuizPageProps) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const locationState = location.state as LocationState | null;

  // If we navigated here with a pre-computed result, show it right away
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(
    locationState?.result ?? null,
  );
  // quiz is populated when the page is opened without a pre-computed evaluation
  // (e.g. deep link to /quiz/:id). Requires a GET /quiz/sessions/:id endpoint
  // which is not yet in the spec; kept as a forward-compatible hook.
  const [quiz] = useState<QuizType | null>(null);
  const [loading, setLoading] = useState(!locationState?.result);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (evaluation) return; // already have result from navigation state
    if (!sessionId) return;

    setLoading(true);
    listSessions(threadId)
      .then((sessions: SessionSummary[]) => {
        const found = sessions.some((s) => s.sessionId === sessionId);
        if (!found) {
          setError('Session not found.');
        }
        // Sessions list does not include the full Quiz object; we show a placeholder.
        // Actual quiz content would need a GET /quiz/sessions/:id endpoint.
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [sessionId, threadId, evaluation]);

  async function handleSubmit(answers: Record<string, string>) {
    if (!sessionId) return;
    try {
      const result = await submitQuiz({ sessionId, threadId, answers });
      setEvaluation(result);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 text-zinc-500 text-sm animate-pulse">
        Loading session…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center flex-1 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (evaluation) {
    return (
      <div className="max-w-2xl mx-auto w-full px-6 py-10">
        <h1 className="text-xl font-semibold text-zinc-100 mb-6">Quiz results</h1>
        <EvaluationView result={evaluation} />
      </div>
    );
  }

  if (quiz) {
    return (
      <div className="max-w-2xl mx-auto w-full px-6 py-10">
        <QuizPlayer quiz={quiz} onSubmit={(answers) => void handleSubmit(answers)} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center flex-1 text-zinc-500 text-sm">
      No quiz data available for session <span className="font-mono ml-1">{sessionId}</span>.
    </div>
  );
}
