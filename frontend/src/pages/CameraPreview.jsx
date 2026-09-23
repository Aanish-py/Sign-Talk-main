import React, { useState, useEffect, useRef, useCallback } from 'react';
import VideoTile from '../components/VideoTile';
import PermissionPrompt from '../components/PermissionPrompt';
import { useHandTracker } from '../ml/useHandTracker';
import { signClassifierService } from '../ml/signClassifier';
import { GestureSmoother } from '../ml/gestureSmoother';
import { ttsService, sttService } from '../ml/speechEngine';
import signsData from '../ml/signs.json';

/**
 * CameraPreview Page (Stage 1 to 6 End-to-End Live Translation Studio)
 * 
 * Tests and showcases the complete SignSpeak translation loop:
 * 1. Local Webcam & Audio hardware
 * 2. MediaPipe Hand Landmark tracking (21 3D points)
 * 3. TensorFlow.js Neural Classifier inference
 * 4. GestureSmoother temporal stability filter & debounce
 * 5. Text-to-Speech (TTS) engine speaking confirmed signs
 * 6. Speech-to-Text (STT) real-time continuous speech captioning
 */
export default function CameraPreview({ onNavigate }) {
  const [stream, setStream] = useState(null);
  const [permissionState, setPermissionState] = useState('prompt'); // 'prompt' | 'granted' | 'denied'
  const [errorDetails, setErrorDetails] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [streamStats, setStreamStats] = useState({ width: 0, height: 0, label: '' });

  // Toggles
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [isTTSActive, setIsTTSActive] = useState(true);
  const [isSTTActive, setIsSTTActive] = useState(false);

  // Live ML recognition state
  const [rawPrediction, setRawPrediction] = useState(null);
  const [smoothState, setSmoothState] = useState({
    stableSign: null,
    stabilityScore: 0,
    confidence: 0,
    isConfirmed: false,
    inCooldown: false
  });
  const [recentSpeechEvents, setRecentSpeechEvents] = useState([]);

  // Live STT speech transcript state
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
      signClassifierService.predict(primaryVector).then((pred) => {
        if (pred) {
          setRawPrediction(pred);

          const state = smootherRef.current.process(pred, (confirmedSign) => {
            // Triggered when temporal stability confirms the sign
            if (isTTSActiveRef.current) {
              ttsService.speak(confirmedSign.ttsText);
            }

            setRecentSpeechEvents((prev) => [
              {
                id: Date.now(),
                text: confirmedSign.ttsText,
                display: confirmedSign.displayText,
                time: new Date().toLocaleTimeString()
              },
              ...prev.slice(0, 9)
            ]);
          });

          setSmoothState(state);
        }
      });
    }
  }, [isVideoDisabled]);

  // Hook up MediaPipe Hand Tracker
  const {
    isModelLoading,
    modelError,
    fps,
    latencyMs,
    detectedHandsCount,
    handednessList,
    fingerStates
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

  // Toggle Speech-to-Text continuous listening
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

  // Start webcam request
  const requestMediaAccess = async () => {
    try {
      setErrorDetails(null);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: true
      });

      setStream(mediaStream);
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

      let message = 'Unable to access your camera/microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera or microphone permission was denied. Please allow access in your browser address bar.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera or microphone device was found on this computer.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Your camera is currently being used by another application (e.g. Teams, Zoom, or another browser tab).';
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
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setPermissionState('prompt');
    }
  };

  useEffect(() => {
    return () => {
      sttService.stop();
      ttsService.cancel();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="container" style={{ maxWidth: '1080px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Translating Camera & Two-Way Speech Studio</h2>
          <p style={{ fontSize: '0.95rem' }}>
            Full end-to-end ISL Sign-to-Speech and Speech-to-Text Live Caption test studio.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => { releaseCamera(); onNavigate('collector'); }}>
            🧠 AI Studio
          </button>
          <button className="btn btn-secondary" onClick={() => { releaseCamera(); onNavigate('landing'); }}>
            🏠 Home
          </button>
        </div>
      </div>

      {isModelLoading && permissionState === 'granted' && (
        <div className="notice-box notice-info" style={{ marginBottom: '1rem' }}>
          <strong>Loading AI Models:</strong> Initializing MediaPipe WASM and TensorFlow.js neural network...
        </div>
      )}

      {modelError && (
        <div className="notice-box notice-danger" style={{ marginBottom: '1rem' }}>
          <strong>Error:</strong> {modelError}
        </div>
      )}

      {permissionState !== 'granted' ? (
        <PermissionPrompt
          onRequestPermission={requestMediaAccess}
          errorState={errorDetails}
          onRetry={requestMediaAccess}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Main Video & Live HUD */}
          <div style={{ position: 'relative' }}>
            <VideoTile
              stream={stream}
              videoRef={videoRef}
              canvasRef={canvasRef}
              label={streamStats.label || 'Webcam'}
              isLocal={true}
              isMuted={isAudioMuted}
              isVideoOff={isVideoDisabled}
              statusBadge={
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className="badge badge-success">
                    🟢 {fps} FPS | {latencyMs}ms
                  </span>
                  {detectedHandsCount > 0 && (
                    <span className="badge badge-info">
                      🖐️ {detectedHandsCount} Hand ({handednessList.join(', ') || 'Tracked'})
                    </span>
                  )}
                </div>
              }
            />

            {/* Overlaid Real-Time Sign Translation HUD Pill */}
            {rawPrediction && detectedHandsCount > 0 && !isVideoDisabled && (
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(15, 23, 42, 0.9)',
                backdropFilter: 'blur(8px)',
                border: '2px solid var(--accent-cyan)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1.25rem',
                minWidth: '220px',
                zIndex: 20,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                    Predicted Sign
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: rawPrediction.confidence > 0.8 ? 'var(--accent-green)' : 'var(--accent-cyan)' }}>
                    {Math.round(rawPrediction.confidence * 100)}% Conf
                  </span>
                </div>

                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {rawPrediction.displayText}
                </div>

                {/* Stability Progress Bar */}
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                    <span>Anti-Flicker Stability:</span>
                    <span>{Math.round(smoothState.stabilityScore * 100)}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg-surface)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.round(smoothState.stabilityScore * 100)}%`,
                        background: smoothState.stabilityScore >= 0.7 ? 'var(--accent-green)' : 'var(--accent-cyan)',
                        transition: 'width 0.1s ease-out'
                      }}
                    />
                  </div>
                </div>

                {smoothState.inCooldown && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem', textAlign: 'center' }}>
                    ⏳ Debounce Cooldown
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls Bar */}
          <div className="control-bar">
            <button
              className={`btn ${isAudioMuted ? 'btn-danger' : 'btn-secondary'}`}
              onClick={toggleAudio}
            >
              {isAudioMuted ? '🔇 Unmute Mic' : '🎙️ Mute Mic'}
            </button>

            <button
              className={`btn ${isVideoDisabled ? 'btn-danger' : 'btn-secondary'}`}
              onClick={toggleVideo}
            >
              {isVideoDisabled ? '📷 Enable Camera' : '🚫 Disable Camera'}
            </button>

            <button
              className={`btn ${showSkeleton ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowSkeleton(!showSkeleton)}
            >
              {showSkeleton ? '🦴 Skeleton: On' : '🦴 Skeleton: Off'}
            </button>

            <button
              className={`btn ${isTTSActive ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                const next = !isTTSActive;
                setIsTTSActive(next);
                ttsService.setMuted(!next);
              }}
            >
              {isTTSActive ? '🔊 TTS Audio: Active' : '🔇 TTS Audio: Muted'}
            </button>

            <button
              className={`btn ${isSTTActive ? 'btn-success' : 'btn-secondary'}`}
              onClick={toggleSTT}
            >
              {isSTTActive ? '🛑 Stop Captions' : '🎙️ Live Speech Captions'}
            </button>

            <button
              className="btn btn-danger"
              onClick={releaseCamera}
            >
              🛑 Stop Hardware
            </button>
          </div>

          {/* Real-time Two-Way Translation Displays */}
          <div className="grid-2">
            
            {/* STT: Hearing User Speech Transcriber (Deaf User's View) */}
            <div className="card" style={{ border: isSTTActive ? '2px solid var(--accent-green)' : '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.15rem' }}>🎙️ Speech-to-Text Live Captions (STT)</h3>
                <span className={`badge ${isSTTActive ? 'badge-success' : 'badge-secondary'}`}>
                  {isSTTActive ? '🎤 Listening Live' : 'Off'}
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Transcribes voice from the microphone in real-time so Deaf participants read spoken words instantly.
              </p>

              <div style={{
                minHeight: '110px',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  {finalTranscripts.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.5rem' }}>
                      {finalTranscripts.map((t, idx) => (
                        <div key={idx} style={{ fontSize: '0.95rem', color: idx === 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                          💬 {t}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                      {isSTTActive ? 'Speak into your microphone...' : 'Click "Live Speech Captions" above to test speech transcription.'}
                    </div>
                  )}

                  {interimTranscript && (
                    <div style={{ fontSize: '0.95rem', color: 'var(--accent-cyan)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                      ⚡ {interimTranscript}...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* TTS: Sign-to-Speech Log (Hearing User's Audio Stream) */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.15rem' }}>🔊 Sign-to-Speech Spoken Log (TTS)</h3>
                <span className="badge badge-info">{isTTSActive ? 'TTS Enabled' : 'TTS Muted'}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Signs held and confirmed by the anti-flicker filter are automatically spoken aloud via Web Speech API.
              </p>

              <div style={{
                minHeight: '110px',
                maxHeight: '160px',
                overflowY: 'auto',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem',
                border: '1px solid var(--border-subtle)'
              }}>
                {recentSpeechEvents.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {recentSpeechEvents.map((evt) => (
                      <div key={evt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                          🗣️ "{evt.text}" <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>({evt.display})</span>
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{evt.time}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                    Hold any of the 10 static ISL sign poses (e.g. Open Palm for HELLO, Thumbs Up for YES) in camera view.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Quick Sign Cheat Sheet */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>📖 Quick Test Poses (10 Supported Signs)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.5rem' }}>
              {signsData.map((sign) => (
                <div
                  key={sign.id}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: rawPrediction?.signId === sign.id ? 'rgba(56, 189, 248, 0.2)' : 'var(--bg-surface-elevated)',
                    border: rawPrediction?.signId === sign.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}
                >
                  <strong style={{ fontSize: '0.9rem', color: rawPrediction?.signId === sign.id ? 'var(--accent-cyan)' : 'var(--text-main)' }}>
                    {sign.displayText}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {sign.description.slice(0, 48)}...
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
