// Caixa de aviso (erro, "nenhum resultado"), com um botão de ação opcional.
export default function Mensagem({ texto, acao }) {
  return (
    <div className="mensagem" role="alert">
      <p>{texto}</p>
      {acao && <button type="button" onClick={acao.onClick}>{acao.rotulo}</button>}
    </div>
  )
}
