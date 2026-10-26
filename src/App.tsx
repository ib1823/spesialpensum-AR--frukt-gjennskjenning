import { CameraControls } from './components/CameraControls'
import { CameraView } from './components/CameraView'
import { useCamera } from './hooks/useCamera'

function App() {
  const camera = useCamera()

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
          <span className="brand-label">WEBAR</span>
        </a>
        <span className="header-badge">
          <span /> KAMERA
        </span>
      </header>

      <section className="camera-section" aria-labelledby="page-title">
        <div className="intro">
          <p className="eyebrow">SE MATEN PÅ EN NY MÅTE</p>
          <h1 id="page-title">Hei, hva har du på kjøkkenet?</h1>
          <p className="intro__description">
            Pek kameraet mot maten din. Vi gjør klar for å hjelpe deg med å
            utforske den.
          </p>
        </div>

        <CameraView videoRef={camera.videoRef} isRunning={camera.isRunning} />

        <div className="camera-panel">
          <CameraControls
            isRunning={camera.isRunning}
            isStarting={camera.isStarting}
            onStart={camera.startCamera}
            onStop={camera.stopCamera}
          />
          {camera.error && (
            <p className="camera-error" role="alert">
              <span aria-hidden="true">!</span>
              {camera.error}
            </p>
          )}
        </div>

        <div className="privacy-note">
          <span className="privacy-note__icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none">
              <path
                d="M10 2.5 3.5 5v4.8c0 4 2.7 6.5 6.5 7.7 3.8-1.2 6.5-3.7 6.5-7.7V5L10 2.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="m7.3 10 1.8 1.8 3.7-3.7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>
            <strong>Bildet ditt forblir ditt.</strong> Videoen behandles lokalt
            i nettleseren.
          </span>
        </div>
      </section>

      <footer className="site-footer">
        <span>MATHJELP WEBAR</span>
        <span>LAGET FOR Å UTFORSKE</span>
      </footer>
    </main>
  )
}

export default App
