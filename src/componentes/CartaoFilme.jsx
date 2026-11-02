// Um pôster da grade. É um botão: clicar abre a janela de detalhes.
// onApontar/onDesapontar avisam a grade quando o mouse entra e sai, para ela cuidar da prévia.
export default function CartaoFilme({ filme, onAbrir, onApontar, onDesapontar }) {
  // Nome lido pelos leitores de tela, ex.: "Duna, 2021, nota 7.8".
  const descricao = [filme.titulo, filme.ano, filme.nota === null ? 'sem nota' : `nota ${filme.nota}`]
    .filter(Boolean)
    .join(', ')

  return (
    <button
      type="button"
      className="cartao"
      aria-label={descricao}
      onClick={() => onAbrir(filme.id)}
      onMouseEnter={(e) => onApontar?.(filme, e.currentTarget.querySelector('.moldura'))}
      onMouseLeave={onDesapontar}
    >
      <span className="moldura">
        {filme.poster ? (
          <img className="poster" src={filme.poster} alt="" loading="lazy" />
        ) : (
          <span className="poster sem-imagem">{filme.titulo}</span>
        )}
        <span className="nota">★ {filme.nota ?? '–'}</span>
      </span>
      <span className="titulo">{filme.titulo}</span>
      {filme.ano && <span className="ano">{filme.ano}</span>}
    </button>
  )
}
