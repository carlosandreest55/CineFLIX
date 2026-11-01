// Um pôster da grade. É um botão: clicar abre a janela de detalhes.
export default function CartaoFilme({ filme, onAbrir }) {
  // Nome lido pelos leitores de tela, ex.: "Duna, 2021, nota 7.8".
  const descricao = [filme.titulo, filme.ano, filme.nota === null ? 'sem nota' : `nota ${filme.nota}`]
    .filter(Boolean)
    .join(', ')

  return (
    <button type="button" className="cartao" aria-label={descricao} onClick={() => onAbrir(filme.id)}>
      {filme.poster ? (
        <img className="poster" src={filme.poster} alt="" loading="lazy" />
      ) : (
        <div className="poster sem-imagem">🎬</div>
      )}
      <span className="nota">★ {filme.nota ?? '–'}</span>
      <span className="titulo">{filme.titulo}</span>
      {filme.ano && <span className="ano">{filme.ano}</span>}
    </button>
  )
}
