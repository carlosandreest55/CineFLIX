import { useEffect, useState } from 'react'
import { detalhesFilme } from '../api/tmdb'
import Mensagem from './Mensagem'

const TEXTO_ERRO = {
  'chave-invalida': 'Chave do TMDB não encontrada ou inválida. Veja o passo a passo no README.',
  rede: 'Não foi possível falar com o TMDB',
}

function formatarDuracao(minutos) {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

// Janela por cima do catálogo com tudo sobre um filme. Busca os próprios dados a partir do filmeId.
export default function JanelaDetalhes({ filmeId, onFechar }) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [tentativa, setTentativa] = useState(0)
  const [mostrarTrailer, setMostrarTrailer] = useState(false)

  useEffect(() => {
    // "cancelado" vira true quando o filme muda ou a janela fecha: a resposta antiga é ignorada.
    let cancelado = false
    setDados(null)
    setErro(null)
    setMostrarTrailer(false)
    detalhesFilme(filmeId)
      .then((d) => { if (!cancelado) setDados(d) })
      .catch((e) => { if (!cancelado) setErro(e.tipo ?? 'rede') })
    return () => { cancelado = true }
  }, [filmeId, tentativa])

  // Trava a rolagem da página de trás, para o catálogo continuar no mesmo lugar ao fechar.
  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = anterior }
  }, [])

  useEffect(() => {
    const aoApertarTecla = (e) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', aoApertarTecla)
    return () => document.removeEventListener('keydown', aoApertarTecla)
  }, [onFechar])

  // Só fecha se o clique foi no fundo escuro, não dentro da janela.
  const aoClicarFundo = (e) => { if (e.target === e.currentTarget) onFechar() }

  return (
    <div className="fundo-janela" data-testid="fundo-janela" onClick={aoClicarFundo}>
      <div className="janela" role="dialog" aria-modal="true" aria-label={dados ? dados.titulo : 'Carregando'}>
        <button type="button" className="fechar" aria-label="Fechar" onClick={onFechar}>✕</button>

        {erro && (
          <Mensagem texto={TEXTO_ERRO[erro]} acao={{ rotulo: 'Tentar de novo', onClick: () => setTentativa((t) => t + 1) }} />
        )}
        {!erro && !dados && <p className="carregando">Carregando...</p>}
        {dados && <Conteudo dados={dados} mostrarTrailer={mostrarTrailer} onVerTrailer={() => setMostrarTrailer(true)} />}
      </div>
    </div>
  )
}

function Conteudo({ dados, mostrarTrailer, onVerTrailer }) {
  const linhaInfo = [
    `★ ${dados.nota ?? '–'}`,
    dados.ano,
    dados.duracao && formatarDuracao(dados.duracao),
    dados.generos.length > 0 && dados.generos.join(', '),
  ].filter(Boolean).join(' · ')

  return (
    <>
      <div className="fundo-filme" style={dados.fundo ? { backgroundImage: `url(${dados.fundo})` } : undefined} />
      <div className="detalhes">
        {dados.poster ? (
          <img className="poster-grande" src={dados.poster} alt="" />
        ) : (
          <div className="poster-grande sem-imagem">🎬</div>
        )}

        <div className="info">
          <h2>{dados.titulo}</h2>
          <p className="meta">{linhaInfo}</p>
          {dados.diretores.length > 0 && <p className="meta">Direção: {dados.diretores.join(', ')}</p>}
          <p className="sinopse">{dados.sinopse}</p>

          {dados.trailer && !mostrarTrailer && (
            <button type="button" className="botao-trailer" onClick={onVerTrailer}>▶ Ver trailer</button>
          )}
          {dados.trailer && mostrarTrailer && (
            <iframe
              className="trailer"
              title="Trailer"
              src={`https://www.youtube.com/embed/${dados.trailer}?autoplay=1`}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
            />
          )}

          <h3 className="rotulo">Onde assistir no Brasil</h3>
          {dados.streamings.length > 0 ? (
            <div className="provedores">
              {dados.streamings.map((s) => (
                s.logo ? <img key={s.id} src={s.logo} alt={s.nome} title={s.nome} /> : <span key={s.id}>{s.nome}</span>
              ))}
              <span className="credito-jw">dados: JustWatch</span>
            </div>
          ) : (
            <p className="indisponivel">Não disponível em streaming por assinatura no Brasil</p>
          )}

          {dados.elenco.length > 0 && (
            <>
              <h3 className="rotulo">Elenco</h3>
              <ul className="elenco">
                {dados.elenco.map((p) => (
                  <li key={p.id}>
                    {p.foto ? <img src={p.foto} alt="" /> : <div className="sem-imagem">👤</div>}
                    <span>{p.nome}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  )
}
