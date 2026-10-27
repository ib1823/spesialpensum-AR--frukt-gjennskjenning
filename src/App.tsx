function App() {
  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="MatHjelp hjem">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none">
              <path
                d="M20 34c-7.4-4.3-11-9-11-15.3A8.7 8.7 0 0 1 17.7 10c1 0 1.7.2 2.3.5.6-.3 1.3-.5 2.3-.5A8.7 8.7 0 0 1 31 18.7C31 25 27.4 29.7 20 34Z"
                fill="currentColor"
              />
              <path
                d="M20 10c.2-3.8 2.4-6 6.4-6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M21 9c2.8-3.1 5.5-3.1 8.1-2.2-1.5 2.7-4 4-8.1 2.2Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span>MatHjelp</span>
        </a>
        <span className="header-badge">MATGLEDE</span>
      </header>

      <section className="home-section" aria-labelledby="page-title">
        <div className="intro">
          <p className="eyebrow">VELKOMMEN TIL MATHJELP</p>
          <h1 id="page-title">Hei, hva har du på kjøkkenet?</h1>
          <p className="intro__description">
            MatHjelp utvikles videre. Vi gleder oss til å dele en ny måte å
            utforske mat på.
          </p>
        </div>

        <div className="welcome-card">
          <span className="welcome-card__mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none">
              <path
                d="M20 34c-7.4-4.3-11-9-11-15.3A8.7 8.7 0 0 1 17.7 10c1 0 1.7.2 2.3.5.6-.3 1.3-.5 2.3-.5A8.7 8.7 0 0 1 31 18.7C31 25 27.4 29.7 20 34Z"
                fill="currentColor"
              />
              <path
                d="M20 10c.2-3.8 2.4-6 6.4-6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M21 9c2.8-3.1 5.5-3.1 8.1-2.2-1.5 2.7-4 4-8.1 2.2Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <h2 className="welcome-card__title">Et nytt kapittel er på vei</h2>
          <p className="welcome-card__description">
            Vi gjør klar MatHjelp for videre utvikling. Takk for at du følger
            med!
          </p>
        </div>
      </section>

      <footer className="site-footer">
        <span>MATHJELP</span>
        <span>LAGET FOR Å UTFORSKE</span>
      </footer>
    </main>
  )
}

export default App
