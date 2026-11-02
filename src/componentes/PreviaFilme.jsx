import { useEffect, useRef, useState } from 'react'
import { formatarDuracao } from '../formatar'

const MARGEM = 12
const ALTURA_CABECALHO = 72
const ALTURA_INFO = 170 // altura aproximada da parte de texto, abaixo do vídeo

// Coloca a prévia centrada sobre o pôster, sem deixar que ela saia da tela.
function posicionar(area) {
  const largura = Math.min(Math.max(area.width * 1.9, 340), 420)
  const altura = (largura * 9) / 16 + ALTURA_INFO
  const centroX = area.left + area.width / 2
  const centroY = area.top + area.height / 2
  const esquerda = Math.min(Math.max(centroX - largura / 2, MARGEM), window.innerWidth - largura - MARGEM)
  const topo = Math.min(Math.max(centroY - altura / 2, ALTURA_CABECALHO), window.innerHeight - altura - MARGEM)
  return {
    left: esquerda,
    top: topo,
    width: largura,
    // A animação de abrir cresce a partir do pôster, não do centro da prévia.
    '--origem': `${centroX - esquerda}px ${centroY - topo}px`,
    '--escala': (area.width / largura).toFixed(3),
  }
}

// Endereço do trailer no YouTube. Sozinho, só pode tocar sem som (regra dos navegadores);
// enablejsapi deixa o botão de som falar com o vídeo sem recarregá-lo.
function enderecoTrailer(chave, { mudo }) {
  const opcoes = new URLSearchParams({
    autoplay: 1, controls: 0, loop: 1, playlist: chave, playsinline: 1, rel: 0, enablejsapi: 1,
  })
  if (mudo) opcoes.set('mute', 1)
  return `https://www.youtube.com/embed/${chave}?${opcoes}`
}

const telaPedeMenosMovimento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

// Janela que sai do pôster quando o mouse para sobre ele: trailer tocando, informações e "Ver detalhes".
export default function PreviaFilme({ filme, area, buscarDetalhes, onVerDetalhes, onFechar }) {
  const [dados, setDados] = useState(null)
  const [menosMovimento] = useState(telaPedeMenosMovimento)
  const [tocando, setTocando] = useState(!menosMovimento)
  const [comSom, setComSom] = useState(false)
  const video = useRef(null)

  useEffect(() => {
    let cancelado = false
    // Se der erro, a prévia continua com o que a lista já sabe do filme.
    buscarDetalhes(filme.id).then((d) => { if (!cancelado) setDados(d) }).catch(() => {})
    return () => { cancelado = true }
  }, [filme.id, buscarDetalhes])

  function alternarSom() {
    const comando = comSom ? 'mute' : 'unMute'
    video.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: comando, args: [] }), '*')
    setComSom(!comSom)
  }

  const trailer = dados?.trailer
  const cena = filme.fundo ?? dados?.fundo ?? filme.poster
  // Quem clicou em "Tocar trailer" já pediu o vídeo: esse toca com som.
  const mudo = !menosMovimento

  return (
    <div
      className="previa"
      role="group"
      aria-label={`Prévia de ${filme.titulo}`}
      style={posicionar(area)}
      onMouseLeave={onFechar}
    >
      <div className="previa-midia">
        {cena && <img className="previa-cena" src={cena} alt="" />}
        {trailer && tocando && (
          <iframe
            ref={video}
            className="previa-video"
            title={`Trailer de ${filme.titulo}`}
            src={enderecoTrailer(trailer, { mudo })}
            allow="autoplay; encrypted-media"
          />
        )}
        {trailer && !tocando && (
          <button type="button" className="previa-tocar" onClick={() => setTocando(true)}>▶ Tocar trailer</button>
        )}
      </div>

      <div className="previa-info">
        <h3 className="previa-titulo">{filme.titulo}</h3>
        <p className="previa-meta">
          <span className="selo-nota">★ {filme.nota ?? '–'}</span>
          {filme.ano && <span>{filme.ano}</span>}
          {dados?.duracao && <span>{formatarDuracao(dados.duracao)}</span>}
        </p>
        {dados?.generos.length > 0 && <p className="previa-generos">{dados.generos.join(', ')}</p>}

        <div className="previa-acoes">
          <button type="button" className="botao-principal" onClick={onVerDetalhes}>Ver detalhes</button>
          {trailer && tocando && mudo && (
            <button
              type="button"
              className="botao-som"
              aria-label={comSom ? 'Desativar som' : 'Ativar som'}
              onClick={alternarSom}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9v6h4l5 4V5L8 9H4Z" />
                {comSom ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="m17 9 5 6m0-6-5 6" />}
              </svg>
            </button>
          )}
          {dados?.streamings.length > 0 && (
            <span className="previa-streamings">
              {dados.streamings.map((s) => (
                s.logo ? <img key={s.id} src={s.logo} alt={s.nome} title={s.nome} /> : <span key={s.id}>{s.nome}</span>
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
