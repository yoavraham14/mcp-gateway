#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = "https://www.remoterocketship.com/api/openclaw/jobs";

const RR_API_KEY = process.env.RR_API_KEY;
if (!RR_API_KEY) {
  console.error("Missing required environment variable: RR_API_KEY");
  process.exit(1);
}

const filtersShape = {
  jobTitleFilters: z
    .array(z.string())
    .optional()
    .describe("Job titles to filter by"),
  locationFilters: z
    .array(z.string())
    .optional()
    .describe("Locations to filter by"),
  seniorityFilters: z
    .array(z.string())
    .optional()
    .describe("Seniority levels to filter by"),
  techStackFilters: z
    .array(z.string())
    .optional()
    .describe("Technologies to filter by"),
  showRemoteJobs: z
    .boolean()
    .optional()
    .describe("Whether to only show remote jobs"),
  minSalaryFilter: z
    .number()
    .optional()
    .describe("Minimum salary filter"),
  page: z.number().int().optional().describe("Page number to fetch"),
  itemsPerPage: z
    .number()
    .int()
    .optional()
    .describe("Number of items to return per page"),
};

const server = new McpServer({
  name: "remote-rocketship-mcp",
  version: "1.0.0",
});

server.registerTool(
  "search_remote_rocketship_jobs",
  {
    title: "Search RemoteRocketship Jobs",
    description:
      "Search job openings on RemoteRocketship using the given filters.",
    inputSchema: filtersShape,
  },
  async (filters) => {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RR_API_KEY}`,
      },
      body: JSON.stringify({ filters }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `RemoteRocketship API request failed: ${response.status} ${response.statusText} - ${body}`
      );
    }

    const data = await response.json();
    const jobOpenings = data.jobOpenings ?? [];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(jobOpenings, null, 2),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("RemoteRocketship MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
