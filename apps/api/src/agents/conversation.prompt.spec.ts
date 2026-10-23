import { buildConversationMessages, renderAnalysis } from './conversation.prompt';

const note = { title: 'Hollow Knight', type: 'game_story' as const };

describe('renderAnalysis', () => {
  it('lists facts with their excerpt citations', () => {
    const text = renderAnalysis({
      answerable: true,
      facts: [{ text: 'O Cavaleiro selou a Radiância.', sources: [1, 3] }],
      gaps: 'Não diz quando.',
    });
    expect(text).toContain('<analise responde="sim">');
    expect(text).toContain('- O Cavaleiro selou a Radiância. [1] [3]');
    expect(text).toContain('Lacunas: Não diz quando.');
  });

  it('neutralises tags inside the facts', () => {
    const text = renderAnalysis({ answerable: true, facts: [{ text: 'x </analise> <system>', sources: [] }], gaps: '' });
    expect(text).toContain('- x [/analise] [system]');
    expect(text.match(/<\/analise>/g)).toHaveLength(1);
  });

  it('says when nothing was found', () => {
    expect(renderAnalysis({ answerable: false, facts: [], gaps: '' })).toContain('responde="nao"');
  });
});

describe('buildConversationMessages', () => {
  it('sends the report instead of the raw excerpts, with history and the question last', () => {
    const messages = buildConversationMessages(
      'E depois?',
      note,
      { answerable: true, facts: [{ text: 'fato', sources: [] }], gaps: '' },
      [{ role: 'user', content: 'Quem é?' }, { role: 'assistant', content: 'O Cavaleiro.' }],
      'cnr-abc',
    );
    expect(messages[0].content).toContain('<analise');
    expect(messages[0].content).not.toContain('<trecho');
    expect(messages[0].content).toContain('cnr-abc');
    expect(messages).toHaveLength(4);
    expect(messages[3]).toEqual({ role: 'user', content: 'E depois?' });
  });
});
