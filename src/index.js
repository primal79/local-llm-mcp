#!/usr/bin/env node
/**
 * local-llm-mcp — draft MCP side-channel to Ollama.
 * Not a Grok Bot brain replacement; tools for optional local ask/list only.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);

async function ollamaFetch(path, { method = "GET", body } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      const err = new Error(`Ollama ${res.status}: ${typeof json === "object" ? JSON.stringify(json) : text}`);
      err.status = res.status;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

const server = new McpServer({
  name: "local-llm-mcp",
  version: "0.1.0",
});

server.tool(
  "list_local_models",
  "List models available on the configured Ollama instance.",
  {},
  async () => {
    const data = await ollamaFetch("/api/tags");
    const models = (data?.models || []).map((m) => ({
      name: m.name,
      size: m.size,
      modified_at: m.modified_at,
    }));
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ base: BASE, models }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "ask_local",
  "Ask the local Ollama model a question. Use for drafts/summaries you want to keep on the local machine path.",
  {
    prompt: z.string().describe("User prompt / question"),
    system: z.string().optional().describe("Optional system instruction"),
    model: z.string().optional().describe("Override default OLLAMA_MODEL"),
  },
  async ({ prompt, system, model }) => {
    const useModel = model || DEFAULT_MODEL;
    const messages = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });

    // Prefer native /api/chat; fall back messaging shape if needed.
    const data = await ollamaFetch("/api/chat", {
      method: "POST",
      body: {
        model: useModel,
        messages,
        stream: false,
      },
    });

    const answer = data?.message?.content ?? JSON.stringify(data);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              model: useModel,
              base: BASE,
              answer,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
