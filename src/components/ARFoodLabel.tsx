import type { CSSProperties } from 'react'
import type {
  RecognitionResult,
  RecognitionStatus,
} from '../types/recognition'

type ARFoodLabelProps = {
  candidate: RecognitionResult | null
  error: string | null
  evaluating: boolean
  textAnalyzing: boolean
  textError: string | null
  position: {
    left: number
    top: number
    placement: 'above' | 'below'
  } | null
  result: RecognitionResult | null
  status: RecognitionStatus
}

const FOOD_NAMES: Record<
  'banana' | 'apple' | 'monster-energy' | 'unknown',
  string
> = {
  banana: 'banan',
  apple: 'eple',
  'monster-energy': 'Monster Energy',
  unknown: 'Ukjent matvare',
}

export function ARFoodLabel({
  candidate,
  error,
  evaluating,
  textAnalyzing,
  textError,
  position,
  result,
  status,
}: ARFoodLabelProps) {
  const labelStyle: CSSProperties | undefined = position
    ? {
        left: `${position.left}%`,
        top: `${position.top}%`,
        bottom: 'auto',
      }
    : undefined

  if (status === 'idle') {
    return null
  }

  if (status === 'loading') {
    return (
      <div className="ar-food-label" role="status">
        <div className="ar-food-label__panel">
          <span className="ar-food-label__eyebrow">MATHJELP SCANNER</span>
          <span className="ar-food-label__title">Laster AI-modell...</span>
          {textError && (
            <span className="ar-food-label__detail">
              Tekstlesing utilgjengelig
            </span>
          )}
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="ar-food-label ar-food-label--error" role="status">
        <div className="ar-food-label__panel">
          <span className="ar-food-label__eyebrow">MATHJELP SCANNER</span>
          <span className="ar-food-label__title">AI utilgjengelig</span>
          {error && <span className="ar-food-label__detail">{error}</span>}
          {textError && (
            <span className="ar-food-label__detail">
              Tekstlesing utilgjengelig: {textError}
            </span>
          )}
        </div>
      </div>
    )
  }

  if (evaluating) {
    return (
      <div
        className={`ar-food-label${position ? ` ar-food-label--${position.placement}` : ''}`}
        role="status"
        style={labelStyle}
      >
        <div className="ar-food-label__panel" key="evaluating">
          <span className="ar-food-label__eyebrow">
            {textAnalyzing ? 'LESER EMBALLASJEN' : 'ANALYSERER'}
          </span>
          <span className="ar-food-label__title">
            {textAnalyzing ? 'Leser teksten...' : 'Vurderer varen...'}
          </span>
          {candidate?.confidence !== null &&
            candidate?.confidence !== undefined && (
              <span className="ar-food-label__detail">
                {(candidate.confidence * 100).toFixed(0)}% modellscore
              </span>
            )}
          {textError && (
            <span className="ar-food-label__detail">
              Tekstlesing utilgjengelig
            </span>
          )}
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="ar-food-label" role="status">
        <div className="ar-food-label__panel" key="searching">
          <span className="ar-food-label__eyebrow">SØKER</span>
          <span className="ar-food-label__title">Leter etter mat...</span>
          {textError && (
            <span className="ar-food-label__detail">
              Tekstlesing utilgjengelig
            </span>
          )}
        </div>
      </div>
    )
  }

  if (result.label === 'text') {
    return (
      <div
        className="ar-food-label"
        role="status"
        aria-live="polite"
      >
        <div className="ar-food-label__panel" key={result.recognizedText}>
          <span className="ar-food-label__eyebrow">TEKST LEST FRA BILDET</span>
          <span className="ar-food-label__title">Tekst funnet</span>
          {result.recognizedText && (
            <span className="ar-food-label__recognized-text">
              {result.recognizedText}
            </span>
          )}
          {result.confidence !== null && (
            <span className="ar-food-label__detail">
              OCR-score {(result.confidence * 100).toFixed(0)}%
            </span>
          )}
          {textError && (
            <span className="ar-food-label__detail">
              Tekstlesing feilet: {textError}
            </span>
          )}
        </div>
      </div>
    )
  }

  if (result.label === 'object') {
    return (
      <div
        className={`ar-food-label${position ? ` ar-food-label--${position.placement}` : ''}`}
        role="status"
        aria-live="polite"
        style={labelStyle}
      >
        <div className="ar-food-label__panel" key={result.recognizedText}>
          <span className="ar-food-label__eyebrow">OBJEKT GJENKJENT</span>
          <span className="ar-food-label__title">
            {result.recognizedText ?? 'Ukjent objekt'}
          </span>
          {result.confidence !== null && (
            <span className="ar-food-label__detail">
              Objektscore {(result.confidence * 100).toFixed(0)}%
            </span>
          )}
          {textError && (
            <span className="ar-food-label__detail">
              Tekstlesing utilgjengelig
            </span>
          )}
        </div>
      </div>
    )
  }

  const isKnownFood = result.label !== 'unknown'
  const isTextRecognition = result.source === 'text-recognition'

  return (
    <div
      className={`ar-food-label${position ? ` ar-food-label--${position.placement}` : ''}`}
      role="status"
      aria-live="polite"
      style={labelStyle}
    >
      <div className="ar-food-label__panel" key={result.label}>
        <span className="ar-food-label__eyebrow">
          {result.label === 'monster-energy'
            ? 'PRODUKTTEKST GJENKJENT'
            : isKnownFood
              ? 'MATVARE GJENKJENT'
              : 'INGEN SIKKER MATCH'}
        </span>
        {result.label === 'monster-energy' ? (
          <span className="ar-food-label__title">Monster Energy</span>
        ) : isKnownFood ? (
          <>
            <span className="ar-food-label__intro">
              Dette er {result.label === 'banana' ? 'en' : 'et'}
            </span>
            <span className="ar-food-label__title">
              {FOOD_NAMES[result.label]}
            </span>
          </>
        ) : (
          <span className="ar-food-label__title">
            {FOOD_NAMES[result.label]}
          </span>
        )}
        {result.recognizedText && result.label === 'monster-energy' && (
          <span className="ar-food-label__recognized-text">
            {result.recognizedText}
          </span>
        )}
        {result.confidence !== null && (
          <span className="ar-food-label__detail">
            {isTextRecognition ? 'OCR-score' : 'Objektscore'}{' '}
            {(result.confidence * 100).toFixed(0)}%
          </span>
        )}
        {textError && (
          <span className="ar-food-label__detail">
            Tekstlesing utilgjengelig
          </span>
        )}
      </div>
    </div>
  )
}
