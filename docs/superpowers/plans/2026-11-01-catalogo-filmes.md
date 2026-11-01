# Catálogo de Filmes em Streaming — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um site local (React + Vite) que lista os filmes disponíveis nos streamings por assinatura no Brasil, com filtros, busca e janela de detalhes, usando a API do TMDB.

**Architecture:** O navegador fala direto com o TMDB. `src/api/tmdb.js` é o único módulo que faz requisições e devolve dados já simplificados. `App.jsx` guarda o estado (filtros, busca, lista, filme aberto) e passa dados e callbacks para componentes de apresentação em `src/componentes/`. `JanelaDetalhes` busca os próprios dados a partir de um `filmeId`.

**Tech Stack:** React, Vite, JavaScript (sem TypeScript), Vitest, Testing Library (`@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`), jsdom.

**Spec:** `docs/superpowers/specs/2026-11-01-catalogo-filmes-design.md`

## Global Constraints

- O usuário é iniciante e está aprendendo: ao terminar cada tarefa, explique em português simples o que foi feito e por quê.
- Todo o texto visível fica em português. Os nomes de componentes e arquivos em `src/componentes/` também, conforme a spec.
- JavaScript puro (`.js` / `.jsx`), sem TypeScript.
- Parâmetros fixos do TMDB: `watch_region=BR`, `language=pt-BR`, `with_watch_monetization_types=flatrate`, `include_adult=false`.
- A chave fica em `VITE_TMDB_TOKEN` (arquivo `.env`) e é enviada como `Authorization: Bearer <token>`. O `.env` nunca entra no Git.
- URL base `https://api.themoviedb.org/3`. Imagens: pôster `https://image.tmdb.org/t/p/w342`, logo `…/w92`, fundo `…/w780`, foto de ator `…/w185`.
- Nenhum teste chama o TMDB de verdade.
- **Ambiente Windows:** o Node está em `C:\Program Files\nodejs`, mas o PATH desta sessão pode não incluí-lo. Em Bash, prefixe os comandos com `export PATH="/c/Program Files/nodejs:$PATH" &&`. Todos os comandos rodam dentro de `catalogo-filmes/`.
- Commits terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Filme repetido entre páginas:** a ordem de popularidade do TMDB muda enquanto o usuário navega, e o mesmo filme pode voltar na página 2. O "Carregar mais" deve descartar IDs repetidos (teste na Tarefa 6).
2. **Busca só com espaços (`"   "`):** deve ser tratada como busca vazia, sem pausar os filtros nem consultar o TMDB (teste na Tarefa 7).
3. **Busca com caracteres especiais** (`"amor & ódio?"`): o texto chega intacto ao TMDB, codificado na URL (teste na Tarefa 2).
4. **Filme sem data ou sem votos:** não pode aparecer "NaN" nem "★ 0.0". O ano fica oculto e a nota aparece como "–" (testes nas Tarefas 2 e 4).
5. **Clique duplo em "Carregar mais":** não pode disparar duas consultas da mesma página. O botão fica desativado enquanto carrega (teste na Tarefa 4).

**Ajuste em relação à spec:** a lista `/watch/providers/movie` inclui lojas de aluguel/compra, que não têm filmes `flatrate`. `listarStreamings` exclui os IDs `[2, 3, 10, 68, 192]` (Apple TV loja, Google Play Filmes, Amazon Video, Microsoft Store, YouTube) antes de pegar os 8 primeiros. A Tarefa 8 confere a lista real.

---

### Task 1: Projeto base e núcleo do mensageiro

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx` (provisório: só `<h1>Catálogo de Filmes</h1>`), `src/styles.css` (vazio), `src/testes/setup.js`, `.env.example`, `README.md`
- Create: `src/api/tmdb.js`
- Test: `src/api/tmdb.test.js`

**Interfaces:**
- Produces: `class ErroTmdb extends Error { tipo: 'chave-invalida' | 'rede' }` e `requisitar(caminho: string, params?: object) => Promise<object>`, ambos exportados de `src/api/tmdb.js`.

- [ ] **Step 1: Criar o projeto à mão (sem `npm create vite`, que pede confirmação porque a pasta não está vazia)**

`package.json` com `"type": "module"`, `"private": true` e os scripts `"dev": "vite"`, `"build": "vite build"`, `"test": "vitest run"`, `"test:watch": "vitest"`. Depois:

```bash
npm install react react-dom
npm install -D vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

