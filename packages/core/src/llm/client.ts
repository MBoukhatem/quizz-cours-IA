import { ChatOpenAI } from "@langchain/openai";

export interface ChatModelOptions {
  model: string;
  temperature: number;
  streaming: boolean;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Ensure ${name} is set before constructing the chat model.`
    );
  }
  return value;
}

export function createChatModel(
  overrides?: Partial<ChatModelOptions>
): ChatOpenAI {
  const baseURL = requireEnv("VLLM_BASE_URL");
  const apiKey = requireEnv("VLLM_API_KEY");
  const model = requireEnv("VLLM_MODEL");

  return new ChatOpenAI({
    model: overrides?.model ?? model,
    temperature: overrides?.temperature ?? 0.2,
    streaming: overrides?.streaming ?? false,
    apiKey,
    configuration: {
      baseURL,
    },
  });
}
