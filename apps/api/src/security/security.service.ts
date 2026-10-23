import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { cosineDistance, count, desc, eq, sql } from 'drizzle-orm';
import { Database, DRIZZLE } from '../database/database.module';
import { noteChunks, securityEvents } from '../database/schema';
import type { ChatCompletionMessage } from '../llm/openrouter.service';
import { RiskLevel, scanForInjection, ScanResult } from './injection-detector';
import { OutputFinding } from './output-guard';
import { dot, FLOOD_MIN_COPIES, largestDuplicateCluster } from './retrieval-guard';
import { sanitizeText } from './sanitize';
import { redactSensitive, SensitiveKind } from './sensitive-data';
import {
  OWASP_LLM_CATEGORIES,
  SecurityAction,
  SecurityEventKind,
  SecurityEventSource,
} from './security-events';

export const MAX_CHAT_MESSAGE_CHARS = 4000;
const MAX_ENTITY_NAME_CHARS = 60;
const MAX_RELATION_LABEL_CHARS = 40;
const MAX_SUMMARY_CHARS = 1000;
const EXCERPT_CHARS = 300;

/**
 * Similaridade mínima entre o resumo da memória e a nota ou a conversa.
 * O MiniLM é fraco em português (texto aleatório chega a ~0,37 contra um
 * resumo legítimo curto de ~0,40), então isto só barra o que é claramente
 * fora do assunto; o detector de injeção é a defesa principal.
 */
export const MIN_MEMORY_GROUNDING = 0.3;

export interface InspectedText {
  text: string;
  scan: ScanResult;
  /** Tipos de dado sensível encontrados no texto (só os tipos, nunca o valor). */
  sensitive: SensitiveKind[];
}

export interface OwaspSummaryItem {
  owasp: string;
  category: string;
  kind: SecurityEventKind;
  events: number;
}

export interface MemoryCandidate {
  summary: string;
  entities: { name: string }[];
  relations: { label: string }[];
}

export interface SecurityEventRecord {
  id: string;
  kind: SecurityEventKind;
  source: SecurityEventSource;
  action: SecurityAction;
  noteId: string | null;
  score: number;
  rules: string[];
  excerpt: string;
  createdAt: Date;
}

interface EventInput {
  kind: SecurityEventKind;
  source: SecurityEventSource;
  action: SecurityAction;
  noteId?: string | null;
  scan?: ScanResult;
  rules?: string[];
  text: string;
}

const SUSPICIOUS: RiskLevel[] = ['medium', 'high'];

/**
 * Defesas da camada de IA, organizadas pelo OWASP Top 10 for LLM (2025):
 * prompt injection direta e indireta (LLM01), dados sensíveis enviados ao
 * modelo (LLM02), envenenamento da memória (LLM04), saída insegura (LLM05),
 * vazamento do prompt de sistema (LLM07), inundação da busca vetorial (LLM08)
 * e consumo sem limite (LLM10).
 */
