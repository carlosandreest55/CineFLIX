# Catálogo de Filmes em Streaming — Design

**Data:** 2026-11-01
**Status:** aguardando revisão

## 1. Objetivo e contexto

Um site que funciona como catálogo dos filmes disponíveis nos streamings por assinatura no Brasil, usando a API do TMDB.

- **Propósito:** projeto de aprendizado do curso de Claude Code. O objetivo é aprender e ver funcionando, não publicar.
- **Quem constrói:** o usuário é iniciante em programação. O Claude escreve o código e explica cada parte durante a construção.
- **Onde roda:** só no computador do usuário (`npm run dev`), sem publicação na internet.
- **Critério de sucesso:** abrir o site, escolher "Netflix + Terror", ver os filmes, clicar num deles e saber se vale assistir (sinopse, nota, trailer, onde assistir).

### Premissas

- País: **Brasil** (`watch_region=BR`). Idioma: **português** (`language=pt-BR`).
- Só entram **streamings por assinatura** (`flatrate`). Aluguel, compra e serviços gratuitos com anúncios ficam de fora.
- Site para computador, com uma grade que se adapta ao tamanho da janela. Uma versão pensada especificamente para celular fica fora desta versão.

### Fora do escopo (primeira versão)

Lista "quero assistir", séries, login de usuários, publicação na internet, servidor próprio, seleção de vários gêneros ao mesmo tempo, seleção de outro país.

## 2. Tecnologia

- **React + Vite**, em **JavaScript** (sem TypeScript).
- **Vitest + Testing Library** para testes automáticos.
- Sem servidor próprio: o navegador chama a API do TMDB diretamente.
- **Chave:** o Read Access Token do TMDB fica em `.env`, na variável `VITE_TMDB_TOKEN`, e é enviado no cabeçalho `Authorization: Bearer <token>`. O `.env` fica no `.gitignore`, e um `.env.example` mostra o formato.
- **Limitação aceita:** como não há servidor, quem abrir as ferramentas de desenvolvedor do navegador consegue ver a chave. Para um site local e uma chave gratuita que só permite leitura, isso é aceitável. Se o site for publicado um dia, será preciso adicionar um servidor intermediário.

## 3. Arquitetura

```
Navegador (React + Vite)
│
├── App.jsx — "cérebro": guarda o estado e coordena as peças
│   ├── Cabecalho       — logo + campo de busca
│   ├── BarraFiltros    — botões de streaming, menu de gênero, menu de ordenação
│   ├── GradeFilmes     — contador, grade de CartaoFilme, botão "Carregar mais"
│   │   └── CartaoFilme — pôster, título, nota
│   ├── JanelaDetalhes  — janela sobre o catálogo
│   ├── Mensagem        — erros, "nenhum resultado"
│   └── Rodapé          — créditos do TMDB e do JustWatch
│
└── api/tmdb.js — "mensageiro": o único módulo que fala com o TMDB
        │
        ▼
   API do TMDB (https://api.themoviedb.org/3)
```

### Estado guardado no App

| Campo | Valor inicial | Significado |
|---|---|---|
| `streamings` | `[]` | IDs dos streamings marcados. Vazio significa "qualquer streaming por assinatura" |
| `genero` | `null` | ID do gênero, ou `null` para "Todos" |
| `ordenacao` | `"populares"` | `"populares"`, `"avaliados"` ou `"lancamentos"` |
| `busca` | `""` | Texto da busca (já com o atraso de meio segundo aplicado) |
| `filmes` | `[]` | Filmes carregados até agora |
| `pagina` / `totalPaginas` / `totalResultados` | `1` / `0` / `0` | Paginação |
| `filmeAberto` | `null` | ID do filme exibido na janela de detalhes |
| `carregando` / `erro` | `false` / `null` | Estado da última consulta |

### Interface do mensageiro (`src/api/tmdb.js`)

Cada função devolve dados já simplificados para as peças de tela, e lança um erro com tipo identificável (`"chave-invalida"` ou `"rede"`) quando algo falha.

