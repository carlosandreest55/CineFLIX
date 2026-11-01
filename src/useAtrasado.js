import { useEffect, useState } from 'react'

// Devolve "valor" só depois de "ms" milissegundos sem mudanças.
// Serve para a busca não consultar o TMDB a cada letra digitada.
// Valor vazio é devolvido na hora, para "Limpar busca" ter efeito imediato.
export default function useAtrasado(valor, ms) {
  const [atrasado, setAtrasado] = useState(valor)

  useEffect(() => {
    // Vazio zera na hora, para um texto antigo não "voltar" quando o usuário digitar de novo.
    if (valor === '') {
      setAtrasado('')
      return
    }
    const espera = setTimeout(() => setAtrasado(valor), ms)
    return () => clearTimeout(espera)
  }, [valor, ms])

  return valor === '' ? '' : atrasado
}
