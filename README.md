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

- **Is:** `ask_local` / `list_local_models` / `redact_text` for drafts, summaries, and light DLP on returned text.
- **Is not:** a full replacement for Grok Bot’s brain, nor a guarantee that no sensitive data ever leaks.

## Output redaction (draft)

Goals: reduce the chance that **answers** echoed back into the orchestrator contain obvious secrets.

| Mechanism | Behavior |
|-----------|----------|
| No-echo system hint | Prefixed into `ask_local` unless `allow_echo=true` |
| `redactOutput()` | Regex masks IBAN, card-like digit runs, rodné číslo, email, phone, API-key-ish tokens, Bearer, AKIA… |
| `redact_text` tool | Same redaction without calling the model |
| `REDACT_OUTPUT=true` | Default: redact `ask_local` answers |

**Limits:** heuristics miss novel formats; do **not** put hard secrets into prompts — use env / secret forms instead.

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
| `ask_local` | Prompt local model; optional redact + no-echo policy |
| `redact_text` | Redact text only (no LLM call) |

## Wire into Grok Bot / Cursor

1. Run this MCP somewhere reachable (same Tailscale network as Ollama, or on the PC itself).
2. Add it as a **custom MCP** (stdio or HTTP URL, depending on how you run it).
3. Store nothing sensitive in chat — put `OLLAMA_BASE_URL` / model name in env on the MCP host.

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

- Only send text you are willing to put on the machine that runs Ollama.
- Prefer Tailscale ACLs so only your Grok Bot host / laptop can reach `:11434`.
- Do not expose Ollama to the public internet.
- Redaction is defense-in-depth, not a vault.

## Status

**Draft** scaffold for experimentation. APIs and packaging may change.

## License

MIT
