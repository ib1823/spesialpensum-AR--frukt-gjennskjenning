import type {
  RecognitionResult,
  RecognitionStatus,
} from '../types/recognition'

type RecognitionBadgeProps = {
  error: string | null
  result: RecognitionResult | null
  status: RecognitionStatus
}

const LABELS = {
  banana: 'Banan',
  apple: 'Eple',
  unknown: 'Ukjent matvare',
} as const

export function RecognitionBadge({
  error,
  result,
  status,
}: RecognitionBadgeProps) {
  if (status === 'idle') {
    return null
  }

  if (status === 'loading') {
    return (
      <div className="recognition-badge" role="status">
        Laster AI-modell...
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="recognition-badge recognition-badge--error" role="status">
        AI utilgjengelig{error ? ` · ${error}` : ''}
      </div>
    )
  }

  if (!result) {
    return (
      <div className="recognition-badge" role="status">
        Ser etter matvarer...
      </div>
    )
  }

  return (
    <div className="recognition-badge" role="status" aria-live="polite">
      <span>{LABELS[result.label]}</span>
      {result.confidence !== null && (
        <span className="recognition-badge__confidence">
          {(result.confidence * 100).toFixed(0)}% sikkerhet
        </span>
      )}
    </div>
  )
}
