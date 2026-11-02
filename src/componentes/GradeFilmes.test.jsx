import { render, screen, within } from '@testing-library/react'
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

describe('prévia ao passar o mouse', () => {
  const detalhesA = {
    ...filmeA, fundo: 'https://image.tmdb.org/t/p/w1280/fa.jpg', duracao: 112, generos: ['Terror', 'Suspense'],
    diretores: [], sinopse: 'Sinopse A.', trailer: 'tr1', elenco: [],
    streamings: [{ id: 8, nome: 'Netflix', logo: 'https://image.tmdb.org/t/p/w92/n.png' }],
  }
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

  // O jsdom não tem matchMedia: cada teste diz que tipo de tela está simulando.
  function simularTela({ mouse = true, menosMovimento = false } = {}) {
    window.matchMedia = vi.fn((consulta) => ({
      media: consulta,
      matches: consulta.includes('hover') ? mouse : consulta.includes('reduced-motion') ? menosMovimento : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  }

  async function abrirPrevia(detalhes = detalhesA) {
    const buscarDetalhes = vi.fn().mockImplementation(async () => {
      if (detalhes instanceof Error) throw detalhes
      return detalhes
    })
    const callbacks = renderizar({ buscarDetalhes })
    await userEvent.hover(screen.getByRole('button', { name: /Filme A/ }))
    const previa = await screen.findByRole('group', { name: 'Prévia de Filme A' })
    return { previa, buscarDetalhes, ...callbacks }
  }

  beforeEach(() => simularTela())
  afterEach(() => { delete window.matchMedia })

  test('parar o mouse num pôster abre a prévia depois de um instante', async () => {
    const buscarDetalhes = vi.fn().mockResolvedValue(detalhesA)
    renderizar({ buscarDetalhes })
    await userEvent.hover(screen.getByRole('button', { name: /Filme A/ }))
    expect(screen.queryByRole('group', { name: 'Prévia de Filme A' })).not.toBeInTheDocument()

    const previa = await screen.findByRole('group', { name: 'Prévia de Filme A' })
    expect(buscarDetalhes).toHaveBeenCalledWith(1)
    expect(await within(previa).findByText('1h 52min')).toBeInTheDocument()
    expect(previa).toHaveTextContent('Terror, Suspense')
    expect(previa).toHaveTextContent('★ 7.5')
    expect(within(previa).getByRole('img', { name: 'Netflix' })).toBeInTheDocument()
  })

  test('passar o mouse rápido não abre nada nem pede ao TMDB', async () => {
    const buscarDetalhes = vi.fn().mockResolvedValue(detalhesA)
    renderizar({ buscarDetalhes })
    const cartao = screen.getByRole('button', { name: /Filme A/ })
    await userEvent.hover(cartao)
    await userEvent.unhover(cartao)
    await esperar(800)
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(buscarDetalhes).not.toHaveBeenCalled()
  })

  test('o trailer toca sozinho, sem som, e o botão liga o som', async () => {
    const { previa } = await abrirPrevia()
    const video = await within(previa).findByTitle('Trailer de Filme A')
    expect(video.src).toContain('https://www.youtube.com/embed/tr1?')
    expect(video.src).toContain('autoplay=1')
    expect(video.src).toContain('mute=1')

    const enviar = vi.spyOn(video.contentWindow, 'postMessage')
    await userEvent.click(within(previa).getByRole('button', { name: 'Ativar som' }))
    expect(enviar).toHaveBeenCalledWith(expect.stringContaining('unMute'), '*')
    await userEvent.click(within(previa).getByRole('button', { name: 'Desativar som' }))
    expect(enviar).toHaveBeenLastCalledWith(expect.stringContaining('"mute"'), '*')
  })

  test('sem trailer, mostra a cena do filme parada', async () => {
    const { previa } = await abrirPrevia({ ...detalhesA, trailer: null })
    await within(previa).findByText('1h 52min')
    expect(within(previa).queryByTitle(/Trailer/)).not.toBeInTheDocument()
    expect(within(previa).queryByRole('button', { name: 'Ativar som' })).not.toBeInTheDocument()
    expect(previa.querySelector('.previa-cena')).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w1280/fa.jpg')
  })

  test('erro ao buscar os detalhes mantém a prévia com o que já se sabe do filme', async () => {
    const { previa } = await abrirPrevia(new Error('rede'))
    await esperar(0)
    expect(previa).toHaveTextContent('Filme A')
    expect(previa).toHaveTextContent('2024')
    expect(within(previa).getByRole('button', { name: 'Ver detalhes' })).toBeInTheDocument()
  })

  test('"Ver detalhes" abre a janela completa e fecha a prévia', async () => {
    const { previa, onAbrir } = await abrirPrevia()
    await userEvent.click(within(previa).getByRole('button', { name: 'Ver detalhes' }))
    expect(onAbrir).toHaveBeenCalledWith(1)
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })

  test('tirar o mouse da prévia fecha', async () => {
    const { previa } = await abrirPrevia()
    await userEvent.unhover(previa)
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })

  test('em tela de toque não há prévia', async () => {
    simularTela({ mouse: false })
    const buscarDetalhes = vi.fn().mockResolvedValue(detalhesA)
    renderizar({ buscarDetalhes })
    await userEvent.hover(screen.getByRole('button', { name: /Filme A/ }))
    await esperar(800)
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(buscarDetalhes).not.toHaveBeenCalled()
  })

  test('com "reduzir animações" ligado, o trailer só toca depois do clique', async () => {
    simularTela({ menosMovimento: true })
    const { previa } = await abrirPrevia()
    await userEvent.click(await within(previa).findByRole('button', { name: '▶ Tocar trailer' }))
    const video = within(previa).getByTitle('Trailer de Filme A')
    expect(video.src).toContain('autoplay=1')
    expect(video.src).not.toContain('mute=1')
  })
})
