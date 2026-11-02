// O "mensageiro": o único arquivo do app que conversa com a API do TMDB.

const URL_BASE = 'https://api.themoviedb.org/3'
const URL_IMAGEM = 'https://image.tmdb.org/t/p'
const LIMITE_PAGINAS = 500 // o TMDB não entrega páginas além da 500

// Parâmetros que vão em todo pedido de filmes: Brasil, português, sem conteúdo adulto.
const PADRAO = { language: 'pt-BR', include_adult: false }

// Lojas de aluguel/compra que aparecem na lista de provedores mas não têm filmes por assinatura:
// Apple TV (loja), Google Play Filmes, Amazon Video, Microsoft Store, YouTube.
const LOJAS_SEM_ASSINATURA = [2, 3, 10, 68, 192]
const QUANTIDADE_STREAMINGS = 8

// Erro com um "tipo" que as telas usam para escolher a mensagem certa.
export class ErroTmdb extends Error {
  constructor(tipo) {
    super(`Erro ao falar com o TMDB: ${tipo}`)
    this.name = 'ErroTmdb'
    this.tipo = tipo // 'chave-invalida' | 'rede'
  }
}

// Faz um pedido ao TMDB e devolve a resposta já convertida de JSON.
export async function requisitar(caminho, params = {}) {
  // Lido a cada chamada (e não uma vez só) para os testes poderem trocar o valor.
  const token = import.meta.env.VITE_TMDB_TOKEN
  if (!token) throw new ErroTmdb('chave-invalida')

  const busca = new URLSearchParams()
  for (const [nome, valor] of Object.entries(params)) {
    if (valor !== null && valor !== undefined && valor !== '') busca.append(nome, valor)
  }
  const consulta = busca.toString()
  const url = `${URL_BASE}${caminho}${consulta ? `?${consulta}` : ''}`

  let resposta
  try {
    resposta = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    })
  } catch {
    throw new ErroTmdb('rede')
  }

  if (resposta.status === 401) throw new ErroTmdb('chave-invalida')
  if (!resposta.ok) throw new ErroTmdb('rede')
  return resposta.json()
}

// ---------- Ajudantes: transformam as respostas do TMDB no formato que as telas usam ----------

const imagem = (tamanho, caminho) => (caminho ? `${URL_IMAGEM}/${tamanho}${caminho}` : null)

function hojeLocal() {
  const d = new Date()
  const doisDigitos = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`
}

function simplificarFilme(r) {
  return {
    id: r.id,
    titulo: r.title,
    poster: imagem('w342', r.poster_path),
    fundo: imagem('w1280', r.backdrop_path), // cena larga do filme, usada no destaque e na janela
    sinopse: r.overview || '',
    nota: r.vote_count > 0 ? Math.round(r.vote_average * 10) / 10 : null,
    ano: r.release_date ? r.release_date.slice(0, 4) : null,
  }
}

function simplificarPagina(r) {
  return {
    filmes: r.results.map(simplificarFilme),
    pagina: r.page,
    totalPaginas: Math.min(r.total_pages, LIMITE_PAGINAS),
    totalResultados: r.total_results,
  }
}

function simplificarStreaming(p) {
  return { id: p.provider_id, nome: p.provider_name, logo: imagem('w92', p.logo_path) }
}

function escolherTrailer(videos) {
  const trailers = videos.filter((v) => v.site === 'YouTube' && v.type === 'Trailer')
  const escolhido = trailers.find((v) => v.iso_639_1 === 'pt') ?? trailers[0]
  return escolhido ? escolhido.key : null
}

const ORDENACOES = {
  populares: () => ({ sort_by: 'popularity.desc' }),
  // Sem o mínimo de votos, um filme desconhecido com 1 voto nota 10 ficaria em primeiro.
  avaliados: () => ({ sort_by: 'vote_average.desc', 'vote_count.gte': 200 }),
  lancamentos: () => ({ sort_by: 'primary_release_date.desc', 'primary_release_date.lte': hojeLocal() }),
}

// ---------- Funções usadas pelas telas ----------

export async function listarStreamings() {
  const r = await requisitar('/watch/providers/movie', { watch_region: 'BR', language: 'pt-BR' })
  const prioridade = (p) => p.display_priorities?.BR ?? p.display_priority
  return r.results
    .filter((p) => !LOJAS_SEM_ASSINATURA.includes(p.provider_id))
    .sort((a, b) => prioridade(a) - prioridade(b))
    .slice(0, QUANTIDADE_STREAMINGS)
    .map(simplificarStreaming)
}

export async function listarGeneros() {
  const r = await requisitar('/genre/movie/list', { language: 'pt-BR' })
  return r.genres.map((g) => ({ id: g.id, nome: g.name }))
}

export async function descobrirFilmes({ streamings, genero, ordenacao, pagina }) {
  const r = await requisitar('/discover/movie', {
    ...PADRAO,
    watch_region: 'BR',
    with_watch_monetization_types: 'flatrate',
    with_watch_providers: streamings.length > 0 ? streamings.join('|') : null, // "|" = "ou"
    with_genres: genero,
    ...ORDENACOES[ordenacao](),
    page: pagina,
  })
  return simplificarPagina(r)
}

export async function buscarFilmes({ texto, pagina }) {
  const r = await requisitar('/search/movie', { ...PADRAO, query: texto, page: pagina })
  return simplificarPagina(r)
}

export async function detalhesFilme(id) {
  const r = await requisitar(`/movie/${id}`, {
    language: 'pt-BR',
    append_to_response: 'credits,videos,watch/providers',
    include_video_language: 'pt,en',
  })
  return {
    ...simplificarFilme(r),
    duracao: r.runtime || null,
    generos: r.genres.map((g) => g.name),
    diretores: r.credits.crew.filter((p) => p.job === 'Director').map((p) => p.name),
    sinopse: r.overview,
    trailer: escolherTrailer(r.videos.results),
    streamings: (r['watch/providers'].results.BR?.flatrate ?? []).map(simplificarStreaming),
    elenco: r.credits.cast.slice(0, 8).map((p) => ({
      id: p.id, nome: p.name, personagem: p.character, foto: imagem('w185', p.profile_path),
    })),
  }
}
