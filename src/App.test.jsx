import { render, screen, waitFor } from '@testing-library/react'
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
