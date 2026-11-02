// Topo da página: a cena do primeiro filme da lista, com a imagem espalhada como luz pela página.
// O "key" no App troca este componente a cada filme novo, e a animação de "acender" roda de novo.
export default function Destaque({ filme, motivo, onAbrir }) {
  const cena = { backgroundImage: `url(${filme.fundo})` }
  // Nomes compridos ganham um letreiro menor, para não engolirem a cena.
  const classeTitulo = filme.titulo.length > 26 ? 'destaque-titulo longo' : 'destaque-titulo'

  return (
    <section className="destaque" aria-labelledby="destaque-titulo">
      <div className="destaque-luz" style={cena} aria-hidden="true" />
      <div className="destaque-cena" style={cena} aria-hidden="true" />

      <div className="destaque-texto">
        <p className="destaque-motivo">{motivo}</p>
        <h2 id="destaque-titulo" className={classeTitulo}>{filme.titulo}</h2>
        <p className="destaque-meta">
          <span className="selo-nota">★ {filme.nota ?? '–'}</span>
          {filme.ano && <span>{filme.ano}</span>}
        </p>
        {filme.sinopse && <p className="destaque-sinopse">{filme.sinopse}</p>}
        <button type="button" className="botao-principal" onClick={() => onAbrir(filme.id)}>
          Ver detalhes
        </button>
      </div>
    </section>
  )
}
