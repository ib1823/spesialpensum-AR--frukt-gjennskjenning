export type RecognitionLabel = 'banana' | 'apple' | 'unknown'

export type RecognitionResult = {
  label: RecognitionLabel
  confidence: number | null
}

export type RecognitionStatus = 'idle' | 'loading' | 'ready' | 'error'
