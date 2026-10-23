/**
 * Caracteres que não aparecem na tela mas chegam ao modelo. São usados para
 * esconder instruções dentro de um texto que parece inofensivo (ASCII
 * smuggling com Unicode tags, zero-width, controles de direção bidi).
 */
const INVISIBLE_CHARS =
  /[​-‏‪-‮⁠-⁤⁦-⁩﻿­]|[\u{E0000}-\u{E007F}]/gu;

/** Controles ASCII, exceto tab e quebra de linha. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Tags usadas para delimitar dados no prompt; o texto não pode abri-las nem fechá-las. */
const PROMPT_DELIMITERS = /<\s*(\/?)\s*(trecho|memoria|relacao|analise|pergunta|nota|system|sistema|assistant|user)\b[^>]*>/gi;

export function countInvisibleChars(text: string): number {
  return text.match(INVISIBLE_CHARS)?.length ?? 0;
}

/**
 * Normaliza o texto (NFKC transforma letras "disfarçadas", como as de largura
 * total, nas comuns) e remove caracteres invisíveis e de controle.
 */
export function sanitizeText(text: string): string {
  return text.normalize('NFKC').replace(INVISIBLE_CHARS, '').replace(CONTROL_CHARS, '');
}

/**
 * Neutraliza tags de delimitação dentro de um conteúdo antes de colocá-lo no
 * prompt, para que um trecho não consiga "fechar" o bloco de dados e escrever
 * fora dele como se fosse instrução.
 */
export function escapeDelimiters(text: string): string {
  return text.replace(PROMPT_DELIMITERS, (_, slash: string, name: string) => `[${slash}${name}]`);
}
