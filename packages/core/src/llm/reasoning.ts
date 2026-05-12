import type { AIMessage } from "@langchain/core/messages";

// additional_kwargs is typed as Record<string, unknown> by @langchain/core;
// vLLM's qwen3 reasoning parser surfaces the field as `reasoning_content`
// (legacy) or `reasoning` (current) on the raw message object.
// Both fields are checked for forward and backward compatibility.
export function extractReasoning(message: AIMessage): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- additional_kwargs is intentionally open-ended in the SDK
  const kwargs = message.additional_kwargs as Record<string, any>;

  const value = kwargs["reasoning_content"] ?? kwargs["reasoning"];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return undefined;
}

export function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
