import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { Command } from "commander";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pkg = require("../package.json") as { version: string };

const program = new Command();

program
  .name("quizz")
  .description("CLI REPL for the multi-agent RAG quiz system")
  .version(pkg.version);

program
  .command("chat")
  .description("Open the interactive REPL")
  .option("--thread <uuid>", "Resume an existing thread by UUID")
  .action(async (opts: { thread?: string }) => {
    const { buildGraph } = await import("@quizz/core");
    const { render } = await import("ink");
    const React = (await import("react")).default;
    const { App } = await import("./app.js");

    const threadId = opts.thread ?? randomUUID();
    console.log(`thread: ${threadId}`);

    const graph = buildGraph();

    render(React.createElement(App, { graph, threadId }));
  });

program
  .command("ingest")
  .description("Ingest one or more course documents into the vector store")
  .argument("<file...>", "Paths to .pdf, .docx, .md or .txt files")
  .action(async (files: string[]) => {
    const { runIngest } = await import("./commands/ingest.js");
    await runIngest(files);
  });

program
  .command("health")
  .description("Check connectivity to vLLM, Infinity, and Qdrant")
  .action(async () => {
    const { runHealth } = await import("./commands/health.js");
    await runHealth();
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[quizz] fatal: ${message}\n`);
  process.exit(1);
});
