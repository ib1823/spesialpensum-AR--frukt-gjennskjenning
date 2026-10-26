import * as ort from 'onnxruntime-web/wasm'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import type {
  FoodCategory,
  RecognitionBox,
  RecognitionResult,
} from '../types/recognition'

const MODEL_URL = `${import.meta.env.BASE_URL}models/ssd-mobilenet-v1-12-int8.onnx`
const MIN_RECOGNITION_CONFIDENCE = 0.45
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

const COCO_LABELS: Record<number, string> = {
  1: 'person',
  2: 'sykkel',
  3: 'bil',
  4: 'motorsykkel',
  5: 'fly',
  6: 'buss',
  7: 'tog',
  8: 'lastebil',
  9: 'båt',
  10: 'trafikklys',
  11: 'brannhydrant',
  13: 'stoppskilt',
  14: 'parkeringsautomat',
  15: 'benk',
  16: 'fugl',
  17: 'katt',
  18: 'hund',
  19: 'hest',
  20: 'sau',
  21: 'ku',
  22: 'elefant',
  23: 'bjørn',
  24: 'sebra',
  25: 'sjiraff',
  27: 'ryggsekk',
  28: 'paraply',
  31: 'håndveske',
  32: 'slips',
  33: 'koffert',
  34: 'frisbee',
  35: 'ski',
  36: 'snowboard',
  37: 'ball',
  38: 'drage',
  39: 'baseballkølle',
  40: 'baseballhanske',
  41: 'skateboard',
  42: 'surfebrett',
  43: 'tennisracket',
  44: 'flaske',
  46: 'vinglass',
  47: 'kopp',
  48: 'gaffel',
  49: 'kniv',
  50: 'skje',
  51: 'bolle',
  52: 'banan',
  53: 'eple',
  54: 'smørbrød',
  55: 'appelsin',
  56: 'brokkoli',
  57: 'gulrot',
  58: 'pølse i brød',
  59: 'pizza',
  60: 'smultring',
  61: 'kake',
  62: 'stol',
  63: 'sofa',
  64: 'potteplante',
  65: 'seng',
  67: 'spisebord',
  70: 'toalett',
  72: 'TV',
  73: 'bærbar PC',
  74: 'mus',
  75: 'fjernkontroll',
  76: 'tastatur',
  77: 'mobiltelefon',
  78: 'mikrobølgeovn',
  79: 'stekeovn',
  80: 'brødrister',
  81: 'vask',
  82: 'kjøleskap',
  84: 'bok',
  85: 'klokke',
  86: 'vase',
  87: 'saks',
  88: 'bamse',
  89: 'hårføner',
  90: 'tannbørste',
}

const FOOD_LABELS: Record<number, 'banana' | 'apple'> = {
  52: 'banana',
  53: 'apple',
}

const FOOD_CATEGORIES: Partial<Record<number, FoodCategory>> = {
  52: 'banana',
  53: 'apple',
  54: 'sandwich',
  55: 'orange',
  56: 'broccoli',
  57: 'carrot',
  58: 'hot-dog',
  59: 'pizza',
  60: 'donut',
  61: 'cake',
}

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
    if (confidence < MIN_RECOGNITION_CONFIDENCE) {
      continue
    }

    const foodLabel = FOOD_LABELS[classId]
    const objectName = COCO_LABELS[classId]
    const foodCategory = FOOD_CATEGORIES[classId]
    if (foodLabel || objectName) {
      const detection: RecognitionResult = foodLabel
        ? {
            label: foodLabel,
            confidence,
            box,
            source: 'object-detection',
            foodCategory,
          }
        : {
            label: 'object',
            confidence,
            box,
            recognizedText: objectName,
            source: 'object-detection',
            foodCategory,
          }

      if (!bestResult || confidence > (bestResult.confidence ?? 0)) {
        bestResult = detection
      }
    }
  }

  return bestResult ?? {
    label: 'unknown',
    confidence: null,
    box: null,
    source: 'object-detection',
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