| Função | Endpoint TMDB | Uso |
|---|---|---|
| `listarStreamings()` | `GET /watch/providers/movie?watch_region=BR&language=pt-BR` | Os 8 streamings com menor `display_priorities.BR` (os mais relevantes) |
| `listarGeneros()` | `GET /genre/movie/list?language=pt-BR` | Itens do menu de gênero |
| `descobrirFilmes({streamings, genero, ordenacao, pagina})` | `GET /discover/movie` | Catálogo filtrado |
| `buscarFilmes({texto, pagina})` | `GET /search/movie?query=…&language=pt-BR&include_adult=false` | Busca por nome |
| `detalhesFilme(id)` | `GET /movie/{id}?append_to_response=credits,videos,watch/providers&include_video_language=pt,en` | Janela de detalhes, em uma única consulta |

Parâmetros fixos do `descobrirFilmes`: `watch_region=BR`, `with_watch_monetization_types=flatrate`, `language=pt-BR`, `include_adult=false`.

| Escolha | Parâmetros |
|---|---|
| Streamings marcados | `with_watch_providers=8\|119` (o `\|` significa "ou") |
| Nenhum streaming marcado | sem `with_watch_providers`. O `watch_region` + `flatrate` já limita aos filmes em algum streaming por assinatura |
| Gênero | `with_genres=<id>` |
| Mais populares | `sort_by=popularity.desc` |
| Mais bem avaliados | `sort_by=vote_average.desc&vote_count.gte=200` |
| Lançamentos | `sort_by=primary_release_date.desc&primary_release_date.lte=<hoje>` |

Imagens: pôsteres em `https://image.tmdb.org/t/p/w342{poster_path}`, logos de streaming em `…/w92{logo_path}`, fundo da janela em `…/w780{backdrop_path}`.

## 4. Comportamento

### Catálogo e filtros (barra no topo)

- **Streamings:** 8 botões ("chips") com logo e nome. É possível marcar vários, e o resultado inclui filmes em *qualquer* um dos marcados. Clicar de novo desmarca.
- **Gênero:** menu com "Todos" mais a lista do TMDB. Um gênero por vez.
- **Ordenação:** menu com Mais populares (padrão), Mais bem avaliados e Lançamentos.
- Acima da grade aparece o total, por exemplo "1.248 filmes".
- A lista começa com 20 filmes. **Carregar mais** acrescenta os próximos 20 e some quando `pagina >= totalPaginas`. O TMDB não devolve mais de 500 páginas, então `totalPaginas` é limitado a 500.
- Qualquer mudança de filtro zera a lista, volta para a página 1 e rola a tela até o topo.

### Busca

- A consulta só sai depois de **500 ms sem digitação**.
- Com texto na busca, a barra de filtros fica desativada e apagada, com o aviso "Buscando por '<texto>' (filtros pausados)" e um botão **✕ Limpar busca**. A busca ignora os filtros.
- A busca mostra *qualquer* filme com aquele nome, esteja ou não em streaming. A disponibilidade aparece na janela de detalhes.
- Limpar a busca volta ao catálogo com os filtros que estavam marcados antes.

### Janela de detalhes

- Abre ao clicar num pôster e faz uma única consulta (`detalhesFilme`).
- Mostra: imagem de fundo, pôster, título, nota, ano, duração, gêneros, sinopse, botão **▶ Ver trailer**, "Onde assistir no Brasil" e elenco (os 8 primeiros, com foto e nome).
- **Trailer:** escolhe o primeiro vídeo com `site = "YouTube"` e `type = "Trailer"`, de preferência em português. Ao clicar, toca dentro da janela (iframe do YouTube). Se não houver trailer, o botão não aparece.
- **Onde assistir:** logos de `watch/providers.results.BR.flatrate`, com o crédito "dados: JustWatch". Se a lista estiver vazia ou ausente, aparece "Não disponível em streaming por assinatura no Brasil".
- Fecha pelo ✕, pela tecla Esc ou clicando fora. O catálogo continua exatamente como estava, inclusive na mesma posição de rolagem.
- Filme sem pôster ou ator sem foto recebe uma imagem padrão.

### Créditos

O rodapé mostra o logo do TMDB com o aviso "Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB", além do crédito ao JustWatch pelos dados de disponibilidade, como exigem os termos de uso.

## 5. Carregamento e erros

