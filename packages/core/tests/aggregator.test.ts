import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { aggregatorNode } from "../src/graph/aggregator.js";
import type { State } from "../src/graph/state.js";
import type { Citation } from "../src/graph/state.js";
import type { Quiz } from "../src/tools/schemas.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<State>): State {
  return {
    messages: [],
    route: undefined,
    intent: undefined,
    retrieved: [],
    quiz: undefined,
    citations: [],
    iterations: 0,
    ...overrides,
  };
}

const sampleQuiz: Quiz = {
  topic: "JavaScript",
  difficulty: "facile",
  questions: [
    {
      type: "mcq",
      question: "Quel mot-clé déclare une constante ?",
      options: ["var", "let", "const", "def"],
      answerIndex: 2,
      explanation: "const déclare une liaison immuable.",
    },
  ],
};

const sampleCitations: Citation[] = [
  { source: "cours_js.pdf", page: 3, chunkIndex: 7, score: 0.91 },
  { source: "annexe.pdf", chunkIndex: 12, score: 0.76 },
];

// ---------------------------------------------------------------------------
// When state.quiz is set
// ---------------------------------------------------------------------------

describe("aggregatorNode — quiz branch", () => {
  it("emits exactly one AIMessage when state.quiz is defined", () => {
    const state = makeState({ quiz: sampleQuiz, citations: [] });
    const patch = aggregatorNode(state);
    expect(patch.messages).toHaveLength(1);
    expect(patch.messages![0]).toBeInstanceOf(AIMessage);
  });

  it("the content parses as JSON with kind='quiz'", () => {
    const state = makeState({ quiz: sampleQuiz, citations: [] });
    const patch = aggregatorNode(state);
    const content = (patch.messages![0] as AIMessage).content as string;
    const parsed = JSON.parse(content);
    expect(parsed.kind).toBe("quiz");
  });

  it("the parsed payload includes the quiz object", () => {
    const state = makeState({ quiz: sampleQuiz, citations: [] });
    const patch = aggregatorNode(state);
    const content = (patch.messages![0] as AIMessage).content as string;
    const parsed = JSON.parse(content);
    expect(parsed.quiz).toEqual(sampleQuiz);
  });

  it("the parsed payload includes citations when they exist", () => {
    const state = makeState({ quiz: sampleQuiz, citations: sampleCitations });
    const patch = aggregatorNode(state);
    const content = (patch.messages![0] as AIMessage).content as string;
    const parsed = JSON.parse(content);
    expect(parsed.citations).toEqual(sampleCitations);
  });

  it("the parsed payload includes an empty citations array when none exist", () => {
    const state = makeState({ quiz: sampleQuiz, citations: [] });
    const patch = aggregatorNode(state);
    const content = (patch.messages![0] as AIMessage).content as string;
    const parsed = JSON.parse(content);
    expect(parsed.citations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// When state.quiz is not set — answer branch
// ---------------------------------------------------------------------------

describe("aggregatorNode — answer branch", () => {
  it("returns empty patch when there are no messages", () => {
    const state = makeState({ messages: [], citations: [] });
    const patch = aggregatorNode(state);
    expect(patch.messages).toBeUndefined();
  });

  it("returns empty patch when there is only a HumanMessage", () => {
    const state = makeState({
      messages: [new HumanMessage("Bonjour")],
      citations: [],
    });
    const patch = aggregatorNode(state);
    expect(patch.messages).toBeUndefined();
  });

  it("emits one AIMessage whose content equals the last AI message content (no citations)", () => {
    const originalContent = "Voici la réponse à votre question.";
    const state = makeState({
      messages: [
        new HumanMessage("Question ?"),
        new AIMessage(originalContent),
      ],
      citations: [],
    });
    const patch = aggregatorNode(state);
    expect(patch.messages).toHaveLength(1);
    const msg = patch.messages![0] as AIMessage;
    expect(msg.content).toBe(originalContent);
  });

  it("appends a citations footer when citations are present", () => {
    const state = makeState({
      messages: [
        new HumanMessage("Question ?"),
        new AIMessage("Réponse de l'agent."),
      ],
      citations: sampleCitations,
    });
    const patch = aggregatorNode(state);
    const content = (patch.messages![0] as AIMessage).content as string;
    expect(content).toContain("Sources :");
    expect(content).toContain("cours_js.pdf");
    expect(content).toContain("p.3");
    expect(content).toContain("chunk 7");
  });

  it("includes score formatted to 3 decimal places in citations footer", () => {
    const state = makeState({
      messages: [new HumanMessage("?"), new AIMessage("réponse")],
      citations: [{ source: "doc.pdf", chunkIndex: 0, score: 0.9 }],
    });
    const patch = aggregatorNode(state);
    const content = (patch.messages![0] as AIMessage).content as string;
    expect(content).toContain("0.900");
  });

  it("picks the LAST AIMessage when multiple AI messages are in state", () => {
    const state = makeState({
      messages: [
        new AIMessage("Première réponse."),
        new HumanMessage("Suivi ?"),
        new AIMessage("Deuxième réponse."),
      ],
      citations: [],
    });
    const patch = aggregatorNode(state);
    const content = (patch.messages![0] as AIMessage).content as string;
    expect(content).toBe("Deuxième réponse.");
  });

  it("omits the citations footer when citations array is empty", () => {
    const state = makeState({
      messages: [new HumanMessage("?"), new AIMessage("réponse")],
      citations: [],
    });
    const patch = aggregatorNode(state);
    const content = (patch.messages![0] as AIMessage).content as string;
    expect(content).not.toContain("Sources :");
  });
});
