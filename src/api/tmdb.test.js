import { requisitar, ErroTmdb } from './tmdb'

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
