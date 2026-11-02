import { useEffect, useState } from 'react'

// Topo da página: marca e campo de busca.
// Fica transparente sobre o destaque e ganha fundo assim que a página rola.
export default function Cabecalho({ texto, onTextoChange }) {
  const [rolou, setRolou] = useState(false)

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 8)
    aoRolar()
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => window.removeEventListener('scroll', aoRolar)
  }, [])

  return (
    <header className={rolou ? 'cabecalho rolou' : 'cabecalho'}>
      <span className="logo">CineFLIX</span>
      <label className="busca">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          aria-label="Buscar filme"
          placeholder="Buscar filme pelo nome"
          value={texto}
          onChange={(e) => onTextoChange(e.target.value)}
        />
      </label>
    </header>
  )
}
