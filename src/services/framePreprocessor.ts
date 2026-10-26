import { Tensor } from 'onnxruntime-web/wasm'

const MAX_FRAME_EDGE = 320

const canvas = document.createElement('canvas')
const context = canvas.getContext('2d', { willReadFrequently: true })

export function createFrameTensor(video: HTMLVideoElement): Tensor | null {
  if (!context || video.videoWidth === 0 || video.videoHeight === 0) {
    return null
  }

  const scale = Math.min(
    1,
    MAX_FRAME_EDGE / Math.max(video.videoWidth, video.videoHeight),
  )
  const width = Math.max(1, Math.round(video.videoWidth * scale))
  const height = Math.max(1, Math.round(video.videoHeight * scale))
  canvas.width = width
  canvas.height = height
  context.drawImage(video, 0, 0, width, height)

  const { data } = context.getImageData(0, 0, width, height)
  const input = new Uint8Array(width * height * 3)

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    input[pixel * 3] = data[pixel * 4]
    input[pixel * 3 + 1] = data[pixel * 4 + 1]
    input[pixel * 3 + 2] = data[pixel * 4 + 2]
  }

  return new Tensor('uint8', input, [1, height, width, 3])
}