`vite.config.js` usa `defineConfig` de `vitest/config` com `plugins: [react()]` e `test: { environment: 'jsdom', globals: true, setupFiles: './src/testes/setup.js' }`.
`src/testes/setup.js`: `import '@testing-library/jest-dom/vitest'` e `window.scrollTo = vi.fn()` (o jsdom não implementa `scrollTo`).
`index.html` com `lang="pt-BR"`, `<title>Catálogo de Filmes</title>`, `<div id="root">` e `<script type="module" src="/src/main.jsx">`. `main.jsx` importa `./styles.css` e renderiza `<App />` em `StrictMode`.
`.env.example`: `VITE_TMDB_TOKEN=cole_aqui_seu_read_access_token`.
`README.md` em português, para leigos: (1) criar conta grátis em themoviedb.org; (2) Configurações → API → solicitar chave para uso pessoal; (3) copiar o **"Token de Leitura da API" (Read Access Token)**, não a "Chave da API"; (4) copiar `.env.example` para `.env` e colar o token; (5) `npm install`, `npm run dev`, abrir o endereço exibido; (6) `npm test` para rodar os testes; (7) se aparecer "Chave do TMDB não encontrada ou inválida", conferir o `.env` e reiniciar o `npm run dev`.

- [ ] **Step 2: Escrever os testes do núcleo em `src/api/tmdb.test.js`**

```js
import { requisitar, ErroTmdb } from './tmdb'

const respostaJson = (dados, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => dados })

beforeEach(() => { vi.stubEnv('VITE_TMDB_TOKEN', 'token-teste'); globalThis.fetch = vi.fn() })
afterEach(() => vi.unstubAllEnvs())

test('monta a URL com os parâmetros e envia o token', async () => {
  fetch.mockResolvedValue(respostaJson({ ok: 1 }))
  expect(await requisitar('/genre/movie/list', { language: 'pt-BR' })).toEqual({ ok: 1 })
  const [url, opcoes] = fetch.mock.calls[0]
  expect(url).toBe('https://api.themoviedb.org/3/genre/movie/list?language=pt-BR')
  expect(opcoes.headers.Authorization).toBe('Bearer token-teste')
})

test('omite parâmetros null, undefined e ""', async () => {
  fetch.mockResolvedValue(respostaJson({}))
  await requisitar('/x', { a: 1, b: null, c: undefined, d: '' })
  expect(fetch.mock.calls[0][0]).toBe('https://api.themoviedb.org/3/x?a=1')
})

test('HTTP 401 vira ErroTmdb do tipo chave-invalida', async () => {
  fetch.mockResolvedValue(respostaJson({}, 401))
  await expect(requisitar('/x')).rejects.toMatchObject({ name: 'ErroTmdb', tipo: 'chave-invalida' })
})

test('token vazio vira chave-invalida sem chamar o fetch', async () => {
  vi.stubEnv('VITE_TMDB_TOKEN', '')
  await expect(requisitar('/x')).rejects.toMatchObject({ tipo: 'chave-invalida' })
  expect(fetch).not.toHaveBeenCalled()
})

test('falha de rede e HTTP 500 viram tipo rede', async () => {
  fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
  await expect(requisitar('/x')).rejects.toBeInstanceOf(ErroTmdb)
  fetch.mockResolvedValueOnce(respostaJson({}, 500))
  await expect(requisitar('/x')).rejects.toMatchObject({ tipo: 'rede' })
})
```

- [ ] **Step 3: Rodar `npm test` e confirmar a falha**

Esperado: FAIL, porque `./tmdb` não existe.

- [ ] **Step 4: Implementar `ErroTmdb` e `requisitar` em `src/api/tmdb.js`**

O token é lido de `import.meta.env.VITE_TMDB_TOKEN` **dentro** de `requisitar`, a cada chamada, para que o `vi.stubEnv` funcione. A URL é montada com `URLSearchParams`. `ErroTmdb` define `this.name = 'ErroTmdb'`.

- [ ] **Step 5: Rodar `npm test` e confirmar que passa**

