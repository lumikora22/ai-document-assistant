# BOOKMARK — O Anotador de Lacunas

BOOKMARK é uma plataforma de anotações com IA para quem está aprendendo algo com muita coisa para lembrar: a história de um jogo, a trama de um livro ou o conteúdo de uma matéria. O usuário anota o que descobre, e o sistema organiza, conecta e analisa essas anotações usando **LLM, embeddings e RAG**, montando uma **wiki pessoal**, apontando **lacunas** no que ele sabe, levantando **teorias** e ajudando a **memória de longo prazo**. Tudo isso **sem spoilers**: o Bookmark só sabe o que o próprio usuário descobriu.

O projeto é **100% TypeScript**, organizado em monorepo: **backend em NestJS**, **frontend em Next.js** e a IA (LLM, embeddings e análise) integrada ao backend através do **Vercel AI SDK**. Os dados ficam em PostgreSQL com pgvector para a busca vetorial, e uma fila em Redis processa as anotações em segundo plano.

> **Status:** em desenvolvimento · feito para rodar localmente com Docker ([como rodar](#como-rodar))

## Objetivos

* Permitir que o usuário anote livremente o que descobre, sem precisar organizar nada.
* Transformar anotações soltas em uma wiki pessoal, com fichas geradas automaticamente.
* Apontar lacunas, contradições e mistérios em aberto para orientar o que investigar ou revisar.
* Gerar teorias sobre o que pode acontecer ou o que pode ter acontecido, sempre baseadas nas anotações e rotuladas como especulação.
* Ajudar a memória de longo prazo com resumos de retorno e revisão espaçada.
* Garantir zero spoiler por construção: a IA responde apenas com base no que o usuário anotou.
* Funcionar para qualquer tipo de aprendizado: livros, histórias de jogos, estudos e o que mais o usuário quiser.

---

## Os Três Pilares do Produto

### 1. Caderno de Descobertas
O usuário cria um projeto com um título (por exemplo, "Elden Ring", "Duna" ou "Cálculo 1"), escolhe o tipo e, se quiser, descreve o que está aprendendo. A partir daí, é só anotar. Cada anotação pode ter um **marcador de progresso** (capítulo, sessão de jogo, aula) e um **nível de confiança**: **fato** (vi com meus olhos), **suspeita** (acho que é isso) ou **boato** (alguém me contou). Personagens mentem e narradores enganam, e essa distinção deixa a análise muito mais rica.

### 2. Wiki Viva e Análise
A cada anotação, a IA identifica personagens, lugares, itens, eventos ou conceitos e mantém uma ficha para cada um, com links para as notas de origem. Sobre essa base, o Bookmark:
* aponta **lacunas** ("você sabe que X é filho de Y, mas nunca anotou nada sobre a mãe");
* mantém uma lista de **mistérios em aberto** e avisa quando uma nota nova pode ter resolvido algum;
* detecta **contradições**, como um boato desmentido por um fato;
* levanta **teorias** e reúne evidências a favor e contra;
* organiza **duas linhas do tempo**: a ordem em que você descobriu as coisas e a ordem cronológica da história;
* desenha um **mural de investigação**, um grafo que liga as entidades como num quadro de detetive.

### 3. Memória de Longo Prazo
Ao voltar para um projeto depois de dias parado, o usuário recebe um resumo no estilo **"Da última vez em..."**, com o que tinha descoberto e as dúvidas que estavam em aberto. No **modo estudo**, o Bookmark gera flashcards e quizzes a partir das próprias notas, com revisão espaçada, e oferece o **modo Feynman**: o usuário explica um conceito com as próprias palavras e a IA compara com o que ele anotou, apontando o que ficou faltando.

---

## Um App, Vários Usos

| | Livro | História de jogo | Estudos |
| :--- | :--- | :--- | :--- |
| **Exemplo de nota** | "Paul teve uma visão com o deserto de novo" | "A descrição da espada fala de um cavaleiro que traiu a ordem" | "Derivada é a taxa de variação instantânea" |
| **Progresso** | Capítulo | Sessão ou região do mapa | Aula ou módulo |
| **Entidades** | Personagens, casas, lugares | NPCs, itens, regiões, facções | Conceitos, fórmulas, autores |
| **Lacunas típicas** | Parentescos e motivações | Origem de itens e facções | Conceitos sem exemplo ou sem conexão |
| **Destaque** | Linha do tempo e fichas | Mural de investigação e mistérios | Modo estudo e revisão espaçada |

---

## O Princípio Anti-Spoiler

**O Bookmark só sabe o que você descobriu.** A base de conhecimento são as anotações do usuário, nada mais. Como modelos de linguagem já conhecem muitas obras famosas, a proteção é feita em camadas:

1. **Busca restrita.** O RAG recupera apenas notas do projeto atual, respeitando o marcador de progresso.
2. **Instruções rígidas.** O modelo é orientado a responder somente com base nas notas fornecidas e a dizer "você ainda não descobriu isso" quando a informação não estiver nelas.
3. **Citação obrigatória.** Toda afirmação precisa apontar para a nota de origem. O backend valida a citação de cada frase antes de enviá-la ao frontend. Uma frase sem citação é ocultada e sinalizada como possível conhecimento externo, e o usuário decide se quer revelar.
4. **Teorias rotuladas.** Toda teoria gerada é marcada como especulação e mostra em quais notas se baseia.
5. **Avaliações automáticas.** Um conjunto de testes anti-spoiler roda antes de qualquer mudança em prompts ou na busca (ver [Testes](#testes)).

Nenhuma camada é infalível sozinha. Por isso a transparência das citações é parte central da experiência.

---

## Motor de IA

A IA roda dentro do próprio backend, em um módulo dedicado (`AiModule`) construído com o **Vercel AI SDK**. Nenhum outro módulo fala diretamente com os provedores de IA: todos passam pelo `AiModule`, que funciona como uma fronteira bem definida. Se um dia for preciso separar a IA em um serviço próprio, basta extrair esse módulo.

O `AiModule` não acessa o banco de dados. Os services montam o contexto de cada tarefa (notas relevantes, fichas, mistérios abertos, preferências do usuário) e passam para ele, que devolve o resultado. Assim, toda a regra de acesso aos dados, incluindo o isolamento entre usuários, fica fora da IA.

* Provedor configurável: Groq, OpenAI, Anthropic ou modelos locais via Ollama.
* Respostas estruturadas validadas com schemas **Zod** compartilhados no monorepo (`packages/shared`), os mesmos usados pelo frontend e pela validação da API.
* Embeddings via AI SDK (provedor externo ou Ollama) ou localmente com **Transformers.js**. Como as notas são em português, a escolha deve ser um modelo multilíngue (no caso do Transformers.js, com versão em ONNX).
* Respostas das perguntas enviadas em **streaming por frase**: cada frase só chega ao frontend depois que a citação dela é validada.
* As chaves dos provedores ficam apenas nas variáveis de ambiente do backend.

### Operações do AiModule

| Operação | Quando roda | O que produz |
| :--- | :--- | :--- |
| `extract` | A cada nota (worker) | Entidades e relações para a wiki |
| `embed` | A cada nota (worker) e a cada pergunta | Vetores salvos ou usados na busca no pgvector |
| `analyze` | A cada nota (worker) | Mistérios possivelmente resolvidos, novas lacunas, contradições e eventos da linha do tempo |
| `ask` | Sob demanda | Resposta em streaming com citações das notas |
| `theories` | Sob demanda | Teorias rotuladas como especulação, com evidências |
| `recap` | Ao reabrir um projeto após ausência | Resumo "Da última vez em..." |
| `study` | Sob demanda | Flashcards, quizzes e avaliação no modo Feynman |
| `visionText` | Sob demanda | Texto extraído de um print, que vira anotação |

### Memória em três camadas

| Camada | O que guarda | Onde vive |
| :--- | :--- | :--- |
| **Usuário** | Preferências de estudo, nível de detalhe e tom das respostas | `user_memory` |
| **Projeto** | Entidades, relações, lacunas, mistérios, teorias e linha do tempo | Tabelas do projeto |
| **Sessão** | A conversa atual com o assistente | Memória de curto prazo, não persistida |

Todas as camadas vivem no PostgreSQL e são passadas ao `AiModule` quando necessário.

### Busca híbrida
A busca é executada no PostgreSQL. O texto da pergunta é convertido em vetor pelo `AiModule`, e a **busca vetorial** (pgvector) é combinada com a **busca por palavra-chave** (full-text search do PostgreSQL). Nomes próprios inventados, muito comuns em livros e jogos, são um ponto fraco dos embeddings, e a busca textual cobre essa falha. Como anotações costumam ser curtas, **cada nota é uma unidade de busca inteira**, sem fatiamento, o que mantém as citações precisas.

### Saída estruturada
Tarefas como extração de entidades e análise da nota pedem ao modelo uma resposta em formato estruturado, validada com **Zod** antes de ser gravada no banco. Se a validação falhar, o job volta para a fila e é reprocessado.

> **Nota:** trocar o modelo de embeddings exige reprocessar os vetores de todas as notas, já que vetores de modelos diferentes não são comparáveis entre si.

---

## ideias do projeto

O desenvolvimento é dividido em três entregas, começando pelo núcleo (anotar, buscar e organizar) e só depois partindo para a análise e as ferramentas de estudo.

### MVP 1 — Caderno, Busca e Wiki

* Projetos com título, tipo, contexto e progresso atual.
* Anotações com marcador de progresso e nível de confiança.
* Embeddings, busca híbrida e perguntas respondidas com citação.
* Extração de entidades e wiki automática.
* Rate limiting nas rotas de IA.

### MVP 2 — Análise e Memória
* Anotador de lacunas e detecção de contradições.
* Mistérios em aberto, com aviso de possível resolução.
* Teorias do usuário e da IA, com evidências a favor e contra.
* Duas linhas do tempo.
* Resumo "Da última vez em...".
* Memória do usuário (preferências).

### MVP 3 — Estudo e Visual
* Modo estudo: flashcards, quizzes e revisão espaçada.
* Modo Feynman.
* Mural de investigação.
* Captura por imagem (um print vira anotação).
* Exportação da wiki em Markdown.

---

## Como rodar

O projeto é um monorepo com **npm workspaces**: o `package.json` da raiz enxerga as pastas `apps/api` (NestJS) e `apps/web` (Next.js) como pacotes do mesmo repositório. Por isso os comandos abaixo devem ser executados **na raiz do projeto**, e não dentro de `apps/api` ou `apps/web`.

### Pré-requisitos
* Node.js e npm
* Docker (para o PostgreSQL com pgvector)

### Passo a passo

```bash
npm install       # instala as dependências da raiz e das duas aplicações
npm run dev:all   # sobe o Postgres no Docker, a API e o front de uma vez
```

Se o Postgres já estiver rodando, basta `npm run dev`.

### Scripts disponíveis (raiz)

| Script | O que faz |
| :--- | :--- |
| `npm run dev` | Inicia a API e o front ao mesmo tempo, no mesmo terminal |
| `npm run dev:all` | Executa `db:up` e, em seguida, `dev` |
| `npm run db:up` | Sobe o container do PostgreSQL em segundo plano (`docker compose up -d postgres`) |
| `npm run dev:api` | Inicia só a API (`nest start --watch` em `apps/api`) |
| `npm run dev:web` | Inicia só o front (`next dev` em `apps/web`) |
| `npm run build` | Gera o build das duas aplicações |
| `npm test` | Roda os testes da API |
| `npm run db:generate` | Gera uma nova migration do Drizzle a partir de `apps/api/src/database/schema.ts` |
| `npm run db:studio` | Abre o Drizzle Studio para navegar pelos dados do banco |

### Banco de dados (Drizzle ORM)

A API acessa o PostgreSQL pelo **Drizzle ORM**, que tem suporte nativo ao pgvector (coluna `vector` e `cosineDistance` para a busca por similaridade).

* As tabelas ficam em `apps/api/src/database/schema.ts`.
* As migrations SQL ficam em `apps/api/drizzle/` e são aplicadas automaticamente quando a API inicia.
* Para mudar o schema: edite `schema.ts`, rode `npm run db:generate`, revise o SQL gerado e faça commit dele junto com a mudança.

### Como o `npm run dev` funciona

O script usa o pacote [`concurrently`](https://www.npmjs.com/package/concurrently), instalado como dependência de desenvolvimento na raiz:

```json
"dev": "concurrently -n api,web -c blue,magenta \"npm:dev:api\" \"npm:dev:web\""
```

* `"npm:dev:api"` e `"npm:dev:web"` são atalhos do concurrently para `npm run dev:api` e `npm run dev:web`. Cada um usa `--workspace` para rodar o script dentro da aplicação certa.
* Os dois processos rodam em paralelo no mesmo terminal.
* `-n api,web` e `-c blue,magenta` dão um nome e uma cor a cada processo, e cada linha do log aparece com o prefixo `[api]` ou `[web]`.
* Se um dos servidores cair (por exemplo, a API sem conexão com o banco), o outro continua rodando.
* Um único `Ctrl+C` encerra os dois.

### Como o comando chega em cada pasta

Quem aponta para as pastas não é o `concurrently`, e sim o **npm workspaces**. São três etapas encadeadas.

**1. A raiz declara as pastas.** No `package.json` da raiz:

```json
"workspaces": ["apps/*"]
```

Isso diz ao npm que cada pasta dentro de `apps/` é um projeto próprio, com seu próprio `package.json`: `apps/api` e `apps/web`.

**2. Os scripts da raiz usam `--workspace`.**

```json
"dev:api": "npm run start:dev --workspace=apps/api",
"dev:web": "npm run dev --workspace=apps/web"
```

O `--workspace=apps/api` faz o npm entrar na pasta `apps/api` e rodar o script `start:dev` do `package.json` **de lá**. O mesmo vale para `apps/web`:

```json
// apps/api/package.json
"start:dev": "nest start --watch"     // inicia o NestJS

// apps/web/package.json
"dev": "next dev"                     // inicia o Next.js
```

**3. O `concurrently` só chama os dois ao mesmo tempo.** Ele não conhece pastas nem frameworks: apenas executa `npm run dev:api` e `npm run dev:web` em paralelo.

**O caminho completo:**

```
npm run dev                       (raiz)
 └─ concurrently
     ├─ npm run dev:api           (raiz)
     │   └─ --workspace=apps/api  → entra em apps/api
     │       └─ start:dev         → nest start --watch   [api]
     │
     └─ npm run dev:web           (raiz)
         └─ --workspace=apps/web  → entra em apps/web
             └─ dev               → next dev             [web]
```

Na prática, é o mesmo que abrir dois terminais e rodar `cd apps/api` + `npm run start:dev` em um e `cd apps/web` + `npm run dev` no outro. O `--workspace` substitui o `cd`, e o `concurrently` substitui os dois terminais.

Por padrão, o front fica em `http://localhost:3000`, a API em `http://localhost:3001` e a API se conecta ao PostgreSQL na porta `5432`.

O front não chama a API diretamente: ele faz as requisições para `/api/*` na própria origem, e o Next.js repassa (proxy) para a URL definida em `API_URL` no `.env`. Por isso não é preciso configurar CORS, e o app funciona acessado por `localhost`, `127.0.0.1` ou pelo IP da rede.

> **Dica:** dentro de `apps/api` o script de desenvolvimento se chama `start:dev`, e não `dev`. Para iniciar só a API a partir dessa pasta, use `npm run start:dev`.
