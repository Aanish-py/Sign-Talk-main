import { useState, useEffect, useRef, useCallback } from 'react';
import { handLandmarkerService } from './handLandmarkerService';
import { drawHandSkeleton, clearCanvas } from './drawingUtils';
import { normalizeLandmarks, getFingerExtensionStates } from './landmarkNormalizer';

/**
 * Custom React Hook for Real-time MediaPipe Hand Tracking
 * 
 * @param {React.RefObject<HTMLVideoElement>} videoRef 
 * @param {React.RefObject<HTMLCanvasElement>} canvasRef 
 * @param {Object} config 
 */
export function useHandTracker(videoRef, canvasRef, config = {}) {
  const {
    enabled = true,
    showSkeleton = true,
    onResults = null
  } = config;

  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelError, setModelError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  // Real-time tracking metrics
  const [fps, setFps] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);
  const [detectedHandsCount, setDetectedHandsCount] = useState(0);
  const [handednessList, setHandednessList] = useState([]);
  const [fingerStates, setFingerStates] = useState(null);
  const [latestNormalizedVectors, setLatestNormalizedVectors] = useState([]);

  const animFrameIdRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const fpsFrameCountRef = useRef(0);
  const fpsLastTimeRef = useRef(performance.now());
  const isDestroyedRef = useRef(false);

  // Initialize MediaPipe model
  useEffect(() => {
    isDestroyedRef.current = false;
    let isMounted = true;

    async function init() {
      setIsModelLoading(true);
      setModelError(null);
      try {
        await handLandmarkerService.initialize();
        if (isMounted) {
          setIsModelLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('[useHandTracker] Initialization error:', err);
          setModelError(err.message || 'Failed to initialize hand tracker');
          setIsModelLoading(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
      isDestroyedRef.current = true;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, []);

  // Frame processing loop
  const processFrame = useCallback(() => {
    if (isDestroyedRef.current || !enabled) {
      return;
    }

    const video = videoRef?.current;
    const canvas = canvasRef?.current;

    if (
      video &&
      video.readyState >= 2 && // HAVE_CURRENT_DATA
      !video.paused &&
      !video.ended &&
      handLandmarkerService.isReady()
    ) {
      const now = performance.now();

      // Check if video frame timestamp has updated
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;

        // Synchronize canvas dimensions with video stream
        if (canvas) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
          }
        }

        // Run detection and measure inference latency
        const startTime = performance.now();
        const results = handLandmarkerService.detectForVideo(video, now);
        const inferenceDuration = Math.round(performance.now() - startTime);
        setLatencyMs(inferenceDuration);

        // Calculate FPS
        fpsFrameCountRef.current++;
        if (now - fpsLastTimeRef.current >= 500) {
          const currentFps = Math.round((fpsFrameCountRef.current * 1000) / (now - fpsLastTimeRef.current));
          setFps(currentFps);
          fpsFrameCountRef.current = 0;
          fpsLastTimeRef.current = now;
        }

        if (canvas) {
          const ctx = canvas.getContext('2d');
          clearCanvas(canvas, ctx);

          if (results && results.landmarks && results.landmarks.length > 0) {
            setDetectedHandsCount(results.landmarks.length);
            
            // Extract handedness
            const handedness = results.handednesses || [];
            setHandednessList(handedness.map(h => h[0]?.categoryName || 'Hand'));

            // Extract normalized vectors for all detected hands
            const normalizedVectors = results.landmarks.map(lm => normalizeLandmarks(lm)).filter(Boolean);
            setLatestNormalizedVectors(normalizedVectors);

            // Compute finger extension states for the primary hand
            if (results.landmarks[0]) {
              setFingerStates(getFingerExtensionStates(results.landmarks[0]));
            }

            // Draw skeleton overlay
            if (showSkeleton) {
              drawHandSkeleton(ctx, results.landmarks, handedness, canvas.width, canvas.height);
            }

            // Notify consumer callback
            if (onResults) {
              onResults({
                results,
                normalizedVectors,
                timestamp: now
              });
            }
          } else {
            setDetectedHandsCount(0);
            setHandednessList([]);
            setFingerStates(null);
            setLatestNormalizedVectors([]);
          }
        }
      }
    } else if (canvas) {
      // Clear canvas if video is not playing
      const ctx = canvas.getContext('2d');
      clearCanvas(canvas, ctx);
    }

    animFrameIdRef.current = requestAnimationFrame(processFrame);
  }, [enabled, showSkeleton, onResults, videoRef, canvasRef]);

  // Start / stop tracking loop
  useEffect(() => {
    if (enabled && !isModelLoading && !modelError) {
      setIsTracking(true);
      animFrameIdRef.current = requestAnimationFrame(processFrame);
    } else {
      setIsTracking(false);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    }

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [enabled, isModelLoading, modelError, processFrame]);

  return {
    isModelLoading,
    modelError,
    isTracking,
    fps,
    latencyMs,
    detectedHandsCount,
    handednessList,
    fingerStates,
    latestNormalizedVectors
  };
}
