import { StateGraph, START, END } from "@langchain/langgraph";
import { createChatModel } from "../llm/client.js";
import { createCheckpointer } from "../memory/checkpointer.js";
import { GraphState } from "./state.js";
import { makeRouterNode } from "./router.js";
import { makeRagAgentNode } from "./rag_agent.js";
import { makeToolsAgentNode, makeToolNode, shouldContinue } from "./tools_agent.js";
import { aggregatorNode } from "./aggregator.js";
import type { State } from "./state.js";

export interface BuildGraphOptions {
  checkpointerPath?: string;
}

function routeFromState(state: State): "rag_agent" | "tools_agent" {
  return state.route === "tools" ? "tools_agent" : "rag_agent";
}

export function buildGraph(opts?: BuildGraphOptions) {
  const model = createChatModel();
  const checkpointer = createCheckpointer(opts?.checkpointerPath);

  const routerNode = makeRouterNode(model);
  const ragAgentNode = makeRagAgentNode(model);
  const toolsAgentNode = makeToolsAgentNode(model);
  const toolNode = makeToolNode(model);

  const graph = new StateGraph(GraphState)
    .addNode("router", routerNode)
    .addNode("rag_agent", ragAgentNode)
    .addNode("tools_agent", toolsAgentNode)
    .addNode("tools", toolNode)
    .addNode("aggregator", aggregatorNode)
    .addEdge(START, "router")
    .addConditionalEdges("router", routeFromState, {
      rag_agent: "rag_agent",
      tools_agent: "tools_agent",
    })
    .addEdge("rag_agent", "aggregator")
    .addConditionalEdges("tools_agent", shouldContinue, {
      tools: "tools",
      aggregator: "aggregator",
    })
    .addEdge("tools", "tools_agent")
    .addEdge("aggregator", END);

  return graph.compile({ checkpointer });
}