@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Limpa e pontua um texto sem registrar nada. */
  inspect(text: string): InspectedText {
    // A varredura roda no texto original para ver os caracteres invisíveis.
    return { text: sanitizeText(text), scan: scanForInjection(text), sensitive: redactSensitive(text).found };
  }

  /** Risco médio ou alto: o texto parece conter instruções para o modelo. */
  isSuspicious(text: string): boolean {
    return SUSPICIOUS.includes(scanForInjection(text).level);
  }

  /**
   * Mensagem do chat (injeção direta). Risco alto é bloqueado; risco médio
   * passa, mas fica registrado e não entra na memória.
   */
  async inspectUserMessage(message: string, noteId: string): Promise<string> {
    if (message.length > MAX_CHAT_MESSAGE_CHARS) {
      await this.record({ kind: 'oversized_input', source: 'chat_message', action: 'blocked', noteId, text: message });
      throw new BadRequestException(`message must be at most ${MAX_CHAT_MESSAGE_CHARS} characters`);
    }

    const { text, scan } = this.inspect(message);
    if (scan.level === 'high') {
      await this.record({ kind: 'prompt_injection', source: 'chat_message', action: 'blocked', noteId, scan, text: message });
      throw new BadRequestException(
        'The message was blocked because it looks like a prompt injection attempt.',
      );
    }
    if (scan.level === 'medium') {
      await this.record({ kind: 'prompt_injection', source: 'chat_message', action: 'flagged', noteId, scan, text: message });
    }
    return text;
  }

  /**
   * Conteúdo de nota que vai ser indexado (injeção indireta: um texto colado
   * ou um PDF com instruções escondidas). Nunca bloqueia, porque a nota é do
   * usuário; registra, e os trechos suspeitos são marcados no prompt.
   */
  async recordSuspiciousContent(noteId: string, inspected: InspectedText, original: string): Promise<void> {
    if (SUSPICIOUS.includes(inspected.scan.level)) {
      await this.record({
        kind: 'prompt_injection',
        source: 'note_content',
        action: 'flagged',
        noteId,
        scan: inspected.scan,
        text: original,
      });
    }
  }

  /**
   * Valida a memória extraída pelo LLM antes de salvar. Rejeita se o resumo,
   * os nomes ou as relações trouxerem instruções (memory poisoning: uma ordem
   * que ficaria gravada e voltaria em todas as conversas) ou se forem longos
   * demais para serem o que dizem ser.
   */
  async vetMemory(candidate: MemoryCandidate, noteId: string): Promise<boolean> {
    const parts = [
      candidate.summary,
      ...candidate.entities.map((e) => e.name),
      ...candidate.relations.map((r) => r.label),
    ];
    const scan = scanForInjection(parts.join('\n'));
    const rules = scan.matches.map((m) => m.rule);

    if (candidate.summary.length > MAX_SUMMARY_CHARS) rules.push('summary_too_long');
    if (candidate.entities.some((e) => e.name.length > MAX_ENTITY_NAME_CHARS)) rules.push('entity_name_too_long');
    if (candidate.relations.some((r) => r.label.length > MAX_RELATION_LABEL_CHARS)) rules.push('relation_label_too_long');

    const poisoned = scan.level !== 'none' || rules.length > scan.matches.length;
    if (poisoned) {
      await this.record({
        kind: 'memory_poisoning',
        source: 'memory',
        action: 'rejected',
        noteId,
        scan,
        rules,
        text: candidate.summary,
      });
    }
    return !poisoned;
  }

  /**
   * Verifica com o pgvector se o resumo tem relação com a nota (algum trecho
   * dela) ou com a própria conversa. Uma memória sem âncora em nenhum dos
   * dois foi provavelmente induzida a guardar outra coisa.
   */
  async checkMemoryGrounding(
    noteId: string,
    summary: string,
    summaryVector: number[],
    conversationVector: number[],
  ): Promise<boolean> {
    const distance = cosineDistance(noteChunks.embedding, summaryVector);
    const [best] = await this.db
      .select({ similarity: sql<number>`1 - (${distance})`.mapWith(Number) })
      .from(noteChunks)
      .where(eq(noteChunks.noteId, noteId))
      .orderBy(distance)
      .limit(1);
    const noteSimilarity = best?.similarity ?? 0;
    const conversationSimilarity = dot(summaryVector, conversationVector);
    const grounding = Math.max(noteSimilarity, conversationSimilarity);

    if (grounding >= MIN_MEMORY_GROUNDING) {
      return true;
    }
    await this.record({
      kind: 'memory_poisoning',
      source: 'memory',
      action: 'rejected',
      noteId,
      rules: [`ungrounded_summary (${grounding.toFixed(2)})`],
      text: summary,
    });
    return false;
  }

  /**
   * Última etapa antes de uma chamada ao LLM: tira segredos e dados pessoais
   * de todas as mensagens (Sensitive Information Disclosure). O banco guarda o
   * texto original; só o que sai para a OpenRouter é mascarado.
   */
  async redactForLlm(messages: ChatCompletionMessage[], noteId: string): Promise<ChatCompletionMessage[]> {
    const found = new Set<SensitiveKind>();
    const redacted = messages.map((message) => {
      const result = redactSensitive(message.content);
      result.found.forEach((kind) => found.add(kind));
      return { ...message, content: result.text };
    });
    if (found.size > 0) {
      await this.record({
        kind: 'sensitive_data',
        source: 'llm_request',
        action: 'redacted',
        noteId,
        rules: [...found],
        text: `Masked before sending to the LLM: ${[...found].join(', ')}`,
      });
    }
    return redacted;
  }

  /**
   * Valida o relatório do agente analista antes de entregá-lo ao agente de
   * conversa. O analista lê trechos não confiáveis, então uma injeção
   * indireta pode sair dele como "fato" (LLM01) ou ele pode repetir o próprio
   * prompt (LLM07). Fatos com instruções são descartados; um vazamento do
   * canário descarta o relatório inteiro.
   */
  async vetAnalysis<T extends { answerable: boolean; facts: { text: string }[]; gaps: string }>(
    analysis: T,
    noteId: string,
    canary: string,
  ): Promise<T | null> {
    const texts = [...analysis.facts.map((f) => f.text), analysis.gaps];
    if (texts.some((text) => text.includes(canary))) {
      await this.record({
        kind: 'prompt_leakage',
        source: 'agent_analysis',
        action: 'blocked',
        noteId,
        rules: ['system_prompt_echo'],
        text: texts.join('\n'),
      });
      return null;
    }

    const rejected = texts.filter((text) => this.isSuspicious(text));
    if (rejected.length === 0) {
      return analysis;
    }
    const scan = scanForInjection(rejected.join('\n'));
    await this.record({
      kind: 'prompt_injection',
      source: 'agent_analysis',
      action: 'rejected',
      noteId,
      scan,
      text: rejected.join('\n'),
    });
    const facts = analysis.facts.filter((f) => !this.isSuspicious(f.text));
    return {
      ...analysis,
      answerable: analysis.answerable && facts.length > 0,
      facts,
      gaps: this.isSuspicious(analysis.gaps) ? '' : analysis.gaps,
    };
  }

  /** Registra o que o filtro de saída removeu da resposta e se ela vazou o prompt de sistema. */
  async recordOutput(noteId: string, findings: OutputFinding[], leaked: boolean, answer: string): Promise<void> {
    if (leaked) {
      await this.record({
        kind: 'prompt_leakage',
        source: 'llm_output',
        action: 'blocked',
        noteId,
        rules: ['system_prompt_echo'],
        text: answer,
      });
    }
    if (findings.length > 0) {
      await this.record({ kind: 'unsafe_output', source: 'llm_output', action: 'redacted', noteId, rules: findings, text: answer });
    }
  }

  /**
   * Sinaliza uma nota cujos trechos são, em grande parte, o mesmo texto
   * repetido: um jeito de envenenar a busca vetorial para que esse texto
   * apareça em qualquer pergunta. A busca do chat já descarta as cópias.
   */
  async checkEmbeddingFlood(noteId: string, vectors: number[][], contents: string[]): Promise<void> {
    const copies = largestDuplicateCluster(vectors);
    if (copies >= FLOOD_MIN_COPIES) {
      await this.record({
        kind: 'embedding_flood',
        source: 'note_content',
        action: 'flagged',
        noteId,
        rules: [`near_duplicate_chunks (${copies} of ${vectors.length})`],
        text: contents[0] ?? '',
      });
    }
  }

  async recordRateLimit(description: string): Promise<void> {
    await this.record({ kind: 'rate_limited', source: 'http', action: 'blocked', rules: ['rate_limit'], text: description });
  }

  /** Quantos eventos cada categoria do OWASP Top 10 for LLM registrou. */
  async owaspSummary(): Promise<OwaspSummaryItem[]> {
    const rows = await this.db
      .select({ kind: securityEvents.kind, events: count() })
      .from(securityEvents)
      .groupBy(securityEvents.kind);
    const byKind = new Map(rows.map((r) => [r.kind, r.events]));
    return (Object.keys(OWASP_LLM_CATEGORIES) as SecurityEventKind[]).map((kind) => ({
      owasp: OWASP_LLM_CATEGORIES[kind].id,
      category: OWASP_LLM_CATEGORIES[kind].name,
      kind,
      events: byKind.get(kind) ?? 0,
    }));
  }

  async listEvents(noteId?: string, limit = 100): Promise<SecurityEventRecord[]> {
    return this.db
      .select()
      .from(securityEvents)
      .where(noteId ? eq(securityEvents.noteId, noteId) : undefined)
      .orderBy(desc(securityEvents.createdAt))
      .limit(limit);
  }

  private async record(input: EventInput): Promise<void> {
    const rules = input.rules ?? input.scan?.matches.map((m) => m.rule) ?? [];
    const score = input.scan?.score ?? 1;
    this.logger.warn(
      `${input.kind} ${input.action} (${input.source}, score ${score}): ${rules.join(', ') || 'no rule'}`,
    );
    try {
      await this.db.insert(securityEvents).values({
        kind: input.kind,
        source: input.source,
        action: input.action,
        noteId: input.noteId ?? null,
        score,
        rules,
        // O próprio log de auditoria não pode guardar a senha que a defesa mascarou.
        excerpt: redactSensitive(input.text.slice(0, EXCERPT_CHARS)).text,
      });
    } catch (error) {
      // A auditoria não pode derrubar a requisição que ela está protegendo.
      this.logger.error(`Failed to record security event: ${error}`);
    }
  }
}
