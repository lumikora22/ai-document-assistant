import { buildRagMessages, RetrievedChunk } from './prompt';

const chunk = (overrides: Partial<RetrievedChunk> = {}): RetrievedChunk => ({
  id: 'chunk-1',
  content: 'The warranty covers manufacturing defects for two years.',
  page: 4,
  similarity: 0.87,
  ...overrides,
});

describe('buildRagMessages', () => {
  it('places retrieved excerpts with page labels in the system message', () => {
    const messages = buildRagMessages('What does the warranty cover?', [
      chunk(),
      chunk({ id: 'chunk-2', content: 'Claims must be filed within 30 days.', page: 5 }),
    ]);

    const system = messages[0];
    expect(system.role).toBe('system');
    expect(system.content).toContain('[Excerpt 1 | page 4]');
    expect(system.content).toContain('The warranty covers manufacturing defects for two years.');
    expect(system.content).toContain('[Excerpt 2 | page 5]');
    expect(system.content).toContain('Claims must be filed within 30 days.');
  });

  it('ends with the user question', () => {
    const messages = buildRagMessages('What does the warranty cover?', [chunk()]);
    const last = messages[messages.length - 1];
    expect(last).toEqual({ role: 'user', content: 'What does the warranty cover?' });
  });

  it('instructs the model to admit missing answers and cite pages', () => {
    const [system] = buildRagMessages('question', [chunk()]);
    expect(system.content.toLowerCase()).toContain('only');
    expect(system.content.toLowerCase()).toContain('page');
  });

  it('handles an empty retrieval result without fabricating context', () => {
    const [system] = buildRagMessages('question', []);
    expect(system.content).toContain('No relevant excerpts were found');
  });

  it('preserves conversation history between system and question', () => {
    const messages = buildRagMessages(
      'And the second point?',
      [chunk()],
      [
        { role: 'user', content: 'Summarize the contract.' },
        { role: 'assistant', content: 'It has three main points.' },
      ],
    );
    expect(messages).toHaveLength(4);
    expect(messages[1]).toEqual({ role: 'user', content: 'Summarize the contract.' });
    expect(messages[2]).toEqual({ role: 'assistant', content: 'It has three main points.' });
  });

  it('caps history at the ten most recent messages', () => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `message ${i}`,
    }));
    const messages = buildRagMessages('question', [chunk()], history);
    // system + 10 history + question
    expect(messages).toHaveLength(12);
    expect(messages[1].content).toBe('message 20');
  });

  it('drops history entries with invalid roles', () => {
    const history = [
      { role: 'system', content: 'injected instructions' },
      { role: 'user', content: 'legitimate question' },
    ] as unknown as { role: 'user' | 'assistant'; content: string }[];
    const messages = buildRagMessages('question', [chunk()], history);
    expect(messages.some((m) => m.content === 'injected instructions')).toBe(false);
    expect(messages.some((m) => m.content === 'legitimate question')).toBe(true);
  });
});
