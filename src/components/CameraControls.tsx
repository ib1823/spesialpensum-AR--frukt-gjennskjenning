type CameraControlsProps = {
  isRunning: boolean
  isStarting: boolean
  onStart: () => void
  onStop: () => void
}

export function CameraControls({
  isRunning,
  isStarting,
  onStart,
  onStop,
}: CameraControlsProps) {
  return (
    <div className="camera-controls">
      {!isRunning ? (
        <button
          className="button button--primary"
          type="button"
          onClick={onStart}
          disabled={isStarting}
        >
          {isStarting ? (
            <>
              <span className="button-spinner" aria-hidden="true" />
              Starter kamera...
            </>
          ) : (
            <>
              <span className="button-camera-icon" aria-hidden="true" />
              Start kamera
            </>
          )}
        </button>
      ) : (
        <button
          className="button button--secondary"
          type="button"
          onClick={onStop}
        >
          Stopp kamera
        </button>
      )}
      <p className="camera-controls__hint">
        Kameraet brukes bare mens du har det aktivt.
      </p>
    </div>
  )
}
