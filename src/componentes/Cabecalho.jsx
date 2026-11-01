// Topo da página: logo e campo de busca.
export default function Cabecalho({ texto, onTextoChange }) {
  return (
    <header className="cabecalho">
      <span className="logo">🎬 CATÁLOGO</span>
      <input
        type="search"
        className="busca"
        aria-label="Buscar filme"
        placeholder="Buscar filme..."
        value={texto}
        onChange={(e) => onTextoChange(e.target.value)}
      />
    </header>
  )
}
