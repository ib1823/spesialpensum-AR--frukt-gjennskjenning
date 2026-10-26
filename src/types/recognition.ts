export type RecognitionLabel =
  | 'banana'
  | 'apple'
  | 'monster-energy'
  | 'text'
  | 'object'
  | 'unknown'

export type FoodCategory =
  | 'banana'
  | 'apple'
  | 'orange'
  | 'broccoli'
  | 'carrot'
  | 'sandwich'
  | 'hot-dog'
  | 'pizza'
  | 'donut'
  | 'cake'
  | 'energy-drink'

export type RecognitionBox = {
  xMin: number
  yMin: number
  xMax: number
  yMax: number
}

export type RecognitionResult = {
  label: RecognitionLabel
  confidence: number | null
  box: RecognitionBox | null
  recognizedText?: string
  source?: 'object-detection' | 'text-recognition'
  foodCategory?: FoodCategory
}

export type RecognitionFrame = {
  result: RecognitionResult | null
  detections: RecognitionResult[]
}

export type TextRecognitionResult = {
  result: RecognitionResult | null
  error?: string
}

export type RecognitionStatus = 'idle' | 'loading' | 'ready' | 'error'
