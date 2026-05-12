import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { QuizSchema } from "./schemas.js";

const inputSchema = z.object({
  topic: z.string().describe("The topic of the quiz."),
  context: z
    .string()
    .describe("Source content (RAG chunks or web search results)"),
  difficulty: z
    .enum(["facile", "moyen", "difficile"])
    .default("moyen")
    .describe("Difficulty level of the quiz."),
  numQuestions: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe("Number of questions to generate."),
  types: z
    .array(z.enum(["mcq", "true_false", "open"]))
    .default(["mcq", "true_false"])
    .describe("Question types to include."),
});

export function makeQuizGeneratorTool(model: ChatOpenAI) {
  return tool(
    async ({ topic, context, difficulty, numQuestions, types }) => {
      const structured = model.withStructuredOutput(QuizSchema, {
        name: "Quiz",
      });

      const typeDescriptions: Record<string, string> = {
        mcq: "QCM (4 options, une seule bonne réponse)",
        true_false: "Vrai/Faux",
        open: "Question ouverte",
      };
      const typeList = types.map((t) => typeDescriptions[t] ?? t).join(", ");

      const system = new SystemMessage(
        `Tu es un expert pédagogique. Tu génères des quiz en français strictement fondés sur le contenu fourni.\n` +
          `Règles impératives :\n` +
          `- N'invente aucun fait absent du contexte.\n` +
          `- Chaque explication doit référencer explicitement le contexte.\n` +
          `- Produis UNIQUEMENT le JSON du quiz, sans texte supplémentaire.\n` +
          `- Respecte exactement le schéma JSON demandé.`
      );

      const user = new HumanMessage(
        `Génère un quiz sur le sujet : "${topic}".\n\n` +
          `Niveau de difficulté : ${difficulty}.\n` +
          `Nombre de questions : ${numQuestions}.\n` +
          `Types de questions à utiliser : ${typeList}.\n\n` +
          `--- CONTEXTE ---\n${context}\n--- FIN DU CONTEXTE ---\n\n` +
          `Assure-toi que chaque question et explication est directement fondée sur le contexte ci-dessus.`
      );

      const quiz = await structured.invoke([system, user]);
      return JSON.stringify(quiz);
    },
    {
      name: "quiz_generator",
      description:
        "Generate a structured quiz in French on a given topic using provided source content. Supports multiple choice (mcq), true/false, and open questions. Returns a JSON string conforming to the QuizSchema.",
      schema: inputSchema,
    }
  );
}
