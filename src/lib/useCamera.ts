import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable'

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const smallCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [canSwitchCamera, setCanSwitchCamera] = useState(false)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async (mode: 'environment' | 'user' = facingMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable')
      return
    }
    setStatus('requesting')
    stop()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setFacingMode(mode)
      setStatus('ready')

      const devices = await navigator.mediaDevices.enumerateDevices()
      setCanSwitchCamera(devices.filter((d) => d.kind === 'videoinput').length > 1)
    } catch (err) {
      const name = (err as DOMException)?.name
      setStatus(name === 'NotAllowedError' || name === 'PermissionDeniedError' ? 'denied' : 'unavailable')
    }
  }, [facingMode, stop])

  const switchCamera = useCallback(() => {
    start(facingMode === 'environment' ? 'user' : 'environment')
  }, [facingMode, start])

  const capture = useCallback((): { imageData: ImageData; dataUrl: string } | null => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    return {
      imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
      dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    }
  }, [])

  /** Cheap, reduced-resolution frame grab for per-tick analysis (reuses one small canvas, no per-call allocation). */
  const captureSmall = useCallback((targetWidth = 160): ImageData | null => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return null
    if (!smallCanvasRef.current) smallCanvasRef.current = document.createElement('canvas')
    const canvas = smallCanvasRef.current
    const scale = targetWidth / video.videoWidth
    canvas.width = targetWidth
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }, [])

  useEffect(() => stop, [stop])

  return { videoRef, status, start, stop, switchCamera, canSwitchCamera, capture, captureSmall, facingMode }
}
