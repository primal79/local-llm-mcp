# local-llm-mcp (draft)

Small **MCP side-channel** so an orchestrator (e.g. Grok Bot) can **ask a local LLM** (Ollama) without replacing its own cloud model.

Typical layout:

```
[Grok Bot / Cursor]  --MCP-->  [this server]
                                    |
                              Tailscale / LAN
                                    |
                              [your PC: Ollama :11434]
```

## What this is / is not

- **Is:** `ask_local` / `list_local_models` / `redact_text` for drafts, summaries, and **output-only DLP** on text returned over MCP.
- **Is not:** a full replacement for Grok Bot’s brain, nor a guarantee that every secret format is caught by heuristics.

## Privacy policy (output-only DLP)

**Prompts to the local model may include secrets / PII.** That is intentional: the prompt stays on your machine (Ollama) and is not the leak path this server hardens.

**Answers returned via MCP to Grok Bot / cloud must be filtered.** Redaction applies to the model’s **response** before it leaves this server — not to the inbound local prompt.

| Mechanism | Behavior |
|-----------|----------|
| No-echo system hint | Prefixed into `ask_local` unless `allow_echo=true` — steers the model not to repeat secrets in its answer |
| `redactOutput()` | Regex masks IBAN, card-like digit runs, rodné číslo, email, phone, API-key-ish tokens, Bearer, AKIA… on **returned** text |
| `redact_text` tool | Same redaction without calling the model |
| `REDACT_OUTPUT=true` | Default: redact `ask_local` answers before MCP return |

**Limits:** heuristics miss novel formats. Treat redaction as defense-in-depth on the **outbound MCP answer**, not as a reason to scrub the local prompt. Hard secrets that must never leave the box still belong in env / secret forms on the MCP host when practical — but putting sensitive context in the local prompt is allowed.

## Requirements

- Node.js 20+
- [Ollama](https://ollama.com/) on your machine with at least one model pulled
- Optional: [Tailscale](https://tailscale.com/) so the host running this MCP can reach Ollama at a stable Tailscale IP

## Configure

```bash
cp .env.example .env
# set OLLAMA_BASE_URL=http://100.x.y.z:11434   # Tailscale IP of the PC with Ollama
# set OLLAMA_MODEL=llama3.2
# set REDACT_OUTPUT=true
npm install
npm start
```

## Tools

| Tool | Purpose |
|------|---------|
| `list_local_models` | List models known to Ollama |
| `ask_local` | Prompt local model (secrets/PII in the prompt OK); redacts the **answer** before MCP return by default |
| `redact_text` | Redact text only (no LLM call) — for outbound/MCP-bound text |

## Wire into Grok Bot / Cursor

1. Run this MCP somewhere reachable (same Tailscale network as Ollama, or on the PC itself).
2. Add it as a **custom MCP** (stdio or HTTP URL, depending on how you run it).
3. Keep `OLLAMA_BASE_URL` / model name in env on the MCP host. Sensitive context may go in the local `ask_local` prompt; rely on output redaction for what comes back to the cloud orchestrator.

### Stdio (local process)

```json
{
  "mcpServers": {
    "local-llm": {
      "command": "node",
      "args": ["/path/to/local-llm-mcp/src/index.js"],
      "env": {
        "OLLAMA_BASE_URL": "http://127.0.0.1:11434",
        "OLLAMA_MODEL": "llama3.2",
        "REDACT_OUTPUT": "true"
      }
    }
  }
}
```

## Security notes

- Local prompts may contain secrets/PII; they stay on the Ollama host. The critical boundary is the **MCP return path** to Grok Bot / cloud.
- Prefer Tailscale ACLs so only your Grok Bot host / laptop can reach `:11434`.
- Do not expose Ollama to the public internet.
- Output redaction is defense-in-depth, not a vault — leave `REDACT_OUTPUT=true` unless you intentionally need raw answers.

## Status

**Draft** scaffold for experimentation. APIs and packaging may change.

## License

MIT
