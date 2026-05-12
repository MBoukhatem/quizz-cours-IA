import { AIMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { webSearchTool } from "../tools/web_search.js";
import { makeQuizGeneratorTool } from "../tools/quiz_generator.js";
import type { State } from "./state.js";

const MAX_ITERATIONS = 5;

export function makeToolsAgentNode(model: ChatOpenAI) {
  const tools = [webSearchTool, makeQuizGeneratorTool(model)];
  const modelWithTools = model.bindTools(tools);

  return async function toolsAgentNode(
    state: State
  ): Promise<Partial<State>> {
    const response = await modelWithTools.invoke(state.messages);
    return {
      messages: [response],
      iterations: state.iterations + 1,
    };
  };
}

export function makeToolNode(model: ChatOpenAI): ToolNode {
  const tools = [webSearchTool, makeQuizGeneratorTool(model)];
  return new ToolNode(tools);
}

export function shouldContinue(state: State): "tools" | "aggregator" {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];

  if (
    lastMessage instanceof AIMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls.length > 0 &&
    state.iterations < MAX_ITERATIONS
  ) {
    return "tools";
  }

  return "aggregator";
}
