import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GradeFilmes from './GradeFilmes'

const filmeA = { id: 1, titulo: 'Filme A', poster: 'https://image.tmdb.org/t/p/w342/a.jpg', nota: 7.5, ano: '2024' }
const filmeB = { id: 2, titulo: 'Filme B', poster: null, nota: null, ano: null }

function renderizar(props = {}) {
  const callbacks = { onCarregarMais: vi.fn(), onAbrir: vi.fn(), onTentarDeNovo: vi.fn() }
  const { container } = render(
    <GradeFilmes
      filmes={[filmeA, filmeB]}
      totalResultados={1248}
      carregando={false}
      temMais={false}
      erroMais={false}
      {...callbacks}
      {...props}
    />,
  )
  return { ...callbacks, container }
}

test('mostra esqueletos ao carregar a primeira página', () => {
  renderizar({ filmes: [], carregando: true })
  expect(screen.getAllByTestId('esqueleto')).toHaveLength(12)
  expect(screen.queryByText(/filmes?$/)).not.toBeInTheDocument()
})

test('mostra o contador e um cartão por filme', async () => {
  const { onAbrir } = renderizar()
  expect(screen.getByText('1.248 filmes')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /Filme/ })).toHaveLength(2)
  await userEvent.click(screen.getByRole('button', { name: /Filme A/ }))
  expect(onAbrir).toHaveBeenCalledWith(1)
})

test('contador no singular', () => {
  renderizar({ filmes: [filmeA], totalResultados: 1 })
  expect(screen.getByText('1 filme')).toBeInTheDocument()
})

test('filme sem nota, ano e pôster não mostra lixo', () => {
  const { container } = renderizar({ filmes: [filmeB], totalResultados: 1 })
  const cartao = screen.getByRole('button', { name: /Filme B/ })
  expect(cartao).toHaveTextContent('★ –')
  expect(cartao).not.toHaveTextContent(/NaN|null|undefined/)
  expect(container.querySelector('.sem-imagem')).toBeInTheDocument()
})

test('cartão mostra nota e ano quando existem', () => {
  renderizar()
  const cartao = screen.getByRole('button', { name: /Filme A/ })
  expect(cartao).toHaveTextContent('★ 7.5')
  expect(cartao).toHaveTextContent('2024')
})

test('cada cartão tem um nome legível para leitores de tela', () => {
  renderizar()
  expect(screen.getByRole('button', { name: 'Filme A, 2024, nota 7.5' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Filme B, sem nota' })).toBeInTheDocument()
})

test('"Carregar mais" chama onCarregarMais', async () => {
  const { onCarregarMais } = renderizar({ temMais: true })
  await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))
  expect(onCarregarMais).toHaveBeenCalled()
})

test('sem mais páginas, não há botão "Carregar mais"', () => {
  renderizar({ temMais: false })
  expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument()
})

test('enquanto carrega mais, o botão fica desativado (sem clique duplo)', () => {
  renderizar({ temMais: true, carregando: true })
  expect(screen.getByRole('button', { name: 'Carregando...' })).toBeDisabled()
  expect(screen.queryAllByTestId('esqueleto')).toHaveLength(0)
})

test('erro no "Carregar mais" mantém os filmes e oferece tentar de novo', async () => {
  const { onTentarDeNovo } = renderizar({ temMais: true, erroMais: true })
  expect(screen.getAllByRole('button', { name: /Filme/ })).toHaveLength(2)
  expect(screen.getByText('Não foi possível falar com o TMDB')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
  expect(onTentarDeNovo).toHaveBeenCalled()
})
