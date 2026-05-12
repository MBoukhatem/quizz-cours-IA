import { tool } from "@langchain/core/tools";
import { search, SafeSearchType } from "duck-duck-scrape";
import { z } from "zod";

export const webSearchTool = tool(
  async ({ query, maxResults }) => {
    try {
      const results = await search(query, {
        region: process.env.DDG_REGION ?? "fr-fr",
        safeSearch: SafeSearchType.MODERATE,
      });

      if (results.noResults || results.results.length === 0) {
        return "web_search error: no results found for this query.";
      }

      const hits = results.results.slice(0, maxResults);
      return hits
        .map(
          (r, i) =>
            `${i + 1}. ${r.title} — ${r.url}\n   ${r.description ?? ""}`.trimEnd()
        )
        .join("\n");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `web_search error: ${message}`;
    }
  },
  {
    name: "web_search",
    description:
      "Search the web using DuckDuckGo and return a numbered list of results. Each result includes the page title, URL, and a short snippet. Use this tool to find up-to-date information not available in internal course documents.",
    schema: z.object({
      query: z.string().min(2).describe("The search query to send to DuckDuckGo."),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(5)
        .describe("Maximum number of results to return (1–10, default 5)."),
    }),
  }
);
