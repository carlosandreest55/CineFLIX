import { useCallback, useEffect, useRef, useState } from 'react'
import { buscarFilmes, descobrirFilmes, detalhesFilme, listarGeneros, listarStreamings } from './api/tmdb'
import criarMemoria from './memoria'
import useAtrasado from './useAtrasado'
import Cabecalho from './componentes/Cabecalho'
import Destaque from './componentes/Destaque'
import BarraFiltros from './componentes/BarraFiltros'
import GradeFilmes from './componentes/GradeFilmes'
import JanelaDetalhes from './componentes/JanelaDetalhes'
import Mensagem from './componentes/Mensagem'
import Rodape from './componentes/Rodape'

const TEXTO_ERRO = {
  'chave-invalida': 'Chave do TMDB não encontrada ou inválida. Veja o passo a passo no README.',
  rede: 'Não foi possível falar com o TMDB',
}

const ORDEM_DESTAQUE = {
  populares: 'Mais popular',
  avaliados: 'Mais bem avaliado',
  lancamentos: 'Estreia mais recente',
}

// Frase acima do título do destaque, explicando por que aquele filme está ali.
// Ex.: "Mais bem avaliado em terror nos streamings que você escolheu".
function motivoDestaque({ ordenacao, genero, streamings, generos }) {
  const nomeGenero = generos.find((g) => g.id === genero)?.nome
  return [
    ORDEM_DESTAQUE[ordenacao],
    nomeGenero && `em ${nomeGenero.toLowerCase()}`,
    streamings.length > 0 ? 'nos streamings que você escolheu' : 'nos streamings do Brasil',
  ].filter(Boolean).join(' ')
}