Esperado: 5 testes PASS. Rode também `npm run dev` e confira que o título aparece no navegador. Depois encerre o servidor.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html .env.example README.md src
git commit -m "Cria projeto React + Vite e núcleo do mensageiro do TMDB"
```

---

### Task 2: Funções do mensageiro

**Files:**
- Modify: `src/api/tmdb.js`
- Test: `src/api/tmdb.test.js`

**Interfaces:**
- Consumes: `requisitar` (Tarefa 1).
- Produces (todas exportadas de `src/api/tmdb.js`):
  - `Filme = { id: number, titulo: string, poster: string|null, nota: number|null, ano: string|null }`. `poster` é a URL completa (w342). `nota` tem 1 casa decimal e vale `null` quando `vote_count === 0`. `ano` são os 4 primeiros caracteres de `release_date`, ou `null` se estiver vazio.
  - `Pagina = { filmes: Filme[], pagina: number, totalPaginas: number, totalResultados: number }`, com `totalPaginas = Math.min(total_pages, 500)`.
  - `Streaming = { id: number, nome: string, logo: string|null }`. `Genero = { id: number, nome: string }`. `Pessoa = { id: number, nome: string, personagem: string, foto: string|null }`.
  - `listarStreamings() => Promise<Streaming[]>`
  - `listarGeneros() => Promise<Genero[]>`
  - `descobrirFilmes({ streamings: number[], genero: number|null, ordenacao: 'populares'|'avaliados'|'lancamentos', pagina: number }) => Promise<Pagina>`
  - `buscarFilmes({ texto: string, pagina: number }) => Promise<Pagina>`
  - `detalhesFilme(id: number) => Promise<Detalhes>`, onde `Detalhes = { id, titulo, poster, fundo: string|null, nota, ano, duracao: number|null (minutos), generos: string[], diretores: string[], sinopse: string, trailer: string|null (key do YouTube), streamings: Streaming[], elenco: Pessoa[] (máx. 8) }`

- [ ] **Step 1: Acrescentar os testes a `src/api/tmdb.test.js`**

Use o helper `respostaJson` e leia os parâmetros com `const p = new URL(fetch.mock.calls[0][0]).searchParams`.

- `descobrirFilmes com Netflix + Prime + Terror`: chamada a `{ streamings: [8, 119], genero: 27, ordenacao: 'populares', pagina: 2 }`. Espera caminho `/discover/movie`, `p.get('with_watch_providers') === '8|119'`, `with_genres === '27'`, `watch_region === 'BR'`, `with_watch_monetization_types === 'flatrate'`, `language === 'pt-BR'`, `include_adult === 'false'`, `sort_by === 'popularity.desc'`, `page === '2'`.
- `descobrirFilmes sem streamings`: `p.has('with_watch_providers') === false` e `p.has('with_genres') === false` (gênero `null`).
- `ordenação avaliados`: `sort_by === 'vote_average.desc'` e `vote_count.gte === '200'`.
- `ordenação lancamentos`: com `vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 1, 23, 30))`, espera `sort_by === 'primary_release_date.desc'` e `primary_release_date.lte === '2026-11-01'` (data **local**, não UTC). Termine com `vi.useRealTimers()`.
- `simplifica filmes e limita páginas`: a resposta `{ page: 1, total_pages: 900, total_results: 18000, results: [{ id: 1, title: 'A', poster_path: '/a.jpg', vote_average: 7.456, vote_count: 10, release_date: '2024-05-01' }, { id: 2, title: 'B', poster_path: null, vote_average: 0, vote_count: 0, release_date: '' }] }` deve virar `{ pagina: 1, totalPaginas: 500, totalResultados: 18000, filmes: [{ id: 1, titulo: 'A', poster: 'https://image.tmdb.org/t/p/w342/a.jpg', nota: 7.5, ano: '2024' }, { id: 2, titulo: 'B', poster: null, nota: null, ano: null }] }`.
- `buscarFilmes codifica o texto`: `{ texto: 'amor & ódio?', pagina: 1 }` gera caminho `/search/movie`, `p.get('query') === 'amor & ódio?'`, `language === 'pt-BR'` e `include_adult === 'false'`.
- `listarStreamings`: a resposta `results` com 11 provedores, incluindo os IDs 2 e 3 com as prioridades mais baixas, e um item sem `display_priorities.BR` (usa `display_priority`), deve devolver 8 itens em ordem crescente de prioridade, sem os IDs 2 e 3, no formato `{ id, nome, logo: 'https://image.tmdb.org/t/p/w92/…' }`. O caminho é `/watch/providers/movie` com `watch_region=BR`.
- `listarGeneros`: `{ genres: [{ id: 27, name: 'Terror' }] }` vira `[{ id: 27, nome: 'Terror' }]`.
- `detalhesFilme`: verifica o caminho `/movie/42`, `append_to_response === 'credits,videos,watch/providers'` e `include_video_language === 'pt,en'`. Com uma resposta que tem `runtime: 112`, `genres: [{name:'Terror'}]`, `backdrop_path: '/f.jpg'`, `credits.crew` com dois `job: 'Director'` e um `job: 'Writer'`, `credits.cast` com 10 pessoas, `videos.results` com `[{ site:'YouTube', type:'Teaser', key:'t1', iso_639_1:'pt' }, { site:'YouTube', type:'Trailer', key:'en1', iso_639_1:'en' }, { site:'YouTube', type:'Trailer', key:'pt1', iso_639_1:'pt' }]` e `watch/providers.results.BR.flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png' }]`, espera `duracao: 112`, `generos: ['Terror']`, `fundo` em w780, `diretores` com os 2 nomes, `elenco.length === 8`, `trailer: 'pt1'` e `streamings: [{ id: 8, nome: 'Netflix', logo: 'https://image.tmdb.org/t/p/w92/n.png' }]`.
- `detalhesFilme sem BR nem trailer`: com `watch/providers.results: {}` e `videos.results: []`, espera `streamings: []` e `trailer: null`.

