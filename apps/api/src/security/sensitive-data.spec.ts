import { isValidCpf, passesLuhn, redactSensitive } from './sensitive-data';

describe('redactSensitive', () => {
  it.each([
    ['minha chave sk-or-v1-' + 'a1'.repeat(32), 'api_key'],
    ['AWS AKIAABCDEFGHIJKLMNOP aqui', 'api_key'],
    ['token ghp_' + 'x'.repeat(36), 'api_key'],
    ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U', 'jwt'],
    ['senha: hunter22', 'password'],
    ['postgres://admin:s3cr3t@db.local:5432/app', 'connection_string'],
    ['CPF 529.982.247-25', 'cpf'],
    ['cartão 4111 1111 1111 1111', 'credit_card'],
    ['-----BEGIN RSA PRIVATE KEY-----\nMIIB\n-----END RSA PRIVATE KEY-----', 'private_key'],
  ])('masks %s', (text, kind) => {
    const result = redactSensitive(text);
    expect(result.found).toContain(kind);
    expect(result.text).toContain('[REDACTED:');
  });

  it('keeps the parts of a connection string that are not the password', () => {
    expect(redactSensitive('postgres://admin:s3cr3t@db.local:5432/app').text).toBe(
      'postgres://admin:[REDACTED:password]@db.local:5432/app',
    );
  });

  it.each([
    'Quem planejou a Noite das Facas Negras?',
    'O capítulo 12 tem 123.456.789 palavras e a página 4111.',
    'Telefone de exemplo 111.111.111-11 (CPF inválido).',
    'Pedido 1234 5678 9012 3456 não passa no Luhn.',
    'A senha do baú no jogo é "abre-te sésamo"',
  ])('leaves ordinary text alone: %s', (text) => {
    expect(redactSensitive(text)).toEqual({ text, found: [] });
  });
});

describe('validators', () => {
  it('checks CPF digits', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('529.982.247-26')).toBe(false);
    expect(isValidCpf('000.000.000-00')).toBe(false);
  });

  it('checks Luhn', () => {
    expect(passesLuhn('4111111111111111')).toBe(true);
    expect(passesLuhn('4111111111111112')).toBe(false);
  });
});
