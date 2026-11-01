import { act, renderHook } from '@testing-library/react'
import useAtrasado from './useAtrasado'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('só devolve o valor depois de um tempo sem mudanças', () => {
  const { result, rerender } = renderHook(({ valor }) => useAtrasado(valor, 500), { initialProps: { valor: '' } })
  rerender({ valor: 'bat' })
  expect(result.current).toBe('')
  act(() => vi.advanceTimersByTime(499))
  expect(result.current).toBe('')
  act(() => vi.advanceTimersByTime(1))
  expect(result.current).toBe('bat')
})

test('cada nova letra recomeça a espera', () => {
  const { result, rerender } = renderHook(({ valor }) => useAtrasado(valor, 500), { initialProps: { valor: '' } })
  rerender({ valor: 'ba' })
  act(() => vi.advanceTimersByTime(400))
  rerender({ valor: 'bat' })
  act(() => vi.advanceTimersByTime(400))
  expect(result.current).toBe('')
  act(() => vi.advanceTimersByTime(100))
  expect(result.current).toBe('bat')
})

test('depois de limpar, a busca antiga não volta ao digitar de novo', () => {
  const { result, rerender } = renderHook(({ valor }) => useAtrasado(valor, 500), { initialProps: { valor: '' } })
  rerender({ valor: 'bat' })
  act(() => vi.advanceTimersByTime(500))
  rerender({ valor: '' })
  rerender({ valor: 'x' })
  expect(result.current).toBe('')
  act(() => vi.advanceTimersByTime(500))
  expect(result.current).toBe('x')
})

test('valor vazio é devolvido na hora', () => {
  const { result, rerender } = renderHook(({ valor }) => useAtrasado(valor, 500), { initialProps: { valor: '' } })
  rerender({ valor: 'bat' })
  act(() => vi.advanceTimersByTime(500))
  rerender({ valor: '' })
  expect(result.current).toBe('')
})