- [ ] **Step 2: Rodar `npm test` e confirmar as falhas**

Esperado: os novos testes falham com "is not a function".

- [ ] **Step 3: Implementar as cinco funções em `src/api/tmdb.js`**

Mapa `ordenacao → params`: `populares → { sort_by: 'popularity.desc' }`, `avaliados → { sort_by: 'vote_average.desc', 'vote_count.gte': 200 }`, `lancamentos → { sort_by: 'primary_release_date.desc', 'primary_release_date.lte': hojeLocal() }`. `streamings` vazio vira `null`, e o `requisitar` omite. Um único `simplificarFilme(r)` serve para discover, search e detalhes. Trailer: entre os vídeos com `site === 'YouTube' && type === 'Trailer'`, use o primeiro com `iso_639_1 === 'pt'`. Se não houver, o primeiro de qualquer idioma. Se não houver nenhum, `null`.

- [ ] **Step 4: Rodar `npm test` e confirmar que passa**

Esperado: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api
git commit -m "Mensageiro: streamings, gêneros, descobrir, buscar e detalhes"
```

---

### Task 3: Cabeçalho, barra de filtros e rodapé

**Files:**
- Create: `src/componentes/Cabecalho.jsx`, `src/componentes/BarraFiltros.jsx`, `src/componentes/Rodape.jsx`
- Test: `src/componentes/BarraFiltros.test.jsx`

**Interfaces:**
- Consumes: os formatos `Streaming` e `Genero` (Tarefa 2).
- Produces:
  - `Cabecalho({ texto: string, onTextoChange: (texto: string) => void })`: logo "🎬 CATÁLOGO" e um `<input type="search">` com `aria-label="Buscar filme"` e placeholder "Buscar filme...".
  - `BarraFiltros({ streamings: Streaming[], generos: Genero[], selecionados: number[], genero: number|null, ordenacao: string, busca: string, onAlternarStreaming: (id) => void, onGenero: (id|null) => void, onOrdenacao: (valor) => void, onLimparBusca: () => void })`
  - `Rodape()`: sem props.

- [ ] **Step 1: Escrever os testes em `BarraFiltros.test.jsx`**

Renderize com `streamings = [{ id: 8, nome: 'Netflix', logo: null }, { id: 119, nome: 'Prime Video', logo: null }]`, `generos = [{ id: 27, nome: 'Terror' }]`, `selecionados = [8]`, `genero = null`, `ordenacao = 'populares'`, `busca = ''` e callbacks `vi.fn()`.

- `marca os streamings selecionados`: o botão "Netflix" tem `aria-pressed="true"`, e "Prime Video" tem `"false"`.
- `clicar num streaming chama onAlternarStreaming(id)`: clicar em "Prime Video" chama o callback com `119`.
- `menu de gênero`: o `combobox` com nome "Gênero" tem as opções "Todos" e "Terror". Escolher "Terror" chama `onGenero(27)`, e voltar para "Todos" chama `onGenero(null)`.
- `menu de ordenação`: o `combobox` "Ordenar por" tem as opções "Mais populares", "Mais bem avaliados" e "Lançamentos". Escolher "Lançamentos" chama `onOrdenacao('lancamentos')`.
- `com busca ativa, filtros ficam pausados`: com `busca = 'batman'`, aparece o texto "Buscando por 'batman' (filtros pausados)", todos os botões de streaming e os dois menus ficam `disabled`, e clicar em "✕ Limpar busca" chama `onLimparBusca`.

- [ ] **Step 2: Rodar `npm test -- BarraFiltros` e confirmar a falha**

- [ ] **Step 3: Implementar os três componentes**

Use `<select>` com `<label>` ("Gênero", "Ordenar por") e chips como `<button aria-pressed>`, com logo e nome. `Rodape` mostra o logo do TMDB (`https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg`, `alt="TMDB"`), o texto exato "Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB." e a frase "Dados de onde assistir: JustWatch."

- [ ] **Step 4: Rodar `npm test` e confirmar que passa**

- [ ] **Step 5: Commit**

```bash
git add src/componentes
git commit -m "Componentes: cabeçalho, barra de filtros e rodapé"
```

---

### Task 4: Cartão, grade de filmes e mensagem

**Files:**
- Create: `src/componentes/CartaoFilme.jsx`, `src/componentes/GradeFilmes.jsx`, `src/componentes/Mensagem.jsx`
- Test: `src/componentes/GradeFilmes.test.jsx`

**Interfaces:**
- Consumes: `Filme` (Tarefa 2).
- Produces:
  - `CartaoFilme({ filme: Filme, onAbrir: (id) => void })`: um `<button>` cujo nome acessível contém o título. Mostra o pôster ou, sem pôster, `<div className="sem-imagem">🎬</div>`. Mostra "★ 7.5", ou "★ –" quando `nota` é `null`. Mostra o título, e o ano só quando existe.
  - `GradeFilmes({ filmes: Filme[], totalResultados: number, carregando: boolean, temMais: boolean, erroMais: boolean, onCarregarMais: () => void, onAbrir: (id) => void, onTentarDeNovo: () => void })`
  - `Mensagem({ texto: string, acao?: { rotulo: string, onClick: () => void } })`: um `<div role="alert">` com o texto e, se houver `acao`, um botão.

- [ ] **Step 1: Escrever os testes em `GradeFilmes.test.jsx`**

- `mostra esqueletos ao carregar a primeira página`: com `filmes=[]` e `carregando=true`, aparecem 12 elementos com `data-testid="esqueleto"` e nenhum contador.
- `mostra contador e cartões`: com 2 filmes e `totalResultados=1248`, aparece "1.248 filmes" (`toLocaleString('pt-BR')`) e 2 botões de filme. Clicar no primeiro chama `onAbrir(id)`.
- `nota e ano ausentes`: o filme `{ id: 2, titulo: 'B', poster: null, nota: null, ano: null }` mostra "★ –", não mostra "NaN" nem "null", e renderiza `.sem-imagem`.
- `Carregar mais`: com `temMais=true`, clicar em "Carregar mais" chama `onCarregarMais`. Com `temMais=false`, o botão não existe.
- `não carrega duas vezes`: com `temMais=true` e `carregando=true` (e filmes já na tela), o botão aparece como "Carregando..." e `disabled`.
- `erro no carregar mais`: com `erroMais=true`, os cartões continuam na tela e aparece "Não foi possível falar com o TMDB". O botão "Tentar de novo" chama `onTentarDeNovo`.

- [ ] **Step 2: Rodar `npm test -- GradeFilmes` e confirmar a falha**

- [ ] **Step 3: Implementar os três componentes**

O contador mostra `"1 filme"` no singular e `"N filmes"` no plural. Pôster com `alt=""` e `loading="lazy"`. O título fica visível no cartão.

- [ ] **Step 4: Rodar `npm test` e confirmar que passa**

- [ ] **Step 5: Commit**

```bash
git add src/componentes
git commit -m "Componentes: cartão, grade de filmes e mensagem"
```

---

### Task 5: Janela de detalhes

**Files:**
- Create: `src/componentes/JanelaDetalhes.jsx`
- Test: `src/componentes/JanelaDetalhes.test.jsx`

**Interfaces:**
- Consumes: `detalhesFilme(id)` e `ErroTmdb` (Tarefa 2), e `Mensagem` (Tarefa 4).
- Produces: `JanelaDetalhes({ filmeId: number, onFechar: () => void })`. O componente busca os próprios dados. O fundo escuro tem `data-testid="fundo-janela"`, e a janela tem `role="dialog"` com `aria-label` igual ao título (ou "Carregando" enquanto carrega).

- [ ] **Step 1: Escrever os testes**

Use `vi.mock('../api/tmdb', async (orig) => ({ ...(await orig()), detalhesFilme: vi.fn() }))` e um objeto `detalhes` completo no formato `Detalhes`: título "Filme A", nota 7.4, ano "2024", duração 112, gêneros `['Terror', 'Suspense']`, diretores `['Ana Lima', 'Rui Costa']`, trailer `'pt1'`, streamings `[{ id: 8, nome: 'Netflix', logo: '…' }]` e 8 pessoas no elenco.

- `mostra carregando e depois os detalhes`: primeiro aparece um texto "Carregando..."; depois aparecem "Filme A", "★ 7.4", "2024", "1h 52min", "Terror, Suspense", "Direção: Ana Lima, Rui Costa", a sinopse, um `img` com `alt="Netflix"`, "dados: JustWatch" e 8 nomes do elenco.
- `sem diretor, a linha some`: com `diretores: []`, o texto "Direção:" não aparece.
- `sem streaming`: com `streamings: []`, aparece "Não disponível em streaming por assinatura no Brasil".
- `trailer`: clicar em "▶ Ver trailer" mostra um `iframe` com `title="Trailer"` e `src` `https://www.youtube.com/embed/pt1?autoplay=1`. Com `trailer: null`, o botão não existe.
- `fecha pelo ✕, pela tecla Esc e pelo clique fora`: o botão com nome "Fechar" chama `onFechar`; `userEvent.keyboard('{Escape}')` também; clicar em `fundo-janela` também; clicar dentro do `dialog` **não** chama.
- `erro com tentar de novo`: na primeira chamada, `detalhesFilme` rejeita com `new ErroTmdb('rede')` e mostra "Não foi possível falar com o TMDB". Clicar em "Tentar de novo" chama `detalhesFilme` outra vez e mostra "Filme A".
- `resposta velha é descartada`: a chamada para o id 1 fica pendente (promessa resolvida à mão), e o componente é re-renderizado com `filmeId=2`, cuja resposta "Filme B" chega primeiro. Depois a do id 1 resolve com "Filme A". Na tela continua "Filme B".

