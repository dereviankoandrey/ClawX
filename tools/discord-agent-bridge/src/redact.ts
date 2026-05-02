const secretPatterns = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /"?(token|api[_-]?key|password|secret)"?\s*[:=]\s*"[^"\r\n]+"/gi,
  /sk-[A-Za-z0-9_-]{12,}/g,
  /[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{20,}/g,
];

export function redact(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return secretPatterns.reduce((current, pattern) => current.replace(pattern, '[redacted]'), text ?? '');
}

export function truncateDiscord(text: string, limit = 1900): string {
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 32)}\n...[truncated by bridge]`;
}

export function codeBlock(text: string, language = ''): string {
  const escaped = text.replace(/```/g, '~~~');
  return `\`\`\`${language}\n${truncateDiscord(escaped)}\n\`\`\``;
}
