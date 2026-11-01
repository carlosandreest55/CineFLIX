import CartaoFilme from './CartaoFilme'
import Mensagem from './Mensagem'

const QUANTIDADE_ESQUELETOS = 12

export default function GradeFilmes({
  filmes, totalResultados, carregando, temMais, erroMais, onCarregarMais, onAbrir, onTentarDeNovo,
}) {
  // Primeira página ainda chegando: retângulos cinza no lugar dos pôsteres.
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
          <CartaoFilme key={filme.id} filme={filme} onAbrir={onAbrir} />
        ))}
      </div>

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
