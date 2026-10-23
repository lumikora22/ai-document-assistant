import { buildMemoryMessages, entityKey, parseMemoryExtraction } from './memory-extraction';

describe('parseMemoryExtraction', () => {
  it('reads JSON wrapped in a code fence', () => {
    const reply = [
      '```json',
      JSON.stringify({
        summary: 'Discutimos Ranni.',
        entities: [
          { name: 'Ranni', kind: 'character' },
          { name: 'Noite das Facas', kind: 'event' },
        ],
        relations: [{ from: 'Ranni', to: 'Noite das Facas', label: 'planejou?' }],
      }),
      '```',
    ].join('\n');

    expect(parseMemoryExtraction(reply)).toEqual({
      summary: 'Discutimos Ranni.',
      entities: [
        { name: 'Ranni', kind: 'character' },
        { name: 'Noite das Facas', kind: 'event' },
      ],
      relations: [{ from: 'Ranni', to: 'Noite das Facas', label: 'planejou?' }],
    });
  });

  it('returns null without a summary or valid JSON', () => {
    expect(parseMemoryExtraction('no json here')).toBeNull();
    expect(parseMemoryExtraction('{"summary": ""}')).toBeNull();
    expect(parseMemoryExtraction('{broken')).toBeNull();
  });

  it('drops duplicates, unknown kinds and relations to unlisted entities', () => {
    const result = parseMemoryExtraction(
      JSON.stringify({
        summary: 's',
        entities: [
          { name: 'Ranni', kind: 'character' },
          { name: ' ranni ', kind: 'character' },
          { name: 'Magia', kind: 'spell' },
          { name: '', kind: 'item' },
        ],
        relations: [
          { from: 'RANNI', to: 'Magia', label: 'usa' },
          { from: 'Ranni', to: 'Blaidd', label: 'aliado' },
          { from: 'Ranni', to: 'Ranni', label: 'é' },
        ],
      }),
    );

    expect(result?.entities).toEqual([
      { name: 'Ranni', kind: 'character' },
      { name: 'Magia', kind: 'concept' },
    ]);
    expect(result?.relations).toEqual([{ from: 'Ranni', to: 'Magia', label: 'usa' }]);
  });
});

describe('entityKey', () => {
  it('ignores case and extra spaces', () => {
    expect(entityKey('  Noite   das Facas ')).toBe('noite das facas');
  });
});

describe('buildMemoryMessages', () => {
  it('includes the note, the conversation and the known entities', () => {
    const [system, user] = buildMemoryMessages({
      note: { title: 'Elden Ring', type: 'game_story', content: 'Lore', entries: [{ content: 'Mais lore' }] },
      messages: [
        { role: 'user', content: 'Quem é Ranni?' },
        { role: 'assistant', content: 'Uma semideusa.' },
      ],
      knownEntities: ['Ranni'],
    });

    expect(system.content).toContain('use exatamente o mesmo nome');
    expect(system.content).toContain('Ranni');
    expect(user.content).toContain('Título da nota: Elden Ring');
    expect(user.content).toContain('Tipo da nota: história de jogo');
    expect(user.content).toContain('Mais lore');
    expect(user.content).toContain('Usuário: Quem é Ranni?');
    expect(user.content).toContain('Assistente: Uma semideusa.');
  });
});

describe('parseMemoryExtraction with known entities', () => {
  it('keeps relations to entities already in the graph', () => {
    const result = parseMemoryExtraction(
      JSON.stringify({
        summary: 's',
        entities: [{ name: 'Blaidd', kind: 'character' }],
        relations: [
          { from: 'Blaidd', to: 'ranni', label: 'aliado' },
          { from: 'Blaidd', to: 'Desconhecido', label: 'x' },
        ],
      }),
      ['Ranni'],
    );
    expect(result?.relations).toEqual([{ from: 'Blaidd', to: 'Ranni', label: 'aliado' }]);
  });
});
