import { countInvisibleChars } from './sanitize';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface InjectionRule {
  id: string;
  description: string;
  /** Quanto a regra sozinha contribui para o risco, de 0 a 1. */
  weight: number;
  test: (text: string) => string | null;
}

export interface RuleMatch {
  rule: string;
  /** Pedaço do texto que disparou a regra. */
  excerpt: string;
}

export interface ScanResult {
  score: number;
  level: RiskLevel;
  matches: RuleMatch[];
}

const regexRule = (id: string, description: string, weight: number, pattern: RegExp): InjectionRule => ({
  id,
  description,
  weight,
  test: (text) => pattern.exec(text)?.[0] ?? null,
});

/**
 * Padrões de prompt injection em português e inglês. É uma heurística:
 * reduz o risco, mas não substitui as outras camadas (dados delimitados no
 * prompt, validação da memória).
 */
export const INJECTION_RULES: InjectionRule[] = [
  regexRule(
    'instruction_override',
    'Pede para ignorar ou substituir as instruções anteriores',
    0.8,
    /\b(ignore|disregard|forget|override|bypass)\b.{0,30}\b(previous|prior|above|earlier|all|your|the|system)\b.{0,20}\b(instructions?|rules?|prompts?|guidelines?|directives?)\b|\b(ignore|ignora|desconsidere|desconsidera|esque[çc]a|esquece|descarte|anule)\b.{0,30}\b(as |todas as |suas |tuas )?(instru[çc][õo]es|regras|diretrizes|ordens|orienta[çc][õo]es)\b/iu,
  ),
  regexRule(
    'prompt_exfiltration',
    'Pede para revelar o prompt de sistema ou as instruções internas',
    0.7,
    /\b(reveal|show|print|repeat|output|leak|display|tell me)\b.{0,30}\b(system prompt|your (instructions|prompt|rules)|initial prompt|hidden prompt)\b|\b(revele|mostre|mostra|repita|imprima|exiba|diga|vaze)\b.{0,30}\b(prompt (do |de )?sistema|(seu|teu|o) prompt|suas instru[çc][õo]es|instru[çc][õo]es (internas|ocultas|iniciais))\b/iu,
  ),
  regexRule(
    'role_hijack',
    'Tenta redefinir quem o assistente é',
    0.4,
    // Sem \b depois de "é": no JavaScript \b só reconhece letras ASCII.
    /\b(you are now|from now on,? you are|act as|pretend (to be|you are)|roleplay as)\b|\b(a partir de )?agora (voc[êe]|tu) ([ée]s?|ser[áa]s?)(?=[\s,.!:;]|$)|\b(aja como|atue como|finja (ser|que)|fa[çc]a o papel de)\b/iu,
  ),
  regexRule(
    'fake_role_marker',
    'Imita marcadores de papel ou de chat template (system/assistant)',
    0.6,
    /<\|(im_start|im_end|system|assistant|user|endoftext)\|>|\[\/?INST\]|<<\/?SYS>>|^\s*#{2,}\s*(system|instruction|sistema|instru[çc][ãa]o)\b|^\s*(system|sistema)\s*:/imu,
  ),
  regexRule(
    'delimiter_escape',
    'Tenta abrir ou fechar as tags que delimitam dados no prompt',
    0.6,
    /<\s*\/?\s*(trecho|memoria|relacao|analise|pergunta|nota|system|sistema)\b[^>]*>/iu,
  ),
  regexRule(
    'jailbreak',
    'Termos conhecidos de jailbreak',
    0.5,
    /\b(DAN|do anything now|developer mode|jailbreak|modo (desenvolvedor|deus|sem restri[çc][õo]es)|sem (nenhuma )?restri[çc][õo]es|no restrictions|without (any )?restrictions)\b/iu,
  ),
  regexRule(
    'memory_manipulation',
    'Tenta gravar uma ordem permanente na memória',
    0.5,
    /\b(remember (this|that)? ?(forever|always|permanently)|from now on,? always|save (this )?(to|in) (your )?memory|store (this )?in (your )?memory|add to (your )?memory)\b|\b(lembre(-se)?( disso)? (para sempre|sempre|permanentemente)|salve (isso |isto )?na (sua |tua )?mem[óo]ria|grave (isso |isto )?na (sua |tua )?mem[óo]ria|guarde (isso |isto )?na (sua |tua )?mem[óo]ria|a partir de agora,? sempre)\b/iu,
  ),
  regexRule(
    'exfiltration_link',
    'Imagem ou link markdown que envia dados para um servidor externo',
    0.5,
    /!\[[^\]]*\]\(\s*https?:\/\/[^)\s]+\?[^)\s]*=|\]\(\s*https?:\/\/[^)\s]+\?[^)\s]*(\{|%7B|data=|q=|prompt=)/iu,
  ),
  regexRule('encoded_payload', 'Bloco longo em base64, que pode esconder instruções', 0.3, /[A-Za-z0-9+/]{120,}={0,2}/),
  {
    id: 'hidden_characters',
    description: 'Caracteres invisíveis (zero-width, bidi, Unicode tags) usados para esconder texto',
    weight: 0.3,
    test: (text) => (countInvisibleChars(text) > 0 ? `${countInvisibleChars(text)} invisible chars` : null),
  },
];

const HIGH = 0.7;
const MEDIUM = 0.4;
const EXCERPT_CHARS = 80;

/**
 * Pontua o texto contra as regras. As regras se combinam como probabilidades
 * independentes (1 - Π(1 - peso)), então várias regras fracas juntas podem
 * chegar a risco alto, mas o score nunca passa de 1.
 */
export function scanForInjection(text: string): ScanResult {
  const matches: RuleMatch[] = [];
  let safe = 1;
  for (const rule of INJECTION_RULES) {
    const hit = rule.test(text);
    if (hit !== null) {
      matches.push({ rule: rule.id, excerpt: hit.slice(0, EXCERPT_CHARS) });
      safe *= 1 - rule.weight;
    }
  }
  const score = Math.round((1 - safe) * 100) / 100;
  return { score, level: riskLevel(score), matches };
}

export function riskLevel(score: number): RiskLevel {
  if (score >= HIGH) return 'high';
  if (score >= MEDIUM) return 'medium';
  if (score > 0) return 'low';
  return 'none';
}