| Situação | O que o usuário vê |
|---|---|
| Carregando a lista | Retângulos cinza pulsando ("esqueletos") no lugar dos pôsteres |
| Carregando a janela | Indicador de carregamento dentro da janela |
| Chave ausente ou inválida (HTTP 401, ou `VITE_TMDB_TOKEN` vazio) | "Chave do TMDB não encontrada ou inválida. Veja o passo a passo no README." |
| Sem internet / TMDB fora do ar / outro erro HTTP | "Não foi possível falar com o TMDB" + botão **Tentar de novo** |
| Erro no "Carregar mais" | Os filmes já carregados ficam na tela, e a mensagem com "Tentar de novo" aparece perto do botão |
| Erro na janela de detalhes | Mensagem de erro dentro da janela, com "Tentar de novo" |
| Filtros sem resultado | "Nenhum filme encontrado com esses filtros" + botão **Limpar filtros** |
| Busca sem resultado | "Nenhum filme encontrado para '<texto>'" |

**Respostas fora de ordem:** cada consulta de lista recebe um número sequencial, e a resposta só é aplicada se o número ainda for o mais recente. A janela de detalhes faz o mesmo com o ID do filme aberto.

## 6. Visual

Tema escuro (fundo quase preto, destaque amarelo), seguindo os mockups aprovados:

- Cabeçalho com logo à esquerda e campo de busca.
- Barra de filtros horizontal logo abaixo, com chips de streaming, menu de gênero e menu de ordenação.
- Grade de pôsteres que ocupa toda a largura (CSS Grid com `auto-fill`, de cerca de 6 colunas numa tela comum até 2 numa tela estreita), com a nota no canto do pôster e o título embaixo.
- Janela de detalhes centralizada sobre um fundo escurecido.

## 7. Testes

Testes automáticos com Vitest + Testing Library. **Nenhum teste chama o TMDB de verdade:** o `fetch` é simulado com respostas fixas.

**Mensageiro (`tmdb.test.js`)**
- Netflix (8) + Prime (119) + Terror (27) gera `with_watch_providers=8|119`, `with_genres=27`, `watch_region=BR` e `with_watch_monetization_types=flatrate`.
- Sem streamings marcados, não envia `with_watch_providers`.
- "Mais bem avaliados" inclui `vote_count.gte=200`, e "Lançamentos" inclui `primary_release_date.lte` com a data de hoje.
- Envia o cabeçalho `Authorization: Bearer <token>`.
- HTTP 401 vira erro do tipo `"chave-invalida"`, e falha de rede vira `"rede"`.
- `listarStreamings` devolve os 8 primeiros por `display_priorities.BR`.
- `totalPaginas` é limitado a 500.

**Telas**
- Ao abrir, mostra esqueletos e depois os pôsteres.
- Marcar um streaming recomeça a lista da página 1.
- "Carregar mais" acrescenta filmes sem apagar os anteriores e some na última página.
- Digitar na busca desativa os filtros, e limpar restaura os filtros anteriores.
- Uma resposta antiga que chega depois da nova é descartada.
- A janela mostra os logos dos streamings, ou o aviso "Não disponível…" quando não há `flatrate`.
- A janela fecha com Esc, com o ✕ e com clique fora.
- Cada situação de erro da seção 5 mostra a mensagem correspondente.

**Verificação manual:** no fim, rodar `npm run dev` com a chave real e conferir o critério de sucesso (Netflix + Terror → abrir um filme → ver trailer e onde assistir).

## 8. Organização das pastas

```
catalogo-filmes/
├── README.md            — como criar a chave no TMDB, configurar o .env, rodar e testar
├── .env                 — VITE_TMDB_TOKEN=... (fora do Git)
├── .env.example
├── .gitignore           — node_modules, .env, dist
├── package.json
├── vite.config.js       — inclui a configuração do Vitest
├── index.html
├── docs/superpowers/specs/  — este documento
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── App.test.jsx
    ├── styles.css
    ├── api/
    │   ├── tmdb.js
    │   └── tmdb.test.js
    └── componentes/
        ├── Cabecalho.jsx
        ├── BarraFiltros.jsx
        ├── GradeFilmes.jsx
        ├── CartaoFilme.jsx
        ├── JanelaDetalhes.jsx
        ├── JanelaDetalhes.test.jsx
        ├── Mensagem.jsx
        └── Rodape.jsx
```

Os nomes das peças são em português para facilitar o aprendizado. O projeto é um repositório Git próprio.
