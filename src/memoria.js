// Guarda as respostas de uma função assíncrona, uma por chave.
// Serve para a prévia e a janela de detalhes não pedirem o mesmo filme duas vezes ao TMDB.
// Respostas com erro não ficam guardadas, para "Tentar de novo" pedir de novo de verdade.
export default function criarMemoria(buscar) {
  const guardadas = new Map()

  return (chave) => {
    if (!guardadas.has(chave)) {
      const pedido = buscar(chave)
      guardadas.set(chave, pedido)
      pedido.catch(() => guardadas.delete(chave))
    }
    return guardadas.get(chave)
  }
}
