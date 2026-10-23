// Prints where each service of the dev environment can be reached.
// Ports come from the root .env, falling back to the same defaults
// used by docker-compose.yml and the apps.
const fs = require('fs');
const path = require('path');

function readEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = { ...readEnv(path.join(__dirname, '..', '.env')), ...process.env };

const services = [
  ['Front-end (Next.js)', `http://localhost:3000`],
  ['API (NestJS)', `http://localhost:${env.PORT || 3001}`],
  ['pgAdmin', `http://localhost:${env.PGADMIN_PORT || 5050}`],
  ['PostgreSQL', `localhost:${env.POSTGRES_PORT || 5432} (use pgAdmin ou um cliente SQL, não o navegador)`],
];

const width = Math.max(...services.map(([name]) => name.length));
console.log('\n  Onde acessar:');
for (const [name, url] of services) {
  console.log(`    ${name.padEnd(width)}  ${url}`);
}
console.log('');
