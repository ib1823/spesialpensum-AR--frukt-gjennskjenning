import * as ort from 'onnxruntime-web/wasm'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import { createFrameTensor } from './framePreprocessor'
import type { RecognitionResult } from '../types/recognition'

const MODEL_URL = `${import.meta.env.BASE_URL}models/ssd-mobilenet-v1-12-int8.onnx`

export const MIN_RECOGNITION_CONFIDENCE = 0.45

const BANANA_CLASS_ID = 52
const APPLE_CLASS_ID = 53
const REQUIRED_OUTPUTS = [
  'detection_boxes',
  'detection_classes',
  'detection_scores',
  'num_detections',
]

export async function loadRecognitionModel(): Promise<ort.InferenceSession> {
  ort.env.wasm.numThreads = 1
  ort.env.wasm.proxy = true
  ort.env.wasm.wasmPaths = { wasm: wasmUrl }

  const session = await ort.InferenceSession.create(MODEL_URL, {
    executionProviders: ['wasm'],
  })

  if (REQUIRED_OUTPUTS.some((name) => !session.outputNames.includes(name))) {
    await session.release()
    throw new Error('AI-modellen har et uventet utdataformat.')
  }

  return session
}

export async function recognizeFrame(
  session: ort.InferenceSession,
  video: HTMLVideoElement,
): Promise<RecognitionResult | null> {
  const input = createFrameTensor(video)
  if (!input) {
    return null
  }

  const output = await session.run({ [session.inputNames[0]]: input })
  const detections = {
    classes: output.detection_classes.data,
    count: output.num_detections.data[0],
    scores: output.detection_scores.data,
  }
  const count = Math.min(10, Math.floor(Number(detections.count)))
  let bestResult: RecognitionResult | null = null

  for (let index = 0; index < count; index += 1) {
    const classId = Math.round(Number(detections.classes[index]))
    const confidence = Number(detections.scores[index])
    const label =
      classId === BANANA_CLASS_ID
        ? 'banana'
        : classId === APPLE_CLASS_ID
          ? 'apple'
          : null

    if (
      label &&
      confidence >= MIN_RECOGNITION_CONFIDENCE &&
      (!bestResult || confidence > (bestResult.confidence ?? 0))
    ) {
      bestResult = { label, confidence }
    }
  }

  return bestResult ?? { label: 'unknown', confidence: null }
}
