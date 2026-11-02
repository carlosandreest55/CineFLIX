import {
  requisitar, ErroTmdb, descobrirFilmes, buscarFilmes, listarStreamings, listarGeneros, detalhesFilme,
} from './tmdb'

const respostaJson = (dados, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => dados,
})

beforeEach(() => {
  vi.stubEnv('VITE_TMDB_TOKEN', 'token-teste')
  globalThis.fetch = vi.fn()
})
afterEach(() => vi.unstubAllEnvs())

describe('requisitar', () => {
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
})

const paginaVazia = { page: 1, total_pages: 1, total_results: 0, results: [] }
const chamada = () => {
  const url = new URL(fetch.mock.calls[0][0])
  return { caminho: url.pathname.replace('/3', ''), p: url.searchParams }
}

describe('descobrirFilmes', () => {
  test('Netflix + Prime + Terror monta os parâmetros certos', async () => {
    fetch.mockResolvedValue(respostaJson(paginaVazia))
    await descobrirFilmes({ streamings: [8, 119], genero: 27, ordenacao: 'populares', pagina: 2 })
    const { caminho, p } = chamada()
    expect(caminho).toBe('/discover/movie')
    expect(p.get('with_watch_providers')).toBe('8|119')
    expect(p.get('with_genres')).toBe('27')
    expect(p.get('watch_region')).toBe('BR')
    expect(p.get('with_watch_monetization_types')).toBe('flatrate')
    expect(p.get('language')).toBe('pt-BR')
    expect(p.get('include_adult')).toBe('false')
    expect(p.get('sort_by')).toBe('popularity.desc')
    expect(p.get('page')).toBe('2')
  })

  test('sem streamings nem gênero, não envia esses filtros', async () => {
    fetch.mockResolvedValue(respostaJson(paginaVazia))
    await descobrirFilmes({ streamings: [], genero: null, ordenacao: 'populares', pagina: 1 })
    const { p } = chamada()
    expect(p.has('with_watch_providers')).toBe(false)
    expect(p.has('with_genres')).toBe(false)
  })

  test('mais bem avaliados exige pelo menos 200 votos', async () => {
    fetch.mockResolvedValue(respostaJson(paginaVazia))
    await descobrirFilmes({ streamings: [], genero: null, ordenacao: 'avaliados', pagina: 1 })
    const { p } = chamada()
    expect(p.get('sort_by')).toBe('vote_average.desc')
    expect(p.get('vote_count.gte')).toBe('200')
  })

  test('lançamentos só até hoje (data local)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 1, 23, 30))
    fetch.mockResolvedValue(respostaJson(paginaVazia))
    await descobrirFilmes({ streamings: [], genero: null, ordenacao: 'lancamentos', pagina: 1 })
    vi.useRealTimers()
    const { p } = chamada()
    expect(p.get('sort_by')).toBe('primary_release_date.desc')
    expect(p.get('primary_release_date.lte')).toBe('2026-11-01')
  })

  test('simplifica os filmes e limita a 500 páginas', async () => {
    fetch.mockResolvedValue(respostaJson({
      page: 1, total_pages: 900, total_results: 18000,
      results: [
        { id: 1, title: 'A', poster_path: '/a.jpg', backdrop_path: '/fa.jpg', overview: 'Sinopse A.', vote_average: 7.456, vote_count: 10, release_date: '2024-05-01' },
        { id: 2, title: 'B', poster_path: null, vote_average: 0, vote_count: 0, release_date: '' },
      ],
    }))
    expect(await descobrirFilmes({ streamings: [], genero: null, ordenacao: 'populares', pagina: 1 })).toEqual({
      pagina: 1, totalPaginas: 500, totalResultados: 18000,
      filmes: [
        {
          id: 1, titulo: 'A', poster: 'https://image.tmdb.org/t/p/w342/a.jpg',
          fundo: 'https://image.tmdb.org/t/p/w1280/fa.jpg', sinopse: 'Sinopse A.', nota: 7.5, ano: '2024',
        },
        { id: 2, titulo: 'B', poster: null, fundo: null, sinopse: '', nota: null, ano: null },
      ],
    })
  })
})

describe('buscarFilmes', () => {
  test('envia o texto intacto, mesmo com caracteres especiais', async () => {
    fetch.mockResolvedValue(respostaJson(paginaVazia))
    await buscarFilmes({ texto: 'amor & ódio?', pagina: 1 })
    const { caminho, p } = chamada()
    expect(caminho).toBe('/search/movie')
    expect(p.get('query')).toBe('amor & ódio?')
    expect(p.get('language')).toBe('pt-BR')
    expect(p.get('include_adult')).toBe('false')
  })
})

