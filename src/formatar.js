// Minutos em texto curto: 112 vira "1h 52min"; 45 vira "45min".
export function formatarDuracao(minutos) {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}
