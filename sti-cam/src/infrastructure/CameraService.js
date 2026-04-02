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
   * Uses the visual dimensions of the video (as displayed on screen)
   * to ensure correct orientation on mobile devices.
   * @param {string} aspectId - '4:3', '16:9', '1:1', 'full'
   * @param {number} quality - JPEG quality 0-1
   * @returns {Promise<Blob>}
   */
  capture(aspectId = '4:3', quality = 0.92) {
    return new Promise(async (resolve, reject) => {
      if (!this.videoElement) {
        reject(new Error('Camera not started'));
        return;
      }

      const video = this.videoElement;

      // Use createImageBitmap to get a correctly oriented bitmap
      let bitmap;
      try {
        bitmap = await createImageBitmap(video);
      } catch {
        reject(new Error('Failed to create bitmap from video'));
        return;
      }

      const bw = bitmap.width;
      const bh = bitmap.height;

      // On mobile in portrait, the bitmap may still be landscape.
      // Check if we need to treat it as portrait.
      const isPortrait = window.innerHeight > window.innerWidth;
      const bitmapIsLandscape = bw > bh;
      const needsRotation = isPortrait && bitmapIsLandscape;

      // Effective dimensions (as the user sees the preview)
      const ew = needsRotation ? bh : bw;
      const eh = needsRotation ? bw : bh;

      let cx = 0, cy = 0, cw = ew, ch = eh;

      const ratio = ASPECT_RATIOS[aspectId];
      if (ratio) {
        // In portrait mode: photo should be taller than wide (e.g. 4:3 → 3w:4h)
        // In landscape mode: photo should be wider than tall (e.g. 4:3 → 4w:3h)
        const isDevicePortrait = window.innerHeight > window.innerWidth;
        const targetRatio = isDevicePortrait
          ? ratio.w / ratio.h   // portrait: e.g. 4:3 → 4/3 = 1.33 (tall)
          : ratio.h / ratio.w;  // landscape: e.g. 4:3 → 3/4 = 0.75 (wide)
        const currentRatio = eh / ew;

        if (currentRatio > targetRatio) {
          ch = Math.round(ew * targetRatio);
          cy = Math.round((eh - ch) / 2);
        } else {
          cw = Math.round(eh / targetRatio);
          cx = Math.round((ew - cw) / 2);
        }
      }

      this.canvas.width = cw;
      this.canvas.height = ch;
      const ctx = this.canvas.getContext('2d');

      if (needsRotation) {
        // Draw rotated: the bitmap is landscape but we need portrait output
        ctx.save();
        ctx.translate(cw / 2, ch / 2);
        ctx.rotate(-Math.PI / 2);
        // After -90° rotation, map crop coords back to original bitmap space
        ctx.drawImage(bitmap, cy, cx, ch, cw, -ch / 2, -cw / 2, ch, cw);
        ctx.restore();
      } else {
        ctx.drawImage(bitmap, cx, cy, cw, ch, 0, 0, cw, ch);
      }

      bitmap.close();

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
