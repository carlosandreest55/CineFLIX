import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import {
  listarStreamings, listarGeneros, descobrirFilmes, buscarFilmes, detalhesFilme, ErroTmdb,
} from './api/tmdb'

vi.mock('./api/tmdb', async (original) => ({
  ...(await original()),
  listarStreamings: vi.fn(),
  listarGeneros: vi.fn(),
  descobrirFilmes: vi.fn(),
  buscarFilmes: vi.fn(),
  detalhesFilme: vi.fn(),
}))

const intervalo = (de, ate) => Array.from({ length: ate - de + 1 }, (_, i) => de + i)
const pagina = (n, ids, { totalPaginas = 3, totalResultados = 60 } = {}) => ({
  pagina: n, totalPaginas, totalResultados,
  filmes: ids.map((id) => ({ id, titulo: `Filme ${id}`, poster: null, nota: 7, ano: '2024' })),
})
const cartoes = () => screen.queryAllByRole('button', { name: /Filme \d+/ })
const ultimaChamada = (fn) => fn.mock.calls.at(-1)[0]
const PADRAO = { streamings: [], genero: null, ordenacao: 'populares', pagina: 1 }

afterEach(() => { delete window.matchMedia })

beforeEach(() => {
  vi.resetAllMocks()
  listarStreamings.mockResolvedValue([{ id: 8, nome: 'Netflix', logo: null }, { id: 119, nome: 'Prime Video', logo: null }])
  listarGeneros.mockResolvedValue([{ id: 27, nome: 'Terror' }])
  descobrirFilmes.mockImplementation(async ({ pagina: n }) => pagina(n, intervalo(n * 20 - 19, n * 20)))
})

test('abre mostrando esqueletos e depois os filmes', async () => {
  render(<App />)
  expect(screen.getAllByTestId('esqueleto').length).toBeGreaterThan(0)
  expect(await screen.findByText('60 filmes')).toBeInTheDocument()
  expect(cartoes()).toHaveLength(20)
  expect(descobrirFilmes).toHaveBeenCalledWith(PADRAO)
})

test('mudar um filtro recomeça a lista da página 1 e volta ao topo', async () => {
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Carregar mais' }))
  await waitFor(() => expect(cartoes()).toHaveLength(40))
  expect(ultimaChamada(descobrirFilmes)).toEqual({ ...PADRAO, pagina: 2 })

  descobrirFilmes.mockResolvedValueOnce(pagina(1, intervalo(100, 119)))
  window.scrollTo.mockClear()
  await userEvent.click(screen.getByRole('button', { name: 'Netflix' }))
  expect(ultimaChamada(descobrirFilmes)).toEqual({ ...PADRAO, streamings: [8] })
  await screen.findByRole('button', { name: /Filme 100\b/ })
  expect(cartoes()).toHaveLength(20)
  expect(window.scrollTo).toHaveBeenCalled()
})

test('clicar de novo num streaming desmarca; gênero e ordenação entram no pedido', async () => {
  render(<App />)
  const netflix = await screen.findByRole('button', { name: 'Netflix' })
  await userEvent.click(netflix)
  expect(netflix).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(netflix)
  expect(netflix).toHaveAttribute('aria-pressed', 'false')
  expect(ultimaChamada(descobrirFilmes)).toEqual(PADRAO)

  await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Gênero' }), 'Terror')
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Ordenar por' }), 'Mais bem avaliados')
  expect(ultimaChamada(descobrirFilmes)).toEqual({ ...PADRAO, genero: 27, ordenacao: 'avaliados' })
})

test('"Carregar mais" acrescenta sem repetir filmes', async () => {
  descobrirFilmes
    .mockResolvedValueOnce(pagina(1, intervalo(1, 20)))
    .mockResolvedValueOnce(pagina(2, intervalo(20, 39)))
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Carregar mais' }))
  await screen.findByRole('button', { name: /Filme 39\b/ })
  expect(cartoes()).toHaveLength(39)
})

