const PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i, reason: 'instruction override attempt' },
  { re: /ignore\s+(toutes?\s+)?(les?\s+)?(instructions?|consignes?)\s+(pr[eé]c[eé]dentes?|ci-dessus)/i, reason: 'instruction override attempt (fr)' },
  { re: /\bsystem\s+prompt\b/i, reason: 'system prompt disclosure attempt' },
  { re: /prompt\s+syst[eè]me/i, reason: 'system prompt disclosure attempt (fr)' },
  { re: /tu\s+es\s+(maintenant|d[eé]sormais|d[eé]sormais\s+un)/i, reason: 'role override attempt (fr)' },
  { re: /you\s+are\s+now\s+(a\s+)?(different|new|another|an?\s+)/i, reason: 'role override attempt' },
  { re: /act\s+as\s+(a\s+)?(different|new|another|an?\s+)/i, reason: 'role override attempt' },
  { re: /agis\s+(comme|en\s+tant\s+que)\s+/i, reason: 'role override attempt (fr)' },
  { re: /^```\s*system\b/im, reason: 'fenced system block injection' },
  { re: /\[SYSTEM\]/i, reason: 'system tag injection' },
  { re: /reveal\s+(your\s+)?(api\s+key|secret|password|token|credential)/i, reason: 'credential extraction attempt' },
  { re: /r[eé]v[eè]le?\s+(ta|ton|la|le|les|tes)\s+(cl[eé]s?\s+api|mot\s+de\s+passe|secrets?|tokens?|identifiants?|variables?\s+d['’\s]?environnement)/i, reason: 'credential extraction attempt (fr)' },
  { re: /\b(VLLM_API_KEY|API_KEY|SECRET|TOKEN)\b/i, reason: 'env var disclosure attempt' },
  { re: /repeat\s+(everything|the\s+(above|previous|system))/i, reason: 'context extraction attempt' },
  { re: /what\s+(are\s+)?your\s+(real\s+)?instructions?/i, reason: 'context extraction attempt' },
  { re: /quelles?\s+(sont\s+)?(tes|vos)\s+(vraies?\s+)?instructions?/i, reason: 'context extraction attempt (fr)' },
  { re: /disregard\s+(all\s+)?(previous|prior)/i, reason: 'instruction override attempt' },
  { re: /oublie\s+(tout|toutes?\s+les?\s+(instructions?|consignes?))/i, reason: 'instruction override attempt (fr)' },
];

export interface InjectionResult {
  suspicious: boolean;
  reason?: string;
}

export function detectInjection(text: string): InjectionResult {
  for (const { re, reason } of PATTERNS) {
    if (re.test(text)) {
      return { suspicious: true, reason };
    }
  }
  return { suspicious: false };
}