- [ ] **Step 2: Rodar `npm test -- JanelaDetalhes` e confirmar a falha**

- [ ] **Step 3: Implementar `JanelaDetalhes`**

O `useEffect` depende de `[filmeId, tentativa]` e usa a flag `cancelado` na limpeza para descartar respostas velhas. O listener de `keydown` para Esc fica em `document` e é removido na limpeza. A duração é formatada como `${h}h ${mm}min` (ou só `${mm}min` abaixo de 60). Ator sem foto recebe `<div className="sem-imagem">👤</div>`. Os erros usam `Mensagem` com o mesmo texto da seção 5 da spec.

- [ ] **Step 4: Rodar `npm test` e confirmar que passa**

- [ ] **Step 5: Commit**

```bash
git add src/componentes
git commit -m "Componente: janela de detalhes do filme"
```

---

### Task 6: App — catálogo, filtros, "Carregar mais" e erros

**Files:**
- Modify: `src/App.jsx` (substitui o provisório)
- Test: `src/App.test.jsx`

**Interfaces:**
- Consumes: as funções da Tarefa 2, `ErroTmdb`, e os componentes das Tarefas 3–5.
- Produces: `App()` (default export), que ganha a busca na Tarefa 7.

- [ ] **Step 1: Escrever os testes em `src/App.test.jsx`**