// O "cérebro": guarda as escolhas do usuário, pede os filmes ao mensageiro e repassa tudo às peças da tela.
export default function App() {
  // Opções que vêm do TMDB para montar a barra de filtros
  const [streamingsDisponiveis, setStreamingsDisponiveis] = useState([])
  const [generos, setGeneros] = useState([])

  // Escolhas do usuário
  const [streamings, setStreamings] = useState([])
  const [genero, setGenero] = useState(null)
  const [ordenacao, setOrdenacao] = useState('populares')
  const [textoDigitado, setTextoDigitado] = useState('')
  // Só busca depois de meio segundo sem digitar; espaços sozinhos não contam como busca.
  const busca = useAtrasado(textoDigitado.trim(), 500)
  const [filmeAberto, setFilmeAberto] = useState(null)
  // Detalhes já pedidos ao TMDB (pela prévia ou pela janela) ficam guardados enquanto o site está aberto.
  const [buscarDetalhes] = useState(() => criarMemoria(detalhesFilme))

  // Lista de filmes e situação da última consulta
  const [filmes, setFilmes] = useState([])
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(0)
  const [totalResultados, setTotalResultados] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  // Filme do topo: fica o anterior até a lista nova chegar, para a página não "pular".
  const [destaque, setDestaque] = useState(null)

  // Número da consulta mais recente: respostas de consultas mais antigas são ignoradas.
  const ultimoPedido = useRef(0)

  function carregarListas() {
    listarStreamings().then(setStreamingsDisponiveis).catch(() => {})
    listarGeneros().then(setGeneros).catch(() => {})
  }

  async function carregarPagina(numero) {
    const pedido = ++ultimoPedido.current
    const acrescentar = numero > 1
    setCarregando(true)
    setErro(null)
    try {
      // Com texto na busca, os filtros ficam de lado e a consulta é por nome.
      const r = busca !== ''
        ? await buscarFilmes({ texto: busca, pagina: numero })
        : await descobrirFilmes({ streamings, genero, ordenacao, pagina: numero })
      if (pedido !== ultimoPedido.current) return
      setFilmes((anteriores) => {
        if (!acrescentar) return r.filmes
        // A ordem do TMDB pode mudar entre uma página e outra: evita mostrar o mesmo filme duas vezes.
        const jaTem = new Set(anteriores.map((f) => f.id))
        return [...anteriores, ...r.filmes.filter((f) => !jaTem.has(f.id))]
      })
      if (!acrescentar) {
        const filme = busca === '' ? r.filmes.find((f) => f.fundo) : undefined
        setDestaque(filme ? { filme, motivo: motivoDestaque({ ordenacao, genero, streamings, generos }) } : null)
      }
      setPagina(r.pagina)
      setTotalPaginas(r.totalPaginas)
      setTotalResultados(r.totalResultados)
    } catch (e) {
      if (pedido !== ultimoPedido.current) return
      setErro(e.tipo ?? 'rede')
    } finally {
      if (pedido === ultimoPedido.current) setCarregando(false)
    }
  }

  useEffect(carregarListas, [])

  // Sempre que um filtro ou a busca muda: lista do zero, volta ao topo, página 1.
  useEffect(() => {
    setFilmes([])
    window.scrollTo({ top: 0 })
    carregarPagina(1)
  }, [streamings, genero, ordenacao, busca]) // eslint-disable-line react-hooks/exhaustive-deps

  function alternarStreaming(id) {
    setStreamings((atuais) => (atuais.includes(id) ? atuais.filter((s) => s !== id) : [...atuais, id]))
  }

  function limparFiltros() {
    setStreamings([])
    setGenero(null)
    setOrdenacao('populares')
  }

  // useCallback: a janela registra a tecla Esc com esta função; mantê-la estável evita registrar de novo a cada tela.
  const fecharJanela = useCallback(() => setFilmeAberto(null), [])

  function tentarDeNovo() {
    if (streamingsDisponiveis.length === 0 || generos.length === 0) carregarListas()
    carregarPagina(filmes.length === 0 ? 1 : pagina + 1)
  }

  let conteudo
  if (erro && filmes.length === 0) {
    conteudo = (
      <Mensagem
        texto={TEXTO_ERRO[erro]}
        acao={erro === 'rede' ? { rotulo: 'Tentar de novo', onClick: tentarDeNovo } : undefined}
      />
    )
  } else if (!carregando && filmes.length === 0) {
    conteudo = busca !== '' ? (
      <Mensagem texto={`Nenhum filme encontrado para '${busca}'`} />
    ) : (
      <Mensagem texto="Nenhum filme encontrado com esses filtros" acao={{ rotulo: 'Limpar filtros', onClick: limparFiltros }} />
    )
  } else {
    conteudo = (
      <GradeFilmes
        filmes={filmes}
        totalResultados={totalResultados}
        carregando={carregando}
        temMais={pagina < totalPaginas}
        erroMais={erro !== null}
        onCarregarMais={() => carregarPagina(pagina + 1)}
        onAbrir={setFilmeAberto}
        onTentarDeNovo={tentarDeNovo}
        buscarDetalhes={buscarDetalhes}
      />
    )
  }

  return (
    <>
      <Cabecalho texto={textoDigitado} onTextoChange={setTextoDigitado} />
      {destaque && busca === '' && (
        <Destaque key={destaque.filme.id} filme={destaque.filme} motivo={destaque.motivo} onAbrir={setFilmeAberto} />
      )}
      <BarraFiltros
        streamings={streamingsDisponiveis}
        generos={generos}
        selecionados={streamings}
        genero={genero}
        ordenacao={ordenacao}
        busca={busca}
        onAlternarStreaming={alternarStreaming}
        onGenero={setGenero}
        onOrdenacao={setOrdenacao}
        onLimparBusca={() => setTextoDigitado('')}
      />
      <main className="conteudo">{conteudo}</main>
      <Rodape />
      {filmeAberto !== null && <JanelaDetalhes filmeId={filmeAberto} onFechar={fecharJanela} buscarDetalhes={buscarDetalhes} />}
    </>
  )
}
