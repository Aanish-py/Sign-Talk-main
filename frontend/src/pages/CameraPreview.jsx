import React, { useState, useEffect, useRef, useCallback } from 'react';
import VideoTile from '../components/VideoTile';
import PermissionPrompt from '../components/PermissionPrompt';
import { useHandTracker } from '../ml/useHandTracker';
import { signClassifierService } from '../ml/signClassifier';
import { GestureSmoother } from '../ml/gestureSmoother';
import { ttsService, sttService } from '../ml/speechEngine';
import {
  IconMic,
  IconMicOff,
  IconVideo,
  IconVideoOff,
  IconHandSign,
  IconCaptions,
  IconVolumeUp,
  IconVolumeOff,
  IconClose,
  IconInfo
} from '../components/Icons';

export default function CameraPreview({ onNavigate }) {
  const [stream, setStream] = useState(null);
  const streamRef = useRef(null); // always holds the current stream for cleanup
  const [permissionState, setPermissionState] = useState('prompt');
  const [errorDetails, setErrorDetails] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [streamStats, setStreamStats] = useState({ width: 0, height: 0, label: '' });

  // Feature Toggles
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [isTTSActive, setIsTTSActive] = useState(true);
  const [isSTTActive, setIsSTTActive] = useState(false);

  // Live Recognition State
  const [rawPrediction, setRawPrediction] = useState(null);
  const [smoothState, setSmoothState] = useState({
    stableSign: null,
    stabilityScore: 0,
    confidence: 0,
    isConfirmed: false,
    inCooldown: false
  });
  const [recentSpeechEvents, setRecentSpeechEvents] = useState([]);

  // Live STT Speech Transcripts
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscripts, setFinalTranscripts] = useState([]);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const smootherRef = useRef(new GestureSmoother({ windowSize: 10, minAgreementRatio: 0.7, minConfidence: 0.75 }));
  const isTTSActiveRef = useRef(isTTSActive);

  useEffect(() => {
    isTTSActiveRef.current = isTTSActive;
  }, [isTTSActive]);

  // Handle hand tracker results
  const handleResults = useCallback((data) => {
    const { normalizedVectors } = data;

    if (!normalizedVectors || normalizedVectors.length === 0 || isVideoDisabled) {
      setRawPrediction(null);
      const state = smootherRef.current.process(null);
      setSmoothState(state);
      return;
    }

    const primaryVector = normalizedVectors[0];

    if (signClassifierService.isReady) {
      const pred = signClassifierService.predict(primaryVector);
      setRawPrediction(pred);

      const state = smootherRef.current.process(pred, (confirmedSign) => {
        if (isTTSActiveRef.current) {
          ttsService.speak(confirmedSign.ttsText);
        }

        setRecentSpeechEvents((prev) => [
          {
            id: Date.now(),
            text: confirmedSign.ttsText,
            word: confirmedSign.name || confirmedSign.displayText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          },
          ...prev.slice(0, 9)
        ]);
      });

      setSmoothState(state);
    }
  }, [isVideoDisabled]);

  // MediaPipe Hand Tracker Hook
  const {
    isModelLoading,
    modelError,
    fps,
    latencyMs,
    detectedHandsCount,
    handednessList
  } = useHandTracker(videoRef, canvasRef, {
    enabled: isTrackingEnabled && permissionState === 'granted' && !isVideoDisabled,
    showSkeleton: showSkeleton,
    onResults: handleResults
  });

  // Initialize TF.js classifier on mount
  useEffect(() => {
    signClassifierService.initialize().catch((err) => {
      console.warn('Classifier auto-init:', err);
    });
  }, []);

  // Toggle Speech-to-Text
  const toggleSTT = () => {
    if (isSTTActive) {
      sttService.stop();
      setIsSTTActive(false);
      setInterimTranscript('');
    } else {
      const started = sttService.start({
        onInterim: (text) => setInterimTranscript(text),
        onFinal: (text) => {
          setFinalTranscripts((prev) => [text, ...prev.slice(0, 4)]);
          setInterimTranscript('');
        },
        onError: (err) => console.warn('STT Error:', err),
        onStatusChange: (status) => setIsSTTActive(status)
      });
      if (started) {
        setIsSTTActive(true);
      }
    }
  };

  // Start webcam
  const requestMediaAccess = async () => {
    try {
      setErrorDetails(null);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true
      });

      setStream(mediaStream);
      streamRef.current = mediaStream; // keep ref in sync
      setPermissionState('granted');

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        setStreamStats({
          width: settings.width || 640,
          height: settings.height || 480,
          label: videoTrack.label || 'Webcam'
        });
      }
    } catch (err) {
      console.error('Media access error:', err);
      setPermissionState('denied');

      let message = 'Unable to access your camera or microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera or microphone permission was denied. Please allow access in your browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera or microphone device was found.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Camera is currently in use by another application.';
      }

      setErrorDetails({ name: err.name, message });
    }
  };

  const toggleAudio = () => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoDisabled(!videoTrack.enabled);
    }
  };

  const releaseCamera = () => {
    sttService.stop();
    ttsService.cancel();
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
      setPermissionState('prompt');
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    requestMediaAccess();
    return () => {
      // Cleanup on unmount (navigating away from Live Studio).
      // Uses streamRef instead of stream state to avoid stale closure —
      // the stream state is always null in a [] closure captured at mount.
      sttService.stop();
      ttsService.cancel();
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      const s = streamRef.current;
      if (s) {
        s.getTracks().forEach((track) => {
          try {
            if (track.readyState !== 'ended') track.stop();
          } catch (_) { /* already stopped */ }
        });
        streamRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ flex: 1, backgroundColor: '#ffffff', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Live Studio
            </h1>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
              Hardware diagnostics, hand tracking visualization, and real-time translation testing.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { releaseCamera(); onNavigate('dashboard'); }}
          >
            Back to Home
          </button>
        </div>

        {isModelLoading && permissionState === 'granted' && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--accent-blue-light)', color: 'var(--accent-blue)', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IconInfo size={18} />
            <span>Loading hand tracking and sign recognition models...</span>
          </div>
        )}

        {modelError && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Error loading models: {modelError}
          </div>
        )}

        {permissionState !== 'granted' ? (
          <div className="card-white" style={{ maxWidth: '560px', margin: '2rem auto', textAlign: 'center' }}>
            <PermissionPrompt
              onRequestPermission={requestMediaAccess}
              errorState={errorDetails}
              onRetry={requestMediaAccess}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Main Video & Live HUD */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', maxHeight: '520px', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#202124', boxShadow: 'var(--shadow-md)' }}>
              <VideoTile
                stream={stream}
                videoRef={videoRef}
                canvasRef={canvasRef}
                label={streamStats.label || 'Webcam'}
                isLocal={true}
                isMuted={isAudioMuted}
                isVideoOff={isVideoDisabled}
                statusBadge={
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {isVideoDisabled || !isTrackingEnabled ? (
                      <span className="badge badge-gray">Tracking off</span>
                    ) : (
                      <span className="badge badge-green">
                        {fps} FPS | {latencyMs}ms
                      </span>
                    )}
                    {!isVideoDisabled && detectedHandsCount > 0 && (
                      <span className="badge badge-blue">
                        {detectedHandsCount} Hand ({handednessList.join(', ') || 'Tracked'})
                      </span>
                    )}
                  </div>
                }
              />

              {/* Overlaid Recognition Toast */}
              {rawPrediction && detectedHandsCount > 0 && !isVideoDisabled && (
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '0.85rem 1.25rem',
                  minWidth: '220px',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 20
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                      Predicted sign
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
                      {Math.round(rawPrediction.confidence * 100)}%
                    </span>
                  </div>

                  <div style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {rawPrediction.name || rawPrediction.displayText}
                  </div>

                  {/* Stability Progress Bar */}
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      <span>Stability</span>
                      <span>{Math.round(smoothState.stabilityScore * 100)}%</span>
                    </div>
                    <div style={{ height: '4px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.round(smoothState.stabilityScore * 100)}%`,
                          backgroundColor: smoothState.stabilityScore >= 0.7 ? 'var(--color-success)' : 'var(--accent-blue)',
                          transition: 'width 0.1s ease-out'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Diagnostic Control Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-light)', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`ctrl-btn ${isAudioMuted ? 'danger' : ''}`}
                onClick={toggleAudio}
                title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isAudioMuted ? <IconMicOff size={20} /> : <IconMic size={20} />}
              </button>

              <button
                type="button"
                className={`ctrl-btn ${isVideoDisabled ? 'danger' : ''}`}
                onClick={toggleVideo}
                title={isVideoDisabled ? 'Turn on camera' : 'Turn off camera'}
              >
                {isVideoDisabled ? <IconVideoOff size={20} /> : <IconVideo size={20} />}
              </button>

              <button
                type="button"
                className={`ctrl-btn ${showSkeleton ? 'active' : ''}`}
                onClick={() => setShowSkeleton(!showSkeleton)}
                title={showSkeleton ? 'Hide skeleton landmarks' : 'Show skeleton landmarks'}
              >
                <IconHandSign size={20} />
              </button>

              <button
                type="button"
                className={`ctrl-btn ${isSTTActive ? 'active' : ''}`}
                onClick={toggleSTT}
                title={isSTTActive ? 'Stop live speech transcription' : 'Start live speech transcription'}
              >
                <IconCaptions size={20} />
              </button>

              <button
                type="button"
                className={`ctrl-btn ${!isTTSActive ? 'danger' : ''}`}
                onClick={() => {
                  const next = !isTTSActive;
                  setIsTTSActive(next);
                  ttsService.setMuted(!next);
                }}
                title={isTTSActive ? 'Mute text-to-speech audio' : 'Unmute text-to-speech audio'}
              >
                {isTTSActive ? <IconVolumeUp size={20} /> : <IconVolumeOff size={20} />}
              </button>

              <button
                type="button"
                className="ctrl-btn danger"
                onClick={releaseCamera}
                title="Stop hardware camera"
              >
                <IconClose size={20} />
              </button>
            </div>

            {/* Diagnostic Panels Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
              
              {/* STT Panel */}
              <div className="card-white">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Speech-to-Text Captions</div>
                  <span className={`badge ${isSTTActive ? 'badge-green' : 'badge-gray'}`}>
                    {isSTTActive ? 'Listening' : 'Off'}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Live speech transcription rendered client-side via the Web Speech API.
                </p>

                <div style={{ minHeight: '90px', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.9rem' }}>
                  {finalTranscripts.length > 0 ? (
                    finalTranscripts.map((t, i) => (
                      <div key={i} style={{ color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                        {t}
                      </div>
                    ))
                  ) : (
                    <span style={{ color: 'var(--text-disabled)', fontStyle: 'italic' }}>
                      {isSTTActive ? 'Speak into your microphone...' : 'Captions inactive.'}
                    </span>
                  )}
                  {interimTranscript && (
                    <div style={{ color: 'var(--accent-blue)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                      {interimTranscript}...
                    </div>
                  )}
                </div>
              </div>

              {/* TTS Panel */}
              <div className="card-white">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Spoken Sign Audio (TTS)</div>
                  <span className={`badge ${isTTSActive ? 'badge-blue' : 'badge-gray'}`}>
                    {isTTSActive ? 'Active' : 'Muted'}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Signs held steadily trigger browser speech synthesis.
                </p>

                <div style={{ minHeight: '90px', maxHeight: '120px', overflowY: 'auto', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.9rem' }}>
                  {recentSpeechEvents.length > 0 ? (
                    recentSpeechEvents.map((evt) => (
                      <div key={evt.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>"{evt.text}"</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-disabled)' }}>{evt.time}</span>
                      </div>
                    ))
                  ) : (
                    <span style={{ color: 'var(--text-disabled)', fontStyle: 'italic' }}>
                      No gestures confirmed yet.
                    </span>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