Mocke `./api/tmdb` mantendo o `ErroTmdb` real. Por padrão: `listarStreamings` devolve Netflix (8) e Prime Video (119), `listarGeneros` devolve Terror (27), e `descobrirFilmes` devolve uma `Pagina` com 20 filmes (`pagina: 1, totalPaginas: 3, totalResultados: 60`). Use o helper `pagina(n, ids)`.

- `abre mostrando esqueletos e depois os filmes`: os esqueletos aparecem e depois "60 filmes". A primeira chamada é `descobrirFilmes({ streamings: [], genero: null, ordenacao: 'populares', pagina: 1 })`.
- `filtros recomeçam da página 1`: clique em "Carregar mais" (pede a `pagina: 2`), depois em "Netflix". A última chamada é `{ streamings: [8], genero: null, ordenacao: 'populares', pagina: 1 }`, a lista mostra só os filmes da nova resposta e `window.scrollTo` foi chamado. Clicar de novo em "Netflix" desmarca e leva a `streamings: []`. Escolher "Terror" e "Mais bem avaliados" leva a `genero: 27` e `ordenacao: 'avaliados'`.
- `Carregar mais acrescenta sem repetir`: a página 1 tem ids 1–20 e a página 2 tem ids 20–39. Depois de "Carregar mais", aparecem 39 cartões, porque o id 20 não se repete.
- `Carregar mais some na última página`: com `totalPaginas: 1`, o botão não existe.
- `respostas fora de ordem`: a chamada com `streamings: []` fica pendente, e você clica em "Netflix", cuja resposta chega primeiro. Depois a pendente resolve. Na tela ficam os filmes da resposta do Netflix.
- `chave inválida`: `descobrirFilmes` rejeita com `new ErroTmdb('chave-invalida')` e aparece "Chave do TMDB não encontrada ou inválida. Veja o passo a passo no README.".
- `sem internet com tentar de novo`: rejeita com `ErroTmdb('rede')`, aparece "Não foi possível falar com o TMDB", e "Tentar de novo" chama `descobrirFilmes` de novo e mostra os filmes. Se `listarStreamings` também tinha falhado, o "Tentar de novo" chama essa função outra vez.
- `nenhum resultado com filtros`: a resposta tem 0 filmes e aparece "Nenhum filme encontrado com esses filtros". "Limpar filtros" volta para `{ streamings: [], genero: null, ordenacao: 'populares', pagina: 1 }`.

