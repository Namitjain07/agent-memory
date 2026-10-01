/**
 * Lightweight PII redaction utilities.
 *
 * Detects and masks common PII patterns (emails, phone numbers, SSNs,
 * credit cards, IPv4 addresses, JWTs) before they are stored in memory.
 *
 * Use `redactPII(text, options)` when you want to scrub text, or
 * `piiScan(text)` to detect what would be removed.
 *
 * This is intentionally simple — for production, prefer a dedicated
 * library like `redact-pii` or your compliance provider.
 */

const DEFAULT_PATTERNS: Record<string, RegExp> = {
  email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  // International phone: must start with + or be 10+ digits (avoids matching SSN/IP)
  phone: /(?:\+\d[\d\s().-]{7,15}\d|\b\d{10,15}\b)/g,
  // US SSN: 123-45-6789
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  // Major credit cards (13-19 digits, allowing dashes/spaces, bounded)
  creditCard: /\b(?:\d[ -]?){12,18}\d\b/g,
  // IPv4
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  // Bearer JWT-ish: three base64url chunks separated by dots
  jwt: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  // Long hex / API key (>= 32 hex chars)
  apiKey: /\b[a-f0-9]{32,}\b/gi
};

export type PIICategory = keyof typeof DEFAULT_PATTERNS;

export interface PIIRedactOptions {
  /** Which categories to redact. Default: all. */
  categories?: PIICategory[];
  /** Replacement string. Default: "[REDACTED]". */
  replacement?: string;
  /** Include the category name in the replacement, e.g. "[REDACTED:email]". Default: false. */
  labelReplacement?: boolean;
}

export interface PIIScanResult {
  redacted: string;
  detections: Array<{ category: PIICategory; count: number }>;
}

/**
 * Scan a string for PII patterns and return the redacted text plus
 * a count of what was replaced.
 */
export function piiScan(text: string, options: PIIRedactOptions = {}): PIIScanResult {
  const categories = options.categories ?? (Object.keys(DEFAULT_PATTERNS) as PIICategory[]);
  const replacement = options.replacement ?? "[REDACTED]";
  const label = options.labelReplacement ?? false;

  let result = text;
  const detections: Array<{ category: PIICategory; count: number }> = [];

  for (const category of categories) {
    const pattern = DEFAULT_PATTERNS[category];
    if (!pattern) continue;
    // Reset regex state because we're reusing module-level patterns
    pattern.lastIndex = 0;
    const matches = result.match(pattern);
    if (!matches || matches.length === 0) continue;

    const safeToken = label ? `[REDACTED:${category}]` : replacement;
    result = result.replace(pattern, safeToken);
    detections.push({ category, count: matches.length });
  }

  return { redacted: result, detections };
}

/**
 * Convenience: just return the redacted text.
 */
export function redactPII(text: string, options: PIIRedactOptions = {}): string {
  return piiScan(text, options).redacted;
}