test('na última página, não há "Carregar mais"', async () => {
  descobrirFilmes.mockResolvedValue(pagina(1, intervalo(1, 5), { totalPaginas: 1, totalResultados: 5 }))
  render(<App />)
  expect(await screen.findByText('5 filmes')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument()
})

test('resposta velha que chega depois da nova é descartada', async () => {
  let resolverVelha
  descobrirFilmes
    .mockImplementationOnce(() => new Promise((resolver) => { resolverVelha = resolver }))
    .mockResolvedValueOnce(pagina(1, intervalo(100, 119)))
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Netflix' }))
  await screen.findByRole('button', { name: /Filme 100\b/ })
  resolverVelha(pagina(1, intervalo(1, 20)))
  await new Promise((r) => setTimeout(r, 0))
  expect(screen.getByRole('button', { name: /Filme 100\b/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Filme 1\b/ })).not.toBeInTheDocument()
})

test('chave inválida mostra a mensagem com o README', async () => {
  descobrirFilmes.mockRejectedValue(new ErroTmdb('chave-invalida'))
  render(<App />)
  expect(await screen.findByText('Chave do TMDB não encontrada ou inválida. Veja o passo a passo no README.'))
    .toBeInTheDocument()
})

test('sem internet: "Tentar de novo" refaz o pedido e recarrega a lista de streamings', async () => {
  descobrirFilmes.mockRejectedValueOnce(new ErroTmdb('rede'))
  listarStreamings.mockRejectedValueOnce(new ErroTmdb('rede'))
  render(<App />)
  expect(await screen.findByText('Não foi possível falar com o TMDB')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
  expect(await screen.findByText('60 filmes')).toBeInTheDocument()
  expect(descobrirFilmes).toHaveBeenCalledTimes(2)
  expect(listarStreamings).toHaveBeenCalledTimes(2)
  expect(await screen.findByRole('button', { name: 'Netflix' })).toBeInTheDocument()
})

test('nenhum resultado com filtros oferece "Limpar filtros"', async () => {
  render(<App />)
  await screen.findByText('60 filmes')
  descobrirFilmes.mockResolvedValueOnce(pagina(1, [], { totalPaginas: 0, totalResultados: 0 }))
  await userEvent.click(screen.getByRole('button', { name: 'Netflix' }))
  expect(await screen.findByText('Nenhum filme encontrado com esses filtros')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
  expect(ultimaChamada(descobrirFilmes)).toEqual(PADRAO)
  expect(await screen.findByText('60 filmes')).toBeInTheDocument()
})

describe('busca', () => {
  test('busca por nome uma vez só, pausa os filtros e pagina pela busca', async () => {
    buscarFilmes.mockImplementation(async ({ pagina: n }) =>
      pagina(n, intervalo(500 + n * 20, 519 + n * 20), { totalPaginas: 2, totalResultados: 40 }))
    render(<App />)
    await screen.findByText('60 filmes')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar filme' }), 'batman')
    expect(await screen.findByText("Buscando por 'batman' (filtros pausados)")).toBeInTheDocument()
    expect(await screen.findByText('40 filmes')).toBeInTheDocument()
    expect(buscarFilmes).toHaveBeenCalledTimes(1)
    expect(buscarFilmes).toHaveBeenCalledWith({ texto: 'batman', pagina: 1 })
    expect(screen.getByRole('button', { name: 'Netflix' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))
    expect(ultimaChamada(buscarFilmes)).toEqual({ texto: 'batman', pagina: 2 })
    await waitFor(() => expect(cartoes()).toHaveLength(40))
  })

  test('limpar a busca volta ao catálogo com os filtros de antes', async () => {
    buscarFilmes.mockResolvedValue(pagina(1, intervalo(500, 505), { totalPaginas: 1, totalResultados: 6 }))
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Netflix' }))
    const campo = screen.getByRole('searchbox', { name: 'Buscar filme' })
    await userEvent.type(campo, 'batman')
    expect(await screen.findByText('6 filmes')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '✕ Limpar busca' }))
    expect(campo).toHaveValue('')
    expect(screen.queryByText(/filtros pausados/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Netflix' })).toHaveAttribute('aria-pressed', 'true')
    expect(ultimaChamada(descobrirFilmes)).toEqual({ ...PADRAO, streamings: [8] })
    expect(await screen.findByText('60 filmes')).toBeInTheDocument()
  })

  test('busca só com espaços é ignorada', async () => {
    render(<App />)
    await screen.findByText('60 filmes')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar filme' }), '   ')
    await new Promise((r) => setTimeout(r, 600))
    expect(buscarFilmes).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Netflix' })).toBeEnabled()
  })

  test('busca sem resultado avisa com o texto buscado', async () => {
    buscarFilmes.mockResolvedValue(pagina(1, [], { totalPaginas: 0, totalResultados: 0 }))
    render(<App />)
    await screen.findByText('60 filmes')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar filme' }), 'xyzxyz')
    expect(await screen.findByText("Nenhum filme encontrado para 'xyzxyz'")).toBeInTheDocument()
  })
})

test('abrir e fechar os detalhes mantém a lista como estava', async () => {
  detalhesFilme.mockResolvedValue({
    id: 1, titulo: 'Filme 1', poster: null, fundo: null, nota: 7, ano: '2024', duracao: 100, generos: [],
    diretores: [], sinopse: 'Sinopse.', trailer: null, streamings: [], elenco: [],
  })
  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Filme 1\b/ }))
  expect(await screen.findByRole('dialog', { name: 'Filme 1' })).toBeInTheDocument()
  expect(detalhesFilme).toHaveBeenCalledWith(1)

  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(cartoes()).toHaveLength(20)
  expect(descobrirFilmes).toHaveBeenCalledTimes(1)
})

describe('destaque', () => {
  const comFundo = (filmes) => filmes.map((f) => (f.id === 2 ? { ...f, fundo: 'https://img/f2.jpg', sinopse: 'Sinopse 2.' } : f))

  test('mostra o primeiro filme com cena e explica por que ele está ali', async () => {
    descobrirFilmes.mockImplementation(async ({ pagina: n }) => {
      const p = pagina(n, intervalo(n * 20 - 19, n * 20))
      return { ...p, filmes: comFundo(p.filmes) }
    })
    detalhesFilme.mockResolvedValue({
      id: 2, titulo: 'Filme 2', poster: null, fundo: null, nota: 7, ano: '2024', duracao: 100, generos: [],
      diretores: [], sinopse: 'Sinopse 2.', trailer: null, streamings: [], elenco: [],
    })
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Filme 2' })).toBeInTheDocument()
    expect(screen.getByText('Mais popular nos streamings do Brasil')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }))
    expect(await screen.findByRole('dialog', { name: 'Filme 2' })).toBeInTheDocument()
  })

  test('a frase acompanha os filtros escolhidos', async () => {
    descobrirFilmes.mockImplementation(async ({ pagina: n }) => {
      const p = pagina(n, intervalo(n * 20 - 19, n * 20))
      return { ...p, filmes: comFundo(p.filmes) }
    })
    render(<App />)
    await screen.findByRole('heading', { name: 'Filme 2' })
    await userEvent.click(screen.getByRole('button', { name: 'Netflix' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Gênero' }), 'Terror')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Ordenar por' }), 'Mais bem avaliados')
    expect(await screen.findByText('Mais bem avaliado em terror nos streamings que você escolheu')).toBeInTheDocument()
  })

  test('sem cena na lista ou durante uma busca, não há destaque', async () => {
    descobrirFilmes.mockImplementation(async ({ pagina: n }) => {
      const p = pagina(n, intervalo(n * 20 - 19, n * 20))
      return { ...p, filmes: comFundo(p.filmes) }
    })
    buscarFilmes.mockResolvedValue(pagina(1, intervalo(500, 505), { totalPaginas: 1, totalResultados: 6 }))
    render(<App />)
    await screen.findByRole('heading', { name: 'Filme 2' })
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar filme' }), 'batman')
    await screen.findByText('6 filmes')
    expect(screen.queryByRole('button', { name: 'Ver detalhes' })).not.toBeInTheDocument()
  })
})

test('a prévia abre a janela completa sem pedir o filme de novo ao TMDB', async () => {
  window.matchMedia = vi.fn((consulta) => ({ media: consulta, matches: consulta.includes('hover') }))
  detalhesFilme.mockResolvedValue({
    id: 1, titulo: 'Filme 1', poster: null, fundo: null, nota: 7, ano: '2024', duracao: 100, generos: [],
    diretores: [], sinopse: 'Sinopse.', trailer: null, streamings: [], elenco: [],
  })
  render(<App />)
  await userEvent.hover(await screen.findByRole('button', { name: /Filme 1\b/ }))
  const previa = await screen.findByRole('group', { name: 'Prévia de Filme 1' })
  await within(previa).findByText('1h 40min')

  await userEvent.click(within(previa).getByRole('button', { name: 'Ver detalhes' }))
  expect(await screen.findByRole('dialog', { name: 'Filme 1' })).toBeInTheDocument()
  expect(detalhesFilme).toHaveBeenCalledTimes(1)
})
