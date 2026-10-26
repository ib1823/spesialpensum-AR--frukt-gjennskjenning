export function isCameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  )
}

export async function requestCameraStream(): Promise<MediaStream> {
  if (!isCameraSupported()) {
    throw new Error(
      'Nettleseren støtter ikke kamera. Prøv en oppdatert versjon av Safari eller Chrome.',
    )
  }

  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
    },
  })
}

export function stopCameraStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop())
}

export function getCameraErrorMessage(error: unknown): string {
  if (error instanceof Error && !(error instanceof DOMException)) {
    return error.message
  }

  if (!(error instanceof DOMException)) {
    return 'Kameraet kunne ikke startes. Prøv igjen.'
  }

  switch (error.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Kameratilgang ble avvist. Tillat kamera i nettleserinnstillingene og prøv igjen.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Fant ingen tilgjengelig kamera på denne enheten.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Kameraet er opptatt eller kan ikke startes. Lukk andre apper som bruker kameraet, og prøv igjen.'
    case 'OverconstrainedError':
      return 'Fant ikke et kamera som støtter de ønskede innstillingene.'
    default:
      return 'Kameraet kunne ikke startes. Kontroller kameratilgangen og prøv igjen.'
  }
}
