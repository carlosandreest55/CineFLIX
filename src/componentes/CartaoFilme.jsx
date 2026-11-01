// Um pôster da grade. É um botão: clicar abre a janela de detalhes.
export default function CartaoFilme({ filme, onAbrir }) {
  return (
    <button type="button" className="cartao" onClick={() => onAbrir(filme.id)}>
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
