import * as ort from 'onnxruntime-web/wasm'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import type { RecognitionBox, RecognitionResult } from '../types/recognition'

const MODEL_URL = `${import.meta.env.BASE_URL}models/ssd-mobilenet-v1-12-int8.onnx`
const MIN_RECOGNITION_CONFIDENCE = 0.45
const BANANA_CLASS_ID = 52
const APPLE_CLASS_ID = 53
const REQUIRED_OUTPUTS = [
  'detection_boxes',
  'detection_classes',
  'detection_scores',
  'num_detections',
]

type WorkerRequest =
  | { id: number; type: 'load' }
  | {
      id: number
      type: 'recognize'
      data: Uint8Array
      width: number
      height: number
    }
  | { id: number; type: 'release' }

type WorkerResponse = {
  id: number
  result?: RecognitionResult
  error?: string
}

let session: ort.InferenceSession | null = null

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Ukjent feil ved lasting av AI-modellen.'
}

async function loadModel(): Promise<void> {
  ort.env.wasm.numThreads = 1
  ort.env.wasm.proxy = false
  ort.env.wasm.wasmPaths = { wasm: wasmUrl }

  const loadedSession = await ort.InferenceSession.create(MODEL_URL, {
    executionProviders: ['wasm'],
  })

  if (REQUIRED_OUTPUTS.some((name) => !loadedSession.outputNames.includes(name))) {
    await loadedSession.release()
    throw new Error('AI-modellen har et uventet utdataformat.')
  }

  session = loadedSession
}

async function recognize(
  data: Uint8Array,
  width: number,
  height: number,
): Promise<RecognitionResult> {
  if (!session) {
    throw new Error('AI-modellen er ikke lastet.')
  }

  const input = new ort.Tensor('uint8', data, [1, height, width, 3])
  const outputs = await session.run({ [session.inputNames[0]]: input })
  const count = Math.min(
    10,
    Math.max(0, Math.floor(Number(outputs.num_detections.data[0]))),
  )
  const classes = outputs.detection_classes.data
  const scores = outputs.detection_scores.data
  let bestResult: RecognitionResult | null = null
  let bestDetection: RecognitionResult | null = null

  for (let index = 0; index < count; index += 1) {
    const classId = Math.round(Number(classes[index]))
    const confidence = Number(scores[index])
    const offset = index * 4
    const box: RecognitionBox = {
      yMin: Number(outputs.detection_boxes.data[offset]),
      xMin: Number(outputs.detection_boxes.data[offset + 1]),
      yMax: Number(outputs.detection_boxes.data[offset + 2]),
      xMax: Number(outputs.detection_boxes.data[offset + 3]),
    }
    const label =
      classId === BANANA_CLASS_ID
        ? 'banana'
        : classId === APPLE_CLASS_ID
          ? 'apple'
          : null

    if (
      confidence >= MIN_RECOGNITION_CONFIDENCE &&
      (!bestDetection || confidence > (bestDetection.confidence ?? 0))
    ) {
      bestDetection = { label: 'unknown', confidence, box }
    }

    if (
      label &&
      confidence >= MIN_RECOGNITION_CONFIDENCE &&
      (!bestResult || confidence > (bestResult.confidence ?? 0))
    ) {
      bestResult = { label, confidence, box }
    }
  }

  return bestResult ?? bestDetection ?? {
    label: 'unknown',
    confidence: null,
    box: null,
  }
}

async function handleRequest(request: WorkerRequest): Promise<WorkerResponse> {
  try {
    switch (request.type) {
      case 'load':
        await loadModel()
        return { id: request.id }
      case 'recognize':
        return {
          id: request.id,
          result: await recognize(request.data, request.width, request.height),
        }
      case 'release':
        if (session) {
          await session.release()
          session = null
        }
        return { id: request.id }
    }
  } catch (error) {
    return { id: request.id, error: toErrorMessage(error) }
  }
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  void handleRequest(event.data).then((response) => {
    self.postMessage(response)
  })
})
