import { useState, useRef, useCallback, useEffect } from 'react';
import { CameraService } from '../infrastructure/CameraService';

/**
 * Hook para controlar la cámara.
 * Abstrae start/stop/capture y maneja el ciclo de vida.
 */
export function useCamera() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [resolution, setResolution] = useState(null);
  const cameraRef = useRef(null);
  const videoRef = useRef(null);

  const start = useCallback(async (videoElement) => {
    setError(null);
    setIsReady(false);

    try {
      const camera = new CameraService();
      cameraRef.current = camera;
      videoRef.current = videoElement;

      const res = await camera.start(videoElement);
      setResolution(res);
      setIsReady(true);
    } catch (err) {
      const message =
        err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Habilítalo en ajustes del navegador.'
          : err.name === 'NotFoundError'
          ? 'No se encontró cámara en este dispositivo.'
          : `Error de cámara: ${err.message}`;
      setError(message);
    }
  }, []);

  const capture = useCallback(async (aspectId = '4:3') => {
    if (!cameraRef.current || !isReady) return null;
    try {
      return await cameraRef.current.capture(aspectId);
    } catch (err) {
      console.error('Capture failed:', err);
      return null;
    }
  }, [isReady]);

  const stop = useCallback(() => {
    cameraRef.current?.stop();
    cameraRef.current = null;
    setIsReady(false);
    setResolution(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cameraRef.current?.stop();
    };
  }, []);

  return {
    isReady,
    error,
    resolution,
    start,
    capture,
    stop,
    hasTorch: () => cameraRef.current?.hasTorch() || false,
    setTorch: (on) => cameraRef.current?.setTorch(on),
  };
}
