import { preprocessVideoFrame } from './framePreprocessor'
import type { RecognitionResult } from '../types/recognition'

type WorkerCommand =
  | { type: 'load' }
  | {
      type: 'recognize'
      data: Uint8Array
      width: number
      height: number
    }
  | { type: 'release' }

type WorkerRequest = WorkerCommand & { id: number }

type WorkerResponse = {
  id: number
  result?: RecognitionResult
  error?: string
}

type PendingRequest = {
  resolve: (response: WorkerResponse) => void
  reject: (error: Error) => void
}

export class RecognitionService {
  private readonly worker: Worker
  private nextRequestId = 0
  private readonly pending = new Map<number, PendingRequest>()
  private disposed = false
  private workerFailure: Error | null = null

  constructor() {
    this.worker = new Worker(
      new URL('../workers/recognition.worker.ts', import.meta.url),
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
    const frame = preprocessVideoFrame(video)
    if (!frame) {
      return null
    }

    const result = await this.send({
      type: 'recognize',
      data: frame.data,
      width: frame.width,
      height: frame.height,
    })

    if (!result.result) {
      throw new Error('AI-modellen returnerte ingen gjenkjenningsresultater.')
    }

    return result.result
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
      this.rejectPending(new Error('Matgjenkjenningen ble avsluttet.'))
    }
  }

  private send(request: WorkerCommand): Promise<WorkerResponse> {
    if (this.disposed) {
      return Promise.reject(new Error('Matgjenkjenningen er avsluttet.'))
    }

    const id = ++this.nextRequestId
    const fullRequest: WorkerRequest = { ...request, id }

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })

      try {
        if (fullRequest.type === 'recognize') {
          this.worker.postMessage(fullRequest, [fullRequest.data.buffer])
        } else {
          this.worker.postMessage(fullRequest)
        }
      } catch (error) {
        this.pending.delete(id)
        reject(
          error instanceof Error
            ? error
            : new Error('Forespørselen til AI-arbeideren kunne ikke sendes.'),
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
    this.failWorker(new Error(event.message || 'AI-arbeideren kunne ikke startes.'))
  }

  private readonly handleMessageError = () => {
    this.failWorker(new Error('Svar fra AI-arbeideren kunne ikke leses.'))
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
