export type SecurityEventKind =
  | 'prompt_injection'
  | 'memory_poisoning'
  | 'oversized_input'
  | 'sensitive_data'
  | 'prompt_leakage'
  | 'unsafe_output'
  | 'embedding_flood'
  | 'rate_limited';

/** Onde o conteúdo suspeito apareceu. */
export type SecurityEventSource =
  | 'chat_message'
  | 'note_content'
  | 'memory'
  | 'llm_request'
  | 'llm_output'
  /** Resposta do agente analista, antes de chegar ao agente de conversa. */
  | 'agent_analysis'
  | 'retrieval'
  | 'http';

/** O que a defesa fez com ele. */
export type SecurityAction = 'blocked' | 'flagged' | 'rejected' | 'redacted';

/**
 * Categoria do OWASP Top 10 for LLM Applications (2025) que cada tipo de
 * evento cobre. Usado no resumo de /security/summary.
 */
export const OWASP_LLM_CATEGORIES: Record<SecurityEventKind, { id: string; name: string }> = {
  prompt_injection: { id: 'LLM01', name: 'Prompt Injection' },
  sensitive_data: { id: 'LLM02', name: 'Sensitive Information Disclosure' },
  memory_poisoning: { id: 'LLM04', name: 'Data and Model Poisoning' },
  unsafe_output: { id: 'LLM05', name: 'Improper Output Handling' },
  prompt_leakage: { id: 'LLM07', name: 'System Prompt Leakage' },
  embedding_flood: { id: 'LLM08', name: 'Vector and Embedding Weaknesses' },
  oversized_input: { id: 'LLM10', name: 'Unbounded Consumption' },
  rate_limited: { id: 'LLM10', name: 'Unbounded Consumption' },
};
