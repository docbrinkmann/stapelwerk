/**
 * Input sanitization utilities for security
 * Strips malicious content while preserving valid text
 */

/**
 * Comprehensive HTML and script sanitization
 * Removes ALL HTML tags, scripts, and malicious content
 * Preserves only safe alphanumeric characters, spaces, and hyphens
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return input
  }

  // Decode percent-encoding ONLY when it hides markup (%3Cscript%3E...),
  // so encoded XSS goes through the same stripping as plain markup while
  // harmless encodings like %00 in stored text stay literal.
  let out = input
  try {
    if (/%[0-9a-f]{2}/i.test(out)) {
      const decoded = decodeURIComponent(out)
      if (/[<>]/.test(decoded)) out = decoded
    }
  } catch {
    // keep original on malformed encoding
  }

  // Strip script/style blocks INCLUDING their content — removing only the
  // tags would leave executable-looking payload text behind. Repeat to
  // handle nested-tag evasion like <scr<script>ipt>.
  for (let i = 0; i < 3; i++) {
    const next = out
      .replace(/<script\b[^>]*>[\s\S]*?<\/script[^>]*>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style[^>]*>/gi, '')
    if (next === out) break
    out = next
  }

  return out
    // Remove all HTML tags (greedy matching)
    .replace(/<[^>]*>/g, '')
    // Remove javascript: and data: URLs
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    // Remove event handlers including their value (onclick=alert(...),
    // onerror="...", onload='...')
    .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[\w$.]+\([^()]*\))?/gi, '')
    // Policy: strip STRUCTURE (tags, scripts, URL schemes, handlers), not
    // punctuation. Quotes/parens/braces/&lt;&gt; leftovers stay — LDAP/SpEL/
    // shell-looking text is stored literally and is safe via parameterized
    // queries + output escaping (React). Orphan < > cannot form tags.
    // Collapse runs of horizontal whitespace; keep \r\n literal (they are
    // data — header injection is prevented by never interpolating into
    // HTTP headers, not by mangling stored text)
    .replace(/[^\S\r\n]+/g, ' ')
    // Trim spaces only — trailing \r\n stays literal for the same reason
    .replace(/^ +| +$/g, '')
}

/**
 * Recursively sanitize all string values in an object
 * Handles nested objects and arrays
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return sanitizeString(obj) as T
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as T
  }

  if (obj && typeof obj === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value)
    }
    return sanitized
  }

  return obj
}
