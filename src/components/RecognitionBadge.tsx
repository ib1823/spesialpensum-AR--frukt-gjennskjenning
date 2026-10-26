import type { CSSProperties } from 'react'
import type {
  RecognitionResult,
  RecognitionStatus,
} from '../types/recognition'

type RecognitionBadgeProps = {
  error: string | null
  position: {
    left: number
    top: number
    placement: 'above' | 'below'
  } | null
  result: RecognitionResult | null
  status: RecognitionStatus
}

const LABELS = {
  banana: 'Dette er en banan',
  apple: 'Dette er et eple',
  unknown: 'Ukjent matvare',
} as const

export function RecognitionBadge({
  error,
  position,
  result,
  status,
}: RecognitionBadgeProps) {
  if (status === 'idle') {
    return null
  }

  if (status === 'loading') {
    return (
      <div className="recognition-badge" role="status">
        <span className="recognition-float" key="loading">
          Laster AI-modell...
        </span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="recognition-badge recognition-badge--error" role="status">
        <span className="recognition-float" key="error">
          AI utilgjengelig{error ? ` · ${error}` : ''}
        </span>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="recognition-badge" role="status">
        <span className="recognition-float" key="searching">
          Ser etter matvarer...
        </span>
      </div>
    )
  }

  return (
    <div
      className={`recognition-badge${position ? ` recognition-badge--${position.placement}` : ''}`}
      role="status"
      aria-live="polite"
      style={
        position
          ? ({
              left: `${position.left}%`,
              top: `${position.top}%`,
              bottom: 'auto',
            } as CSSProperties)
          : undefined
      }
    >
      <div className="recognition-float" key={result.label}>
        <span>{LABELS[result.label]}</span>
        {result.confidence !== null && (
          <span className="recognition-badge__confidence">
            {(result.confidence * 100).toFixed(0)}% sikkerhet
          </span>
        )}
      </div>
    </div>
  )
}
