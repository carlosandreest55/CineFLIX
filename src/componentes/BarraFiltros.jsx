// Barra no topo: botões de streaming, menu de gênero e menu de ordenação.
// Enquanto há uma busca ativa, tudo fica desativado (a busca ignora os filtros).

const ORDENACOES = [
  { valor: 'populares', rotulo: 'Mais populares' },
  { valor: 'avaliados', rotulo: 'Mais bem avaliados' },
  { valor: 'lancamentos', rotulo: 'Lançamentos' },
]

export default function BarraFiltros({
  streamings, generos, selecionados, genero, ordenacao, busca,
  onAlternarStreaming, onGenero, onOrdenacao, onLimparBusca,
}) {
  const pausado = busca !== ''

  return (
    <div className="barra-filtros">
      {pausado && (
        <div className="aviso-busca">
          <span>Buscando por '{busca}' (filtros pausados)</span>
          <button type="button" onClick={onLimparBusca}>✕ Limpar busca</button>
        </div>
      )}

      <div className={pausado ? 'filtros pausado' : 'filtros'}>
        <div className="chips">
          {streamings.map((s) => (
            <button
              key={s.id}
              type="button"
              className="chip"
              aria-pressed={selecionados.includes(s.id)}
              disabled={pausado}
              onClick={() => onAlternarStreaming(s.id)}
            >
              {s.logo && <img src={s.logo} alt="" />}
              {s.nome}
            </button>
          ))}
        </div>

        <div className="menus">
          <label className="menu">
            Gênero
            <select
              value={genero ?? ''}
              disabled={pausado}
              onChange={(e) => onGenero(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Todos</option>
              {generos.map((g) => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </label>

          <label className="menu">
            Ordenar por
            <select value={ordenacao} disabled={pausado} onChange={(e) => onOrdenacao(e.target.value)}>
              {ORDENACOES.map((o) => (
                <option key={o.valor} value={o.valor}>{o.rotulo}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  )
}
