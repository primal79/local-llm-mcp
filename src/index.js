#!/usr/bin/env node
/**
 * local-llm-mcp — draft MCP side-channel to Ollama.
 * Not a Grok Bot brain replacement; tools for optional local ask/list only.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { redactOutput, defaultNoEchoSystem } from "./redact.js";

const BASE = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);
const REDACT_DEFAULT = (process.env.REDACT_OUTPUT || "true").toLowerCase() !== "false";

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
  version: "0.2.0",
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
  "redact_text",
  "Redact likely sensitive patterns from outbound/MCP-bound text (IBAN, cards, emails, tokens, etc.). Heuristic output DLP only — not for scrubbing local prompts.",
  {
    text: z.string().describe("Text to redact"),
    skip: z
      .array(z.string())
      .optional()
      .describe("Rule ids to skip, e.g. email, phone_eu, card"),
  },
  async ({ text, skip }) => {
    const { text: redacted, matches } = redactOutput(text, { skip });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ redacted, match_count: matches.length, matches }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "ask_local",
  "Ask the local Ollama model. Secrets/PII in the prompt are allowed (stay on Ollama). By default appends a no-echo system hint and redacts the *answer* before returning it over MCP (output-only DLP).",
  {
    prompt: z.string().describe("User prompt / question (may include secrets/PII; processed only on local Ollama)"),
    system: z.string().optional().describe("Optional system instruction (merged with no-echo policy)"),
    model: z.string().optional().describe("Override default OLLAMA_MODEL"),
    redact: z
      .boolean()
      .optional()
      .describe("Redact answer before MCP return (default: env REDACT_OUTPUT, usually true). Does not scrub the inbound prompt."),
    allow_echo: z
      .boolean()
      .optional()
      .describe("If true, skip the built-in no-echo system add-on (weakens output DLP; not recommended)"),
  },
  async ({ prompt, system, model, redact, allow_echo }) => {
    const useModel = model || DEFAULT_MODEL;
    const doRedact = redact ?? REDACT_DEFAULT;
    const messages = [];
    const sysParts = [];
    if (!allow_echo) sysParts.push(defaultNoEchoSystem());
    if (system) sysParts.push(system);
    if (sysParts.length) messages.push({ role: "system", content: sysParts.join("\n\n") });
    messages.push({ role: "user", content: prompt });

    const data = await ollamaFetch("/api/chat", {
      method: "POST",
      body: {
        model: useModel,
        messages,
        stream: false,
      },
    });

    let answer = data?.message?.content ?? JSON.stringify(data);
    let redaction = null;
    if (doRedact) {
      const r = redactOutput(answer);
      answer = r.text;
      redaction = { match_count: r.matches.length, matches: r.matches };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              model: useModel,
              base: BASE,
              redacted: doRedact,
              redaction,
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
