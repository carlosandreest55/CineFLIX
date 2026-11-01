import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import JanelaDetalhes from './JanelaDetalhes'
import { detalhesFilme, ErroTmdb } from '../api/tmdb'

vi.mock('../api/tmdb', async (original) => ({ ...(await original()), detalhesFilme: vi.fn() }))

const detalhes = {
  id: 1, titulo: 'Filme A', poster: 'https://image.tmdb.org/t/p/w342/a.jpg', fundo: null,
  nota: 7.4, ano: '2024', duracao: 112, generos: ['Terror', 'Suspense'],
  diretores: ['Ana Lima', 'Rui Costa'], sinopse: 'Uma história assustadora.', trailer: 'pt1',
  streamings: [{ id: 8, nome: 'Netflix', logo: 'https://image.tmdb.org/t/p/w92/n.png' }],
  elenco: Array.from({ length: 8 }, (_, i) => ({ id: i, nome: `Pessoa ${i + 1}`, personagem: 'Papel', foto: null })),
}

beforeEach(() => detalhesFilme.mockReset())

test('mostra carregando e depois os detalhes', async () => {
  detalhesFilme.mockResolvedValue(detalhes)
  render(<JanelaDetalhes filmeId={1} onFechar={vi.fn()} />)
  expect(screen.getByText('Carregando...')).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: 'Filme A' })).toBeInTheDocument()
  expect(detalhesFilme).toHaveBeenCalledWith(1)
  const janela = screen.getByRole('dialog', { name: 'Filme A' })
  for (const texto of ['★ 7.4', '2024', '1h 52min', 'Terror, Suspense', 'Direção: Ana Lima, Rui Costa',
    'Uma história assustadora.', 'dados: JustWatch']) {
    expect(janela).toHaveTextContent(texto)
  }
  expect(screen.getByRole('img', { name: 'Netflix' })).toBeInTheDocument()
  for (let i = 1; i <= 8; i++) expect(screen.getByText(`Pessoa ${i}`)).toBeInTheDocument()
})

test('sem diretor, a linha de direção não aparece', async () => {
  detalhesFilme.mockResolvedValue({ ...detalhes, diretores: [] })
  render(<JanelaDetalhes filmeId={1} onFechar={vi.fn()} />)
  await screen.findByRole('heading', { name: 'Filme A' })
  expect(screen.queryByText(/Direção:/)).not.toBeInTheDocument()
})

test('sem streaming, avisa que não está disponível', async () => {
  detalhesFilme.mockResolvedValue({ ...detalhes, streamings: [] })
  render(<JanelaDetalhes filmeId={1} onFechar={vi.fn()} />)
  expect(await screen.findByText('Não disponível em streaming por assinatura no Brasil')).toBeInTheDocument()
})

test('duração abaixo de 1 hora', async () => {
  detalhesFilme.mockResolvedValue({ ...detalhes, duracao: 45 })
  render(<JanelaDetalhes filmeId={1} onFechar={vi.fn()} />)
  expect(await screen.findByRole('dialog', { name: 'Filme A' })).toHaveTextContent('45min')
  expect(screen.getByRole('dialog')).not.toHaveTextContent('0h')
})

test('botão de trailer toca o vídeo do YouTube dentro da janela', async () => {
  detalhesFilme.mockResolvedValue(detalhes)
  render(<JanelaDetalhes filmeId={1} onFechar={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: '▶ Ver trailer' }))
  expect(screen.getByTitle('Trailer')).toHaveAttribute('src', 'https://www.youtube.com/embed/pt1?autoplay=1')
})

test('sem trailer, não há botão', async () => {
  detalhesFilme.mockResolvedValue({ ...detalhes, trailer: null })
  render(<JanelaDetalhes filmeId={1} onFechar={vi.fn()} />)
  await screen.findByRole('heading', { name: 'Filme A' })
  expect(screen.queryByRole('button', { name: '▶ Ver trailer' })).not.toBeInTheDocument()
})

test('fecha pelo ✕, pela tecla Esc e pelo clique fora — mas não por clique dentro', async () => {
  detalhesFilme.mockResolvedValue(detalhes)
  const onFechar = vi.fn()
  render(<JanelaDetalhes filmeId={1} onFechar={onFechar} />)
  await screen.findByRole('heading', { name: 'Filme A' })

  await userEvent.click(screen.getByRole('dialog'))
  expect(onFechar).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
  expect(onFechar).toHaveBeenCalledTimes(1)

  await userEvent.keyboard('{Escape}')
  expect(onFechar).toHaveBeenCalledTimes(2)

  await userEvent.click(screen.getByTestId('fundo-janela'))
  expect(onFechar).toHaveBeenCalledTimes(3)
})

test('trava a rolagem do catálogo enquanto a janela está aberta', async () => {
  detalhesFilme.mockResolvedValue(detalhes)
  const { unmount } = render(<JanelaDetalhes filmeId={1} onFechar={vi.fn()} />)
  await screen.findByRole('heading', { name: 'Filme A' })
  expect(document.body.style.overflow).toBe('hidden')
  unmount()
  expect(document.body.style.overflow).toBe('')
})

test('erro com "Tentar de novo"', async () => {
  detalhesFilme.mockRejectedValueOnce(new ErroTmdb('rede')).mockResolvedValueOnce(detalhes)
  render(<JanelaDetalhes filmeId={1} onFechar={vi.fn()} />)
  expect(await screen.findByText('Não foi possível falar com o TMDB')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
  expect(await screen.findByRole('heading', { name: 'Filme A' })).toBeInTheDocument()
  expect(detalhesFilme).toHaveBeenCalledTimes(2)
})

test('resposta velha de outro filme é descartada', async () => {
  let resolverVelha
  detalhesFilme
    .mockImplementationOnce(() => new Promise((resolver) => { resolverVelha = resolver }))
    .mockResolvedValueOnce({ ...detalhes, id: 2, titulo: 'Filme B' })
  const { rerender } = render(<JanelaDetalhes filmeId={1} onFechar={vi.fn()} />)
  rerender(<JanelaDetalhes filmeId={2} onFechar={vi.fn()} />)
  expect(await screen.findByRole('heading', { name: 'Filme B' })).toBeInTheDocument()
  resolverVelha(detalhes)
  await new Promise((r) => setTimeout(r, 0))
  expect(screen.getByRole('heading', { name: 'Filme B' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Filme A' })).not.toBeInTheDocument()
})
