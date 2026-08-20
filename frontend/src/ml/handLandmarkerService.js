import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

/**
 * HandLandmarkerService
 * 
 * Manages the lifecycle of MediaPipe Hands vision task:
 * - Lazy initialization of WASM binaries and the neural network task file
 * - GPU acceleration with graceful CPU fallback
 * - Real-time video frame detection
 */
class HandLandmarkerService {
  constructor() {
    this.handLandmarker = null;
    this.isLoading = false;
    this.initPromise = null;
    this.error = null;
  }

  /**
   * Initializes the HandLandmarker model if not already loaded.
   */
  async initialize() {
    if (this.handLandmarker) {
      return this.handLandmarker;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.isLoading = true;
    this.error = null;

    this.initPromise = (async () => {
      try {
        console.log('[MediaPipe] Initializing FilesetResolver...');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );

        console.log('[MediaPipe] Loading HandLandmarker model...');
        
        let landmarker;
        try {
          // Attempt GPU delegate first for optimal FPS
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
          });
          console.log('[MediaPipe] HandLandmarker initialized with GPU delegate.');
        } catch (gpuError) {
          console.warn('[MediaPipe] GPU delegate failed, falling back to CPU:', gpuError);
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'CPU'
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
          });
          console.log('[MediaPipe] HandLandmarker initialized with CPU delegate.');
        }

        this.handLandmarker = landmarker;
        this.isLoading = false;
        return landmarker;
      } catch (err) {
        console.error('[MediaPipe] Failed to initialize HandLandmarker:', err);
        this.error = err;
        this.isLoading = false;
        this.initPromise = null;
        throw err;
      }
    })();

    return this.initPromise;
  }

  /**
   * Detects hand landmarks in a single video frame.
   * 
   * @param {HTMLVideoElement} videoElement 
   * @param {number} timestampMs 
   * @returns {HandLandmarkerResult | null}
   */
  detectForVideo(videoElement, timestampMs) {
    if (!this.handLandmarker) {
      return null;
    }

    if (!videoElement || videoElement.readyState < 2) {
      return null;
    }

    try {
      return this.handLandmarker.detectForVideo(videoElement, timestampMs);
    } catch (err) {
      console.warn('[MediaPipe] detectForVideo frame skipped:', err.message);
      return null;
    }
  }

  isReady() {
    return !!this.handLandmarker;
  }

  close() {
    if (this.handLandmarker) {
      try {
        this.handLandmarker.close();
      } catch (e) {
        // ignore close errors
      }
      this.handLandmarker = null;
      this.initPromise = null;
    }
  }
}

// Export singleton instance
export const handLandmarkerService = new HandLandmarkerService();
