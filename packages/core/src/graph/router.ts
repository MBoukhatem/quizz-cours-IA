import { z } from "zod";
import type { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import type { State } from "./state.js";

const RouterOutputSchema = z.object({
  route: z.enum(["rag", "tools"]),
  intent: z.enum(["answer", "quiz"]),
  reason: z.string(),
});

type RouterOutput = z.infer<typeof RouterOutputSchema>;

const ROUTER_SYSTEM = `Tu es un routeur intelligent pour un système de questions-réponses pédagogique.

Ta mission : analyser le message de l'utilisateur et décider :
1. La route (route) :
   - "rag" : l'utilisateur pose une question sur le contenu des cours déjà ingérés dans la base de connaissances interne.
   - "tools" : l'utilisateur a besoin d'une recherche web ou d'informations externes non présentes dans les cours.

2. L'intention (intent) :
   - "quiz" : l'utilisateur demande explicitement la génération d'un quiz, d'un QCM, d'exercices ou de questions d'évaluation.
   - "answer" : l'utilisateur cherche une réponse, une explication ou un résumé.

3. La raison (reason) : une courte justification en anglais de ta décision.

Réponds uniquement avec le JSON demandé, sans texte supplémentaire.`;

export function makeRouterNode(model: ChatOpenAI) {
  const structured = model.withStructuredOutput(RouterOutputSchema, {
    name: "RouterDecision",
  });

  return async function routerNode(
    state: State
  ): Promise<Partial<State>> {
    const lastHuman = [...state.messages]
      .reverse()
      .find((m) => m._getType() === "human");
    const userText =
      typeof lastHuman?.content === "string"
        ? lastHuman.content
        : JSON.stringify(lastHuman?.content ?? "");

    const result: RouterOutput = await structured.invoke([
      new SystemMessage(ROUTER_SYSTEM),
      new HumanMessage(userText),
    ]);

    return { route: result.route, intent: result.intent };
  };
}