- [ ] **Step 2: Rodar `npm test -- App` e confirmar a falha**

- [ ] **Step 3: Implementar o `App`**

Estado conforme a tabela da seção 3 da spec. Um `useRef` contador (`ultimoPedido`) é incrementado a cada consulta de lista, e a resposta só é aplicada se o número for igual ao atual. O efeito principal depende de `[streamings, genero, ordenacao]`: zera `filmes` e `erro`, chama `window.scrollTo({ top: 0 })` e carrega a página 1. `carregarMais` pede `pagina + 1` e acrescenta descartando IDs já presentes. Se der erro com a lista vazia, aparece uma `Mensagem` em tela cheia (texto de chave inválida ou de rede, com "Tentar de novo" só no caso de rede). Se der erro com filmes na tela, `GradeFilmes` recebe `erroMais`. Falhas de `listarStreamings`/`listarGeneros` não mostram mensagem própria; as listas ficam vazias e são recarregadas no "Tentar de novo". Monte a página como `Cabecalho`, `BarraFiltros`, conteúdo e `Rodape` (a busca e a janela entram na Tarefa 7; por ora, `Cabecalho` recebe `texto=""`).

- [ ] **Step 4: Rodar `npm test` e confirmar que passa**

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "App: catálogo com filtros, carregar mais e erros"
```

---

### Task 7: App — busca e janela de detalhes

**Files:**
- Create: `src/useAtrasado.js`
- Test: `src/useAtrasado.test.js`
- Modify: `src/App.jsx`, `src/App.test.jsx`

**Interfaces:**
- Consumes: `buscarFilmes` (Tarefa 2), `Cabecalho`, `BarraFiltros` (Tarefa 3), `JanelaDetalhes` (Tarefa 5), `App` (Tarefa 6).
- Produces: `useAtrasado(valor: string, ms: number) => string`. O hook devolve `valor` depois de `ms` milissegundos sem mudança, mas devolve `''` **na hora** quando `valor === ''`.

- [ ] **Step 1: Escrever os testes do hook em `src/useAtrasado.test.js`**

Use `renderHook` com `vi.useFakeTimers()`. Com `'bat'` → ainda `''`. Depois de `act(() => vi.advanceTimersByTime(499))` → `''`. Depois de mais 1 ms → `'bat'`. Ao trocar para `''` → `''` imediatamente, sem avançar o tempo.

- [ ] **Step 2: Acrescentar os testes de busca e janela a `src/App.test.jsx`** (timers reais; a espera de 500 ms cabe no tempo padrão do `findBy`)

- `busca por nome`: digite "batman" em "Buscar filme". `buscarFilmes` é chamado **uma vez**, com `{ texto: 'batman', pagina: 1 }`. Aparecem os resultados, o aviso "Buscando por 'batman' (filtros pausados)" e os chips desativados. Com `totalPaginas: 2`, "Carregar mais" chama `buscarFilmes({ texto: 'batman', pagina: 2 })`.
- `limpar busca restaura os filtros`: marque "Netflix", busque "batman" e clique em "✕ Limpar busca". O campo fica vazio, o aviso some, "Netflix" continua com `aria-pressed="true"` e a última chamada é `descobrirFilmes({ streamings: [8], …, pagina: 1 })`.
- `busca só com espaços é ignorada`: digite "   " e espere 600 ms. `buscarFilmes` não é chamado e os filtros continuam ativos.
- `busca sem resultado`: aparece "Nenhum filme encontrado para 'xyzxyz'".
- `abrir e fechar detalhes mantém a lista`: mocke `detalhesFilme` e clique no primeiro cartão. Aparece o `dialog` com o título. Depois de `{Escape}`, o `dialog` some, os cartões continuam iguais e `descobrirFilmes` não foi chamado de novo.

- [ ] **Step 3: Rodar `npm test` e confirmar as falhas**

- [ ] **Step 4: Implementar `useAtrasado` e integrar no `App`**

O estado `textoDigitado` alimenta o `Cabecalho`, e `busca = useAtrasado(textoDigitado.trim(), 500)`. O efeito principal passa a depender também de `busca`: com `busca !== ''`, usa `buscarFilmes({ texto: busca, pagina })`; sem busca, usa `descobrirFilmes`. O "Carregar mais" segue o mesmo modo. Use a mensagem de vazio correspondente ao modo. `onLimparBusca` faz `setTextoDigitado('')`. O estado `filmeAberto` é preenchido pelo `onAbrir` da grade e renderiza `<JanelaDetalhes filmeId={filmeAberto} onFechar={() => setFilmeAberto(null)} />` por cima, sem desmontar a grade.

- [ ] **Step 5: Rodar `npm test` e confirmar que passa**

Esperado: todos os testes do projeto PASS.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "App: busca por nome e janela de detalhes"
```

