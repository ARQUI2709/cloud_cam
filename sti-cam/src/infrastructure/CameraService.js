/**
 * Infraestructura: CameraService
 * Abstrae el acceso a la cámara del dispositivo via getUserMedia.
 */

import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';

const ASPECT_RATIOS = {
  '4:3':  { w: 4, h: 3 },
  '16:9': { w: 16, h: 9 },
  '1:1':  { w: 1, h: 1 },
  'full': null,
};

// Module-level cached stream — reused across CameraService instances
// so the browser doesn't re-prompt for camera permission each time.
let cachedStream = null;

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
  async start(videoEl, deviceId) {
    this.videoElement = videoEl;

    // Reuse cached stream only if no specific deviceId is requested
    const canReuse = !deviceId &&
      cachedStream &&
      cachedStream.getVideoTracks().length > 0 &&
      cachedStream.getVideoTracks()[0].readyState === 'live';

    if (canReuse) {
      this.stream = cachedStream;
    } else {
      // Stop previous cached stream before switching device
      if (cachedStream) {
        cachedStream.getTracks().forEach((t) => t.stop());
        cachedStream = null;
      }

      // On native (Capacitor), request camera permission via native dialog first
      if (Capacitor.isNativePlatform()) {
        const perms = await Camera.requestPermissions({ permissions: ['camera'] });
        if (perms.camera !== 'granted') {
          const err = new Error('Camera permission denied');
          err.name = 'NotAllowedError'; // useCamera.js already handles this error name
          throw err;
        }
      }

      const videoConstraints = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 3840 }, height: { ideal: 2160 } }
        : { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } };

      const constraints = { video: videoConstraints, audio: false };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      cachedStream = this.stream;
    }

    videoEl.srcObject = this.stream;

    return new Promise((resolve) => {
      videoEl.onloadedmetadata = () => {
        videoEl.play();
        const track = this.stream.getVideoTracks()[0];
        this.capabilities = track.getCapabilities?.() || {};
        // Return zoom range if the device supports it
        const zoomCaps = this.capabilities.zoom
          ? {
              min: this.capabilities.zoom.min ?? 1,
              max: this.capabilities.zoom.max ?? 1,
              step: this.capabilities.zoom.step ?? 0.1,
            }
          : null;
        resolve(zoomCaps);
      };
    });
  }

  /**
   * Returns current camera settings to store as capture metadata.
   * @returns {object} flat key-value object safe for Drive properties
   */
  getCaptureInfo() {
    if (!this.stream) return {};
    const track = this.stream.getVideoTracks()[0];
    if (!track) return {};
    const s = track.getSettings();
    const info = {};
    if (s.width && s.height)   { info.width = String(s.width); info.height = String(s.height); }
    if (s.frameRate)            info.frameRate = String(Math.round(s.frameRate));
    if (s.zoom)                 info.zoom = String(s.zoom);
    if (s.facingMode)           info.facingMode = s.facingMode;
    // Track label often contains lens/device info on mobile (e.g. "Back Ultra Wide Camera")
    if (track.label)            info.lens = track.label;
    // Device model from userAgent (best-effort)
    const ua = navigator.userAgent;
    const iphone = ua.match(/iPhone/);
    const android = ua.match(/\(Linux.*;\s([^)]+)\)/);
    if (iphone)                 info.device = 'Apple iPhone';
    else if (android?.[1])      info.device = android[1].split(';').pop().trim();
    return info;
  }

  /**
   * Applies optical/digital zoom via track constraints.
   * @param {number} value - zoom level within capabilities range
   */
  async setZoom(value) {
    if (!this.stream) return;
    const track = this.stream.getVideoTracks()[0];
    try {
      await track.applyConstraints({ advanced: [{ zoom: value }] });
    } catch {
      // zoom not supported on this device/browser
    }
  }

  /**
   * Captura un frame del video como Blob JPEG.
   * Uses the visual dimensions of the video (as displayed on screen)
   * to ensure correct orientation on mobile devices.
   * @param {string} aspectId - '4:3', '16:9', '1:1', 'full'
   * @param {number} quality - JPEG quality 0-1
   * @returns {Promise<Blob>}
   */
  capture(aspectId = '4:3', quality = 0.97) {
    return new Promise(async (resolve, reject) => {
      if (!this.videoElement) {
        reject(new Error('Camera not started'));
        return;
      }

      const video = this.videoElement;

      // Prefer ImageCapture API — grabs full-resolution frame directly from sensor.
      // Falls back to createImageBitmap using video.videoWidth/videoHeight (native
      // stream resolution, not the rendered element size).
      let bitmap;
      let nativeW = video.videoWidth  || 1920;
      let nativeH = video.videoHeight || 1080;
      try {
        const track = this.stream?.getVideoTracks()[0];
        if (track && typeof ImageCapture !== 'undefined') {
          const imageCapture = new ImageCapture(track);
          bitmap = await imageCapture.grabFrame();
          nativeW = bitmap.width;
          nativeH = bitmap.height;
        } else {
          bitmap = await createImageBitmap(video, 0, 0, nativeW, nativeH);
        }
      } catch {
        try {
          bitmap = await createImageBitmap(video, 0, 0, nativeW, nativeH);
        } catch {
          try {
            bitmap = await createImageBitmap(video);
          } catch {
            reject(new Error('Failed to capture frame'));
            return;
          }
        }
      }

      const bw = bitmap.width  || nativeW;
      const bh = bitmap.height || nativeH;

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
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

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
   * The stream is kept alive (cached) so re-opening the camera
   * doesn't trigger a new permission prompt on mobile browsers.
   */
  stop() {
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
    this.stream = null;
  }

  /**
   * Fully releases the camera stream and clears the cache.
   * Call this only when the user logs out or the app is closing.
   */
  static release() {
    if (cachedStream) {
      cachedStream.getTracks().forEach((t) => t.stop());
      cachedStream = null;
    }
  }
}
