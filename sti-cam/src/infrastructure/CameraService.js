/**
 * Infraestructura: CameraService
 * Abstrae el acceso a la cámara del dispositivo via getUserMedia.
 */

const ASPECT_RATIOS = {
  '4:3':  { w: 4, h: 3 },
  '16:9': { w: 16, h: 9 },
  '1:1':  { w: 1, h: 1 },
  'full': null,
};

export class CameraService {
  constructor() {
    this.stream = null;
    this.videoElement = null;
    this.canvas = document.createElement('canvas');
    this.capabilities = null;
  }

  /**
   * Inicia la cámara y vincula al elemento <video>.
   * @param {HTMLVideoElement} videoEl
   * @returns {Promise<{width: number, height: number}>} resolución del video
   */
  async start(videoEl) {
    this.videoElement = videoEl;

    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 3840 },
        height: { ideal: 2160 },
      },
      audio: false,
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = this.stream;

    return new Promise((resolve) => {
      videoEl.onloadedmetadata = () => {
        videoEl.play();
        const track = this.stream.getVideoTracks()[0];
        const settings = track.getSettings();
        this.capabilities = track.getCapabilities?.() || {};
        resolve({ width: settings.width, height: settings.height });
      };
    });
  }

  /**
   * Captura un frame del video como Blob JPEG.
   * @param {string} aspectId - '4:3', '16:9', '1:1', 'full'
   * @param {number} quality - JPEG quality 0-1
   * @returns {Promise<Blob>}
   */
  capture(aspectId = '4:3', quality = 0.92) {
    return new Promise((resolve, reject) => {
      if (!this.videoElement) {
        reject(new Error('Camera not started'));
        return;
      }

      const video = this.videoElement;
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      let sx = 0, sy = 0, sw = vw, sh = vh;

      const ratio = ASPECT_RATIOS[aspectId];
      if (ratio) {
        // En modo retrato (celular), invertimos la proporción
        const targetRatio = ratio.h / ratio.w; // Portrait: h > w
        const currentRatio = vh / vw;

        if (currentRatio > targetRatio) {
          // Video más alto → recortar arriba/abajo
          sh = Math.round(vw * targetRatio);
          sy = Math.round((vh - sh) / 2);
        } else {
          // Video más ancho → recortar lados
          sw = Math.round(vh / targetRatio);
          sx = Math.round((vw - sw) / 2);
        }
      }

      this.canvas.width = sw;
      this.canvas.height = sh;

      const ctx = this.canvas.getContext('2d');
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

      this.canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to capture frame'));
        },
        'image/jpeg',
        quality
      );
    });
  }

  /**
   * Verifica si el dispositivo tiene torch (flash).
   */
  hasTorch() {
    return !!this.capabilities?.torch;
  }

  /**
   * Activa/desactiva el flash.
   */
  async setTorch(enabled) {
    if (!this.stream) return;
    const track = this.stream.getVideoTracks()[0];
    try {
      await track.applyConstraints({ advanced: [{ torch: enabled }] });
    } catch {
      // torch no soportado
    }
  }

  /**
   * Detiene la cámara y libera recursos.
   */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }
}
