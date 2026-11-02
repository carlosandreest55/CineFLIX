import criarMemoria from './memoria'

test('pede uma vez só para cada chave', async () => {
  const buscar = vi.fn(async (id) => ({ id }))
  const lembrar = criarMemoria(buscar)
  expect(await lembrar(1)).toEqual({ id: 1 })
  expect(await lembrar(1)).toEqual({ id: 1 })
  expect(await lembrar(2)).toEqual({ id: 2 })
  expect(buscar).toHaveBeenCalledTimes(2)
})

test('pedidos ao mesmo tempo compartilham a mesma resposta', async () => {
  const buscar = vi.fn(async (id) => ({ id }))
  const lembrar = criarMemoria(buscar)
  await Promise.all([lembrar(1), lembrar(1)])
  expect(buscar).toHaveBeenCalledTimes(1)
})

test('erro não fica guardado: o próximo pedido tenta de novo', async () => {
  const buscar = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ id: 1 })
  const lembrar = criarMemoria(buscar)
  await expect(lembrar(1)).rejects.toThrow('rede')
  expect(await lembrar(1)).toEqual({ id: 1 })
  expect(buscar).toHaveBeenCalledTimes(2)
})
