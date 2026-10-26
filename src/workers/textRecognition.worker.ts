import Tesseract from 'tesseract.js'
import type {
  RecognitionBox,
  RecognitionResult,
} from '../types/recognition'

type WorkerRequest =
  | { id: number; type: 'load' }
  | {
      id: number
      type: 'recognize'
      image: Blob
      width: number
      height: number
    }
  | { id: number; type: 'release' }

type WorkerResponse = {
  id: number
  result?: RecognitionResult | null
  error?: string
}

type OCRWord = {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

let ocrWorker: Tesseract.Worker | null = null

function getWords(
  blocks: Tesseract.Block[] | null,
): OCRWord[] {
  return (blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.flatMap((line) =>
        line.words.map((word) => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox,
        })),
      ),
    ),
  )
}

async function loadOCR(): Promise<void> {
  if (ocrWorker) {
    return
  }

  ocrWorker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY)
  await ocrWorker.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
    tessedit_char_whitelist:
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&-',
    preserve_interword_spaces: '1',
  })
}

function getBrandBox(
  words: OCRWord[],
  imageWidth: number,
  imageHeight: number,
): RecognitionBox | null {
  const brandWords = words.filter(
    (word) =>
      word.confidence >= 50 && /^monster$/i.test(word.text.trim()),
  )
  if (!brandWords.length) {
    return null
  }

  return {
    xMin: Math.min(...brandWords.map((word) => word.bbox.x0)) / imageWidth,
    yMin: Math.min(...brandWords.map((word) => word.bbox.y0)) / imageHeight,
    xMax: Math.max(...brandWords.map((word) => word.bbox.x1)) / imageWidth,
    yMax: Math.max(...brandWords.map((word) => word.bbox.y1)) / imageHeight,
  }
}

async function recognizeText(
  image: Blob,
  width: number,
  height: number,
): Promise<RecognitionResult | null> {
  if (!ocrWorker) {
    throw new Error('Tekstleseren er ikke lastet.')
  }

  const {
    data: { text, confidence, blocks },
  } = await ocrWorker.recognize(image)
  const recognizedText = text.replace(/\s+/g, ' ').trim().slice(0, 80)
  const words = getWords(blocks)
  const brandWord = words.find(
    (word) =>
      word.confidence >= 50 && /^monster$/i.test(word.text.trim()),
  )

  if (!recognizedText || confidence < 35) {
    return null
  }

  return {
    label: brandWord ? 'monster-energy' : 'text',
    confidence: Math.max(0, Math.min(1, confidence / 100)),
    box: brandWord ? getBrandBox(words, width, height) : null,
    recognizedText,
    source: 'text-recognition',
    foodCategory: brandWord ? 'energy-drink' : undefined,
  }
}

async function handleRequest(request: WorkerRequest): Promise<WorkerResponse> {
  try {
    switch (request.type) {
      case 'load':
        await loadOCR()
        return { id: request.id }
      case 'recognize':
        return {
          id: request.id,
          result: await recognizeText(request.image, request.width, request.height),
        }
      case 'release':
        if (ocrWorker) {
          await ocrWorker.terminate()
          ocrWorker = null
        }
        return { id: request.id }
    }
  } catch (error) {
    return {
      id: request.id,
      error:
        error instanceof Error
          ? error.message
          : 'Tekst kunne ikke gjenkjennes fra kamerabildet.',
    }
  }
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  void handleRequest(event.data).then((response) => {
    self.postMessage(response)
  })
})
