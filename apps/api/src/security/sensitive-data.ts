export type SensitiveKind =
  | 'private_key'
  | 'api_key'
  | 'jwt'
  | 'password'
  | 'connection_string'
  | 'cpf'
  | 'credit_card';

export interface RedactionResult {
  text: string;
  /** Tipos encontrados, sem repetição. Nunca o valor em si. */
  found: SensitiveKind[];
}

interface SensitivePattern {
  kind: SensitiveKind;
  pattern: RegExp;
  /** Recebe o trecho encontrado e devolve o que fica no lugar, ou null para manter. */
  replace: (match: string, ...groups: string[]) => string | null;
}

const mask = (kind: SensitiveKind) => `[REDACTED:${kind}]`;

/**
 * Segredos e dados pessoais que não devem sair do servidor. O modelo roda
 * na OpenRouter, e modelos gratuitos podem registrar os prompts; uma nota
 * com uma chave de API ou um CPF não pode virar dado de terceiros.
 */
const PATTERNS: SensitivePattern[] = [
  {
    kind: 'private_key',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replace: () => mask('private_key'),
  },
  {
    kind: 'api_key',
    pattern:
      /\b(sk-or-v1-[a-f0-9]{32,}|sk-(?:proj-|ant-[a-z0-9]+-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35})\b/g,
    replace: () => mask('api_key'),
  },
  {
    kind: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    replace: () => mask('jwt'),
  },
  {
    kind: 'connection_string',
    // Só a senha some: o host e o usuário ainda ajudam a responder sobre a nota.
    pattern: /\b([a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:)([^\s@/]+)(@)/gi,
    replace: (_, prefix: string, _password: string, at: string) => `${prefix}${mask('password')}${at}`,
  },
  {
    kind: 'password',
    pattern: /\b(senha|password|passwd|pwd|secret|token)(\s*[:=]\s*)(\S{4,})/gi,
    replace: (match, label: string, separator: string, value: string) =>
      value.startsWith('[REDACTED') ? null : `${label}${separator}${mask('password')}`,
  },
  {
    kind: 'cpf',
    pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
    replace: (match) => (isValidCpf(match) ? mask('cpf') : null),
  },
  {
    kind: 'credit_card',
    pattern: /\b\d(?:[ -]?\d){12,18}\b/g,
    replace: (match) => (passesLuhn(match) ? mask('credit_card') : null),
  },
];

/** Troca segredos e dados pessoais por marcadores [REDACTED:tipo]. */
export function redactSensitive(text: string): RedactionResult {
  const found = new Set<SensitiveKind>();
  let result = text;
  for (const { kind, pattern, replace } of PATTERNS) {
    result = result.replace(pattern, (match: string, ...rest: unknown[]) => {
      const groups = rest.filter((g): g is string => typeof g === 'string');
      const replacement = replace(match, ...groups);
      if (replacement === null) return match;
      found.add(kind);
      return replacement;
    });
  }
  return { text: result, found: [...found] };
}

export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export function passesLuhn(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}
