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

- **Is:** `ask_local` / `list_local_models` tools for drafts, summaries, classification of text you choose to send locally.
- **Is not:** a full replacement for Grok Bot’s brain, nor an official České dráhy connector.

## Requirements

- Node.js 20+
- [Ollama](https://ollama.com/) on your machine with at least one model pulled
- Optional: [Tailscale](https://tailscale.com/) so the host running this MCP can reach Ollama at a stable Tailscale IP

## Configure

```bash
cp .env.example .env
# set OLLAMA_BASE_URL=http://100.x.y.z:11434   # Tailscale IP of the PC with Ollama
# set OLLAMA_MODEL=llama3.2
npm install
npm start
```

## Tools

| Tool | Purpose |
|------|---------|
| `list_local_models` | List models known to Ollama |
| `ask_local` | Send a prompt (+ optional system) to the local model |

## Wire into Grok Bot / Cursor

1. Run this MCP somewhere reachable (same Tailscale network as Ollama, or on the PC itself).
2. Add it as a **custom MCP** (stdio or HTTP URL, depending on how you run it).
3. Store nothing sensitive in chat — put `OLLAMA_BASE_URL` / model name in env on the MCP host.

### Stdio (local process)

Example Cursor / MCP config shape:

```json
{
  "mcpServers": {
    "local-llm": {
      "command": "node",
      "args": ["/path/to/local-llm-mcp/src/index.js"],
      "env": {
        "OLLAMA_BASE_URL": "http://127.0.0.1:11434",
        "OLLAMA_MODEL": "llama3.2"
      }
    }
  }
}
```

## Security notes

- Only send text you are willing to put on the machine that runs Ollama.
- Prefer Tailscale ACLs so only your Grok Bot host / laptop can reach `:11434`.
- Do not expose Ollama to the public internet.

## Status

**Draft** scaffold for experimentation. APIs and packaging may change.

## License

MIT
