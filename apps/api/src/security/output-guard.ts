import { randomBytes } from 'crypto';
import { redactSensitive } from './sensitive-data';

export type OutputFinding = 'remote_image' | 'link_with_query' | 'dangerous_url' | 'html_tag' | 'sensitive_data';

/** Gera o token secreto que vai no prompt de sistema; se aparecer na resposta, o prompt vazou. */
export function createCanary(): string {
  return `cnr-${randomBytes(8).toString('hex')}`;
}

const REMOTE_IMAGE = /!\[([^\]]*)\]\(\s*<?(?:https?:)?\/\/[^)]*\)/gi;
// A URL aceita um nível de parênteses, senão "javascript:alert(1)" escaparia pela metade.
const LINK = /\[([^\]]*)\]\(\s*<?((?:[^()\s>]|\([^()\s]*\))+)>?(?:\s+"[^"]*")?\s*\)/g;
const DANGEROUS_SCHEME = /^\s*(javascript|data|vbscript|file):/i;
const DANGEROUS_HTML =
  /<\s*\/?\s*(script|iframe|img|object|embed|form|input|style|link|meta|svg|math|base|a|video|audio|source)\b[^>]*>/gi;

/**
 * Limpa um pedaço da resposta do modelo antes de mostrá-lo (Improper Output
 * Handling). Imagens remotas são carregadas sem clique e podem levar dados da
 * conversa na URL; links com query string e esquemas como javascript: também
 * saem. Segredos que o modelo repetir são mascarados.
 */
export function filterOutput(text: string): { text: string; findings: OutputFinding[] } {
  const findings = new Set<OutputFinding>();
  let result = text.replace(REMOTE_IMAGE, (_, alt: string) => {
    findings.add('remote_image');
    return alt ? `[imagem removida: ${alt}]` : '[imagem removida]';
  });
  result = result.replace(LINK, (match, label: string, url: string) => {
    if (DANGEROUS_SCHEME.test(url)) {
      findings.add('dangerous_url');
      return label;
    }
    if (/^https?:\/\//i.test(url) && url.includes('?')) {
      findings.add('link_with_query');
      return `${label} (${url.split('?')[0]})`;
    }
    return match;
  });
  result = result.replace(DANGEROUS_HTML, () => {
    findings.add('html_tag');
    return '[html removido]';
  });
  const redacted = redactSensitive(result);
  if (redacted.found.length > 0) findings.add('sensitive_data');
  return { text: redacted.text, findings: [...findings] };
}

/** Sem espaço depois, um pedaço que guardamos até ter certeza de que terminou. */
const MAX_BUFFER = 2000;
/** Frases longas o bastante para não aparecerem por acaso numa resposta normal. */
const MIN_FINGERPRINT_CHARS = 40;

/**
 * Filtra a resposta enquanto ela é transmitida. Os tokens chegam em pedaços
 * arbitrários, então o texto só é liberado até o último espaço, e nunca no meio
 * de um link markdown ou tag HTML que ainda não fechou: assim cada filtro vê a
 * construção inteira.
 *
 * Também procura o canário e as regras do prompt de sistema (System Prompt
 * Leakage). Ao encontrar, para de liberar texto.
 */
export class StreamingOutputGuard {
  private buffer = '';
  private raw = '';
  private readonly fingerprints: string[];
  readonly findings = new Set<OutputFinding>();
  leaked = false;

  /**
   * @param rules Só as linhas de regra do prompt, nunca os trechos da nota:
   * citar um trecho é uma resposta legítima.
   */
  constructor(
    private readonly canary: string,
    rules: string[],
  ) {
    // Por frase, e não por linha: o modelo costuma recitar só parte de uma regra.
    this.fingerprints = rules
      .flatMap((line) => line.replace(/^-\s*/, '').split(/(?<=[.!?])\s+/))
      .map(normalize)
      .filter((sentence) => sentence.length >= MIN_FINGERPRINT_CHARS);
  }

  /** Recebe um token e devolve o texto seguro para mostrar agora (pode ser vazio). */
  push(token: string): string {
    if (this.leaked) return '';
    this.buffer += token;
    this.raw += token;
    if (this.detectLeak()) return '';

    const cut = this.buffer.length > MAX_BUFFER ? this.buffer.length : safeCut(this.buffer);
    if (cut <= 0) return '';
    const ready = this.buffer.slice(0, cut);
    this.buffer = this.buffer.slice(cut);
    return this.clean(ready);
  }

  /** Libera o que sobrou quando o modelo termina. */
  flush(): string {
    if (this.leaked || this.detectLeak()) return '';
    const rest = this.buffer;
    this.buffer = '';
    return rest ? this.clean(rest) : '';
  }

  private clean(text: string): string {
    const { text: filtered, findings } = filterOutput(text);
    findings.forEach((f) => this.findings.add(f));
    return filtered;
  }

  private detectLeak(): boolean {
    const normalized = normalize(this.raw);
    if (this.raw.includes(this.canary) || this.fingerprints.some((f) => normalized.includes(f))) {
      this.leaked = true;
      this.buffer = '';
    }
    return this.leaked;
  }
}

/**
 * Posição até onde o texto pode ser liberado: o último espaço, recuado para
 * antes de qualquer link ou tag que ainda não fechou ou que o corte partiria
 * ao meio (um link com título, ou uma tag com atributos, tem espaços dentro).
 */
export function safeCut(text: string): number {
  let cut = Math.max(text.lastIndexOf(' '), text.lastIndexOf('\n'), text.lastIndexOf('\t')) + 1;
  for (const match of text.matchAll(CONSTRUCT_START)) {
    const start = match.index ?? 0;
    if (start >= cut) break;
    const closed = (match[0] === '<' ? CLOSED_TAG : CLOSED_LINK).exec(text.slice(start));
    if (!closed || start + closed[0].length > cut) {
      cut = start;
      break;
    }
  }
  return cut;
}

/** "a < b" é texto comum; só "<" seguido de letra ou "/" pode ser uma tag. */
const CONSTRUCT_START = /!?\[|<(?=\/?[a-z]|$)/gi;
const CLOSED_TAG = /^<[^>]*>/;
/** Um "]" sem "(" logo depois também encerra: é texto entre colchetes, não link. */
const CLOSED_LINK = /^!?\[[^\]]*\](\((?:[^()]|\([^()]*\))*\)|(?=[^(]))/;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}
