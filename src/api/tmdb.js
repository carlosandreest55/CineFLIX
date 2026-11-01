// O "mensageiro": o único arquivo do app que conversa com a API do TMDB.

const URL_BASE = 'https://api.themoviedb.org/3'

// Erro com um "tipo" que as telas usam para escolher a mensagem certa.
export class ErroTmdb extends Error {
  constructor(tipo) {
    super(`Erro ao falar com o TMDB: ${tipo}`)
    this.name = 'ErroTmdb'
    this.tipo = tipo // 'chave-invalida' | 'rede'
  }
}

// Faz um pedido ao TMDB e devolve a resposta já convertida de JSON.
export async function requisitar(caminho, params = {}) {
  // Lido a cada chamada (e não uma vez só) para os testes poderem trocar o valor.
  const token = import.meta.env.VITE_TMDB_TOKEN
  if (!token) throw new ErroTmdb('chave-invalida')

  const busca = new URLSearchParams()
  for (const [nome, valor] of Object.entries(params)) {
    if (valor !== null && valor !== undefined && valor !== '') busca.append(nome, valor)
  }
  const consulta = busca.toString()
  const url = `${URL_BASE}${caminho}${consulta ? `?${consulta}` : ''}`

  let resposta
  try {
    resposta = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    })
  } catch {
    throw new ErroTmdb('rede')
  }

  if (resposta.status === 401) throw new ErroTmdb('chave-invalida')
  if (!resposta.ok) throw new ErroTmdb('rede')
  return resposta.json()
}
