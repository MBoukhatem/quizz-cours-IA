import type { ChatMessage } from "../types";
import QuizCard from "./QuizCard";
import ThoughtList from "./ThoughtList";

type Props = {
  message: ChatMessage;
};

export default function MessageBubble({ message }: Props) {
  if (message.role === "system") {
    const color =
      message.kind === "error"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-neutral-200 bg-neutral-100 text-neutral-700";
    return (
      <div className={`mx-auto max-w-2xl rounded border px-3 py-2 text-xs ${color}`}>
        {message.content}
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-2xl rounded-2xl rounded-br-sm bg-neutral-900 px-4 py-2 text-white shadow-sm">
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-2xl rounded-2xl rounded-bl-sm border border-neutral-200 bg-white px-4 py-3 shadow-sm">
        {message.injectionDetected && (
          <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
            Tentative d'injection détectée — votre requête a été nettoyée.
          </div>
        )}
        {message.quiz ? (
          <QuizCard quiz={message.quiz} />
        ) : (
          <div className="whitespace-pre-wrap break-words text-neutral-900">
            {message.content}
          </div>
        )}
        {message.thoughts && message.thoughts.length > 0 && (
          <ThoughtList thoughts={message.thoughts} />
        )}
      </div>
    </div>
  );
}
