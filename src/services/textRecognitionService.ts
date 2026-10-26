import type { RecognitionResult } from '../types/recognition'

type WorkerCommand =
  | { type: 'load' }
  | {
      type: 'recognize'
      image: Blob
      width: number
      height: number
    }
  | { type: 'release' }

type WorkerRequest = WorkerCommand & { id: number }

type WorkerResponse = {
  id: number
  result?: RecognitionResult | null
  error?: string
}

type PendingRequest = {
  resolve: (response: WorkerResponse) => void
  reject: (error: Error) => void
}

const MAX_IMAGE_EDGE = 960

export class TextRecognitionService {
  private readonly worker: Worker
  private nextRequestId = 0
  private readonly pending = new Map<number, PendingRequest>()
  private disposed = false
  private workerFailure: Error | null = null
  private canvasWidth = 0
  private canvasHeight = 0

  constructor() {
    this.worker = new Worker(
      new URL('../workers/textRecognition.worker.ts', import.meta.url),
      { type: 'module' },
    )
    this.worker.addEventListener('message', this.handleMessage)
    this.worker.addEventListener('error', this.handleWorkerError)
    this.worker.addEventListener('messageerror', this.handleMessageError)
  }

  async load(): Promise<void> {
    await this.send({ type: 'load' })
  }

  async recognizeFrame(
    video: HTMLVideoElement,
  ): Promise<RecognitionResult | null> {
    const image = await this.captureFrame(video)
    const response = await this.send({
      type: 'recognize',
      image,
      width: this.canvasWidth,
      height: this.canvasHeight,
    })

    if (response.result === undefined) {
      throw new Error('Tekstleseren returnerte ikke et resultat.')
    }

    return response.result
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return
    }

    try {
      if (!this.workerFailure) {
        await this.send({ type: 'release' })
      }
    } finally {
      this.disposed = true
      this.worker.removeEventListener('message', this.handleMessage)
      this.worker.removeEventListener('error', this.handleWorkerError)
      this.worker.removeEventListener('messageerror', this.handleMessageError)
      this.worker.terminate()
      this.rejectPending(new Error('Tekstgjenkjenningen ble avsluttet.'))
    }
  }

  private async captureFrame(video: HTMLVideoElement): Promise<Blob> {
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error('Kamerabilde er ikke klart for tekstgjenkjenning.')
    }

    const scale = Math.min(
      1,
      MAX_IMAGE_EDGE / Math.max(video.videoWidth, video.videoHeight),
    )
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    this.canvasWidth = canvas.width
    this.canvasHeight = canvas.height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Nettleseren kunne ikke klargjøre bildet for tekstlesing.')
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const image = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.88),
    )
    if (!image) {
      throw new Error('Kamerabildet kunne ikke klargjøres for tekstlesing.')
    }

    return image
  }

  private send(request: WorkerCommand): Promise<WorkerResponse> {
    if (this.disposed) {
      return Promise.reject(new Error('Tekstgjenkjenningen er avsluttet.'))
    }
    if (this.workerFailure) {
      return Promise.reject(this.workerFailure)
    }

    const id = ++this.nextRequestId
    const fullRequest: WorkerRequest = { ...request, id }

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      try {
        this.worker.postMessage(fullRequest)
      } catch (error) {
        this.pending.delete(id)
        reject(
          error instanceof Error
            ? error
            : new Error('Tekstleserens forespørsel kunne ikke sendes.'),
        )
      }
    })
  }

  private readonly handleMessage = (event: MessageEvent<WorkerResponse>) => {
    const request = this.pending.get(event.data.id)
    if (!request) {
      return
    }

    this.pending.delete(event.data.id)
    if (event.data.error) {
      request.reject(new Error(event.data.error))
    } else {
      request.resolve(event.data)
    }
  }

  private readonly handleWorkerError = (event: ErrorEvent) => {
    event.preventDefault()
    this.failWorker(
      new Error(event.message || 'Tekstleserens arbeider kunne ikke startes.'),
    )
  }

  private readonly handleMessageError = () => {
    this.failWorker(new Error('Svar fra tekstleseren kunne ikke leses.'))
  }

  private failWorker(error: Error): void {
    this.workerFailure = error
    this.worker.terminate()
    this.rejectPending(error)
  }

  private rejectPending(error: Error): void {
    for (const request of this.pending.values()) {
      request.reject(error)
    }
    this.pending.clear()
  }
}
