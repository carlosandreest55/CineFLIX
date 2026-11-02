import { useEffect, useRef, useState } from 'react'
import CartaoFilme from './CartaoFilme'
import Mensagem from './Mensagem'
import PreviaFilme from './PreviaFilme'

const QUANTIDADE_ESQUELETOS = 12
// Tempo com o mouse parado no pôster até abrir a prévia: passar por cima a caminho de outro lugar não abre nada.
const ATRASO_PREVIA = 600

// Só telas com mouse têm prévia; em toque, tocar no pôster já abre os detalhes.
const temMouse = () => window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false

export default function GradeFilmes({
  filmes, totalResultados, carregando, temMais, erroMais, onCarregarMais, onAbrir, onTentarDeNovo, buscarDetalhes,
}) {
  const [previa, setPrevia] = useState(null) // { filme, area } do pôster com a prévia aberta
  const espera = useRef(null)

  useEffect(() => () => clearTimeout(espera.current), [])

  // A prévia fica presa à posição do pôster na tela: se a página rolar, ela fecha.
  useEffect(() => {
    if (!previa) return
    const fechar = () => setPrevia(null)
    window.addEventListener('scroll', fechar, { passive: true })
    return () => window.removeEventListener('scroll', fechar)
  }, [previa])

  function aoApontar(filme, moldura) {
    clearTimeout(espera.current)
    if (!buscarDetalhes || !temMouse()) return
    espera.current = setTimeout(() => setPrevia({ filme, area: moldura.getBoundingClientRect() }), ATRASO_PREVIA)
  }

  function aoDesapontar() {
    clearTimeout(espera.current)
  }

  // Primeira página ainda chegando: retângulos no lugar dos pôsteres.
  if (carregando && filmes.length === 0) {
    return (
      <div className="grade">
        {Array.from({ length: QUANTIDADE_ESQUELETOS }, (_, i) => (
          <div key={i} className="esqueleto" data-testid="esqueleto" />
        ))}
      </div>
    )
  }

  const contador = `${totalResultados.toLocaleString('pt-BR')} ${totalResultados === 1 ? 'filme' : 'filmes'}`

  return (
    <section>
      <p className="contador">{contador}</p>
      <div className="grade">
        {filmes.map((filme) => (
          <CartaoFilme
            key={filme.id}
            filme={filme}
            onAbrir={onAbrir}
            onApontar={aoApontar}
            onDesapontar={aoDesapontar}
          />
        ))}
      </div>

      {previa && (
        <PreviaFilme
          key={previa.filme.id}
          filme={previa.filme}
          area={previa.area}
          buscarDetalhes={buscarDetalhes}
          onVerDetalhes={() => {
            setPrevia(null)
            onAbrir(previa.filme.id)
          }}
          onFechar={() => setPrevia(null)}
        />
      )}

      {erroMais ? (
        <Mensagem
          texto="Não foi possível falar com o TMDB"
          acao={{ rotulo: 'Tentar de novo', onClick: onTentarDeNovo }}
        />
      ) : (
        temMais && (
          <button type="button" className="carregar-mais" disabled={carregando} onClick={onCarregarMais}>
            {carregando ? 'Carregando...' : 'Carregar mais'}
          </button>
        )
      )}
    </section>
  )
}
