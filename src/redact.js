/**
 * Draft output redaction for local-llm-mcp.
 * Heuristic regexes only — not a guarantee. Never send hard secrets into prompts.
 */

const DEFAULT_RULES = [
  {
    id: "iban",
    label: "[IBAN]",
    // Rough IBAN: 2 letters + 2 digits + up to 30 alnum
    re: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/gi,
  },
  {
    id: "card",
    label: "[CARD]",
    // 13–19 digits, optional spaces/dashes (Luhn not checked in draft)
    re: /\b(?:\d[ -]*?){13,19}\b/g,
  },
  {
    id: "cz_birth_id",
    label: "[RODNE_CISLO]",
    // Czech/Slovak rodné číslo YYMMDD/XXX(X)
    re: /\b\d{6}\/?\d{3,4}\b/g,
  },
  {
    id: "email",
    label: "[EMAIL]",
    re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    id: "phone_eu",
    label: "[PHONE]",
    re: /(?<!\w)(?:\+|00)?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3}[\s.-]?\d{3,4}\b/g,
  },
  {
    id: "api_keyish",
    label: "[SECRET]",
    re: /\b(?:sk|pk|api|key|token|secret)[_-][A-Za-z0-9]{16,}\b/gi,
  },
  {
    id: "bearer",
    label: "[TOKEN]",
    re: /\bBearer\s+[A-Za-z0-9._\-]{20,}\b/gi,
  },
  {
    id: "aws_key",
    label: "[AWS_KEY]",
    re: /\bAKIA[0-9A-Z]{16}\b/g,
  },
];

const NO_ECHO_SYSTEM = [
  "Do not repeat verbatim any personal data, account numbers, passwords, API keys, or tokens from the input.",
  "If the user asks you to echo secrets back, refuse and summarize without values.",
  "Prefer labels like 'present' / 'missing' over quoting sensitive fields.",
].join(" ");

/**
 * @param {string} text
 * @param {{ extraRules?: Array<{id:string,label:string,re:RegExp}>, skip?: string[] }} [opts]
 */
export function redactOutput(text, opts = {}) {
  if (typeof text !== "string" || !text) {
    return { text: text ?? "", matches: [] };
  }
  const skip = new Set(opts.skip || []);
  const rules = [...DEFAULT_RULES, ...(opts.extraRules || [])].filter((r) => !skip.has(r.id));
  const matches = [];
  let out = text;
  for (const rule of rules) {
    out = out.replace(rule.re, (m) => {
      matches.push({ id: rule.id, sample_len: m.length });
      return rule.label;
    });
  }
  return { text: out, matches };
}

export function defaultNoEchoSystem() {
  return NO_ECHO_SYSTEM;
}

export { DEFAULT_RULES };