---

### Task 8: Visual e verificação com a chave real

**Files:**
- Modify: `src/styles.css`
- Modify (se necessário): `src/api/tmdb.js` (lista de exclusão de lojas), `README.md`

- [ ] **Step 1: Escrever `src/styles.css` seguindo os mockups aprovados**

Use estas variáveis: fundo `#14161c`, cabeçalho `#0d0f13`, barra `#171a21`, borda `#262a33`, texto `#e8e8ea`, texto secundário `#8a8f99` e destaque `#f5c518`. A grade usa `display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))`. Pôsteres com `aspect-ratio: 2/3`. Chip ativo com fundo amarelo e texto escuro. Barra pausada com `opacity: .45`. `.esqueleto` com animação de pulso. A janela de detalhes é centralizada sobre `rgba(0,0,0,.65)`, com `max-height: 90vh; overflow: auto`. `.sem-imagem` centraliza o emoji sobre fundo `#2b303b`.

- [ ] **Step 2: Rodar `npm test` e `npm run build`**

Esperado: testes PASS e build sem erros.

- [ ] **Step 3: Conseguir a chave com o usuário**

Guie o usuário pelo passo a passo do README. Ele cria o `.env`; **não peça para colar o token no chat**. Confirme com `git status` que o `.env` não aparece.

- [ ] **Step 4: Verificação manual com `npm run dev`**

Confira no navegador, com o usuário:
1. Os 8 chips são serviços **por assinatura**. Se aparecer uma loja de aluguel/compra, acrescente o ID dela à lista de exclusão em `listarStreamings`, junto com um teste, e rode `npm test`.
2. Netflix + Terror mostra pôsteres e o contador, e "Carregar mais" funciona.
3. Abrir um filme mostra sinopse, diretor, elenco, trailer tocando e onde assistir. Esc fecha a janela e a lista continua no mesmo lugar.
4. Buscar um filme antigo (ex.: "Casablanca") e abri-lo mostra os streamings ou o aviso de indisponível.
5. Trocar o token no `.env` por um inválido e reiniciar mostra a mensagem de chave inválida. Depois volte o token correto.
6. O logo do TMDB aparece no rodapé. Se a imagem não carregar, pegue a URL oficial em https://www.themoviedb.org/about/logos-attribution e atualize o `Rodape`.

- [ ] **Step 5: Commit**

```bash
git add src README.md
git commit -m "Visual em tema escuro e ajustes da verificação manual"
```
