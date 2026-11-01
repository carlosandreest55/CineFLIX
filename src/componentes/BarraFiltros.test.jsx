import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BarraFiltros from './BarraFiltros'

function renderizar(props = {}) {
  const callbacks = {
    onAlternarStreaming: vi.fn(),
    onGenero: vi.fn(),
    onOrdenacao: vi.fn(),
    onLimparBusca: vi.fn(),
  }
  render(
    <BarraFiltros
      streamings={[{ id: 8, nome: 'Netflix', logo: null }, { id: 119, nome: 'Prime Video', logo: null }]}
      generos={[{ id: 27, nome: 'Terror' }]}
      selecionados={[8]}
      genero={null}
      ordenacao="populares"
      busca=""
      {...callbacks}
      {...props}
    />,
  )
  return callbacks
}

test('marca os streamings selecionados', () => {
  renderizar()
  expect(screen.getByRole('button', { name: 'Netflix' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Prime Video' })).toHaveAttribute('aria-pressed', 'false')
})

test('clicar num streaming chama onAlternarStreaming com o id', async () => {
  const { onAlternarStreaming } = renderizar()
  await userEvent.click(screen.getByRole('button', { name: 'Prime Video' }))
  expect(onAlternarStreaming).toHaveBeenCalledWith(119)
})

test('menu de gênero tem "Todos" e os gêneros do TMDB', async () => {
  const { onGenero } = renderizar()
  const menu = screen.getByRole('combobox', { name: 'Gênero' })
  expect(screen.getByRole('option', { name: 'Todos' })).toBeInTheDocument()
  await userEvent.selectOptions(menu, 'Terror')
  expect(onGenero).toHaveBeenLastCalledWith(27)
})

test('voltar o gênero para "Todos" envia null', async () => {
  const { onGenero } = renderizar({ genero: 27 })
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Gênero' }), 'Todos')
  expect(onGenero).toHaveBeenLastCalledWith(null)
})

test('menu de ordenação tem as três opções', async () => {
  const { onOrdenacao } = renderizar()
  const menu = screen.getByRole('combobox', { name: 'Ordenar por' })
  for (const nome of ['Mais populares', 'Mais bem avaliados', 'Lançamentos']) {
    expect(screen.getByRole('option', { name: nome })).toBeInTheDocument()
  }
  await userEvent.selectOptions(menu, 'Lançamentos')
  expect(onOrdenacao).toHaveBeenCalledWith('lancamentos')
})

test('com busca ativa, os filtros ficam pausados', async () => {
  const { onLimparBusca } = renderizar({ busca: 'batman' })
  expect(screen.getByText("Buscando por 'batman' (filtros pausados)")).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Netflix' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Prime Video' })).toBeDisabled()
  expect(screen.getByRole('combobox', { name: 'Gênero' })).toBeDisabled()
  expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: '✕ Limpar busca' }))
  expect(onLimparBusca).toHaveBeenCalled()
})