describe('listarStreamings', () => {
  const prov = (id, prioridadeBR) => ({
    provider_id: id, provider_name: `P${id}`, logo_path: `/${id}.png`,
    display_priority: 99, display_priorities: prioridadeBR === undefined ? {} : { BR: prioridadeBR },
  })

  test('devolve os 8 mais relevantes no Brasil, sem lojas de aluguel/compra', async () => {
    fetch.mockResolvedValue(respostaJson({
      results: [prov(2, 0), prov(3, 1), prov(8, 2), prov(119, 3), prov(337, 4), prov(307, 5),
        prov(1899, 6), prov(531, 7), prov(350, 8), prov(283, 9), prov(500)],
    }))
    const lista = await listarStreamings()
    const { caminho, p } = chamada()
    expect(caminho).toBe('/watch/providers/movie')
    expect(p.get('watch_region')).toBe('BR')
    expect(lista.map((s) => s.id)).toEqual([8, 119, 337, 307, 1899, 531, 350, 283])
    expect(lista[0]).toEqual({ id: 8, nome: 'P8', logo: 'https://image.tmdb.org/t/p/w92/8.png' })
  })

  test('sem prioridade do Brasil, usa a prioridade geral', async () => {
    fetch.mockResolvedValue(respostaJson({
      results: [{ ...prov(8, 9), display_priority: 5 }, { ...prov(9), display_priority: 1 }],
    }))
    expect((await listarStreamings()).map((s) => s.id)).toEqual([9, 8])
  })
})

describe('listarGeneros', () => {
  test('traduz o formato do TMDB', async () => {
    fetch.mockResolvedValue(respostaJson({ genres: [{ id: 27, name: 'Terror' }] }))
    expect(await listarGeneros()).toEqual([{ id: 27, nome: 'Terror' }])
    expect(chamada().p.get('language')).toBe('pt-BR')
  })
})

describe('detalhesFilme', () => {
  const pessoa = (i) => ({ id: i, name: `Ator ${i}`, character: `Papel ${i}`, profile_path: i === 1 ? '/p1.jpg' : null })
  const resposta = {
    id: 42, title: 'Filme A', poster_path: '/a.jpg', backdrop_path: '/f.jpg', vote_average: 7.4, vote_count: 900,
    release_date: '2024-03-10', runtime: 112, genres: [{ id: 27, name: 'Terror' }], overview: 'Sinopse.',
    credits: {
      cast: Array.from({ length: 10 }, (_, i) => pessoa(i + 1)),
      crew: [{ job: 'Director', name: 'Ana Lima' }, { job: 'Writer', name: 'Zé' }, { job: 'Director', name: 'Rui Costa' }],
    },
    videos: { results: [
      { site: 'YouTube', type: 'Teaser', key: 't1', iso_639_1: 'pt' },
      { site: 'YouTube', type: 'Trailer', key: 'en1', iso_639_1: 'en' },
      { site: 'YouTube', type: 'Trailer', key: 'pt1', iso_639_1: 'pt' },
    ] },
    'watch/providers': { results: { BR: { flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png' }] } } },
  }

  test('pede tudo numa consulta e simplifica a resposta', async () => {
    fetch.mockResolvedValue(respostaJson(resposta))
    const d = await detalhesFilme(42)
    const { caminho, p } = chamada()
    expect(caminho).toBe('/movie/42')
    expect(p.get('append_to_response')).toBe('credits,videos,watch/providers')
    expect(p.get('include_video_language')).toBe('pt,en')
    expect(p.get('language')).toBe('pt-BR')
    expect(d).toMatchObject({
      id: 42, titulo: 'Filme A', poster: 'https://image.tmdb.org/t/p/w342/a.jpg',
      fundo: 'https://image.tmdb.org/t/p/w1280/f.jpg', nota: 7.4, ano: '2024', duracao: 112,
      generos: ['Terror'], diretores: ['Ana Lima', 'Rui Costa'], sinopse: 'Sinopse.', trailer: 'pt1',
      streamings: [{ id: 8, nome: 'Netflix', logo: 'https://image.tmdb.org/t/p/w92/n.png' }],
    })
    expect(d.elenco).toHaveLength(8)
    expect(d.elenco[0]).toEqual({ id: 1, nome: 'Ator 1', personagem: 'Papel 1', foto: 'https://image.tmdb.org/t/p/w185/p1.jpg' })
    expect(d.elenco[1].foto).toBeNull()
  })

  test('sem streaming no Brasil e sem trailer', async () => {
    fetch.mockResolvedValue(respostaJson({ ...resposta, videos: { results: [] }, 'watch/providers': { results: {} } }))
    const d = await detalhesFilme(42)
    expect(d.streamings).toEqual([])
    expect(d.trailer).toBeNull()
  })

  test('sem trailer em português, usa o de outro idioma', async () => {
    fetch.mockResolvedValue(respostaJson({ ...resposta, videos: { results: [resposta.videos.results[1]] } }))
    expect((await detalhesFilme(42)).trailer).toBe('en1')
  })
})
