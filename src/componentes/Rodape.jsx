// Créditos exigidos pelos termos de uso do TMDB e do JustWatch.
const LOGO_TMDB =
  'https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg'

export default function Rodape() {
  return (
    <footer className="rodape">
      <img src={LOGO_TMDB} alt="TMDB" />
      <p>Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.</p>
      <p>Dados de onde assistir: JustWatch.</p>
    </footer>
  )
}
