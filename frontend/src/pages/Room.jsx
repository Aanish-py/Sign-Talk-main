import React, { useState, useEffect, useRef, useCallback } from 'react';
import VideoTile from '../components/VideoTile';
import PermissionPrompt from '../components/PermissionPrompt';
import EmptyState from '../components/EmptyState';
import { useHandTracker } from '../ml/useHandTracker';
import { signClassifierService } from '../ml/signClassifier';
import { GestureSmoother } from '../ml/gestureSmoother';
import { ttsService, sttService } from '../ml/speechEngine';
import { useWebRTC } from '../webrtc/useWebRTC';
import {
  IconMic,
  IconMicOff,
  IconVideo,
  IconVideoOff,
  IconHandSign,
  IconCaptions,
  IconVolumeUp,
  IconVolumeOff,
  IconChat,
  IconHistory,
  IconPhoneHangup,
  IconCopy,
  IconCheck,
  IconClose,
  IconSend,
  IconUsers
} from '../components/Icons';

/** Small diagnostic row: label=value, amber when highlight=true */
function DiagRow({ label, value, highlight = false }) {
  const stateColor = {
    live: '#1a7340',
    connected: '#1a7340',
    yes: '#1a7340',
    muted: '#b45309',
    ended: '#b91c1c',
    failed: '#b91c1c',
    'no-video-track': '#b91c1c',
    none: '#6b7280',
    new: '#6b7280',
    checking: '#1d6fb8',
    connecting: '#1d6fb8',
    'in-progress': '#1d6fb8',
  }[value] || (highlight ? '#b45309' : '#6b7280');

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
      <span style={{ color: '#9ca3af' }}>{label}:</span>
      <span style={{ color: stateColor, fontWeight: 600 }}>{value}</span>
    </span>
  );
}

export default function Room({ roomId, initialRole = 'unified', initialSettings = {}, onLeaveCall }) {
  const [localStream, setLocalStream] = useState(initialSettings.existingStream || null);
  const [permissionState, setPermissionState] = useState(initialSettings.existingStream ? 'granted' : 'prompt');
  const [isAudioMuted, setIsAudioMuted] = useState(initialSettings.isAudioMuted || false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(initialSettings.isVideoDisabled || false);

  // User Role: 'deaf' | 'hearing' | 'unified'
  const [userRole, setUserRole] = useState(initialRole);

  // Feature Toggles
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [isTTSActive, setIsTTSActive] = useState(true);
  const [isSTTActive, setIsSTTActive] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('chat'); // 'chat' | 'history'

  // Translation & Caption State
  const [localPredictedSign, setLocalPredictedSign] = useState(null);
  const [activeSignToast, setActiveSignToast] = useState(null);
  const [remoteTranscript, setRemoteTranscript] = useState('');
  const [interimLocalTranscript, setInterimLocalTranscript] = useState('');
  const [signHistory, setSignHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Diagnostics panel
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [mediaState, setMediaState] = useState({
    rtcConnectionState: 'none',
    rtcIceState: 'none',
    localVideoTrack: 'none',   // 'live' | 'muted' | 'ended' | 'none'
    localAudioTrack: 'none',   // 'live' | 'muted' | 'ended' | 'none'
    remoteVideoTrack: 'none',  // 'live' | 'no-video-track' | 'none'
    remoteVideoPlaying: false,
  });
  const remoteVideoRef = useRef(null);

  // DOM Refs
  const localVideoRef = useRef(null);
  const localCanvasRef = useRef(null);
  const localStreamRef = useRef(initialSettings.existingStream || null); // always current stream for cleanup
  const smootherRef = useRef(new GestureSmoother({ windowSize: 10, minAgreementRatio: 0.7, minConfidence: 0.75 }));
  const isTTSActiveRef = useRef(isTTSActive);
  const toastTimeoutRef = useRef(null);
  const diagnosticsIntervalRef = useRef(null);

  useEffect(() => {
    isTTSActiveRef.current = isTTSActive;
  }, [isTTSActive]);

  // In-call duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // WebRTC DataChannel callbacks
  const handleRemoteSign = useCallback((sign) => {
    setActiveSignToast({
      word: sign.ttsText || sign.displayText,
      source: 'Peer'
    });

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setActiveSignToast(null), 3000);

    setSignHistory((prev) => [
      {
        id: Date.now(),
        source: 'Peer',
        word: sign.ttsText || sign.displayText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      },
      ...prev.slice(0, 24)
    ]);

    // Speak incoming sign pose aloud if TTS is enabled
    if (isTTSActiveRef.current) {
      ttsService.speak(sign.ttsText);
    }
  }, []);

  const handleRemoteTranscript = useCallback(({ transcript }) => {
    setRemoteTranscript(transcript);
  }, []);

  // WebRTC Hook
  const {
    connectionStatus,
    remoteStream,
    remotePeerInfo,
    chatMessages,
    peerConnectionRef,
    sendSign,
    sendSpeechTranscript,
    sendChatMessage
  } = useWebRTC(roomId, localStream, userRole, {
    onRemoteSignReceived: handleRemoteSign,
    onRemoteTranscriptReceived: handleRemoteTranscript
  });

  // Poll real media state every 1 s — no invented metrics
  useEffect(() => {
    const pollMediaState = () => {
      const pc = peerConnectionRef.current;

      // 1. WebRTC connection state
      const rtcConnectionState = pc ? pc.connectionState : 'none';
      const rtcIceState = pc ? pc.iceConnectionState : 'none';

      // 2. Local video track
      let localVideoTrack = 'none';
      if (localStream) {
        const vt = localStream.getVideoTracks()[0];
        if (vt) localVideoTrack = vt.readyState === 'ended' ? 'ended' : vt.enabled ? 'live' : 'muted';
      }

      // 3. Local audio track
      let localAudioTrack = 'none';
      if (localStream) {
        const at = localStream.getAudioTracks()[0];
        if (at) localAudioTrack = at.readyState === 'ended' ? 'ended' : at.enabled ? 'live' : 'muted';
      }

      // 4. Remote video track (stream present ≠ video track present ≠ video playing)
      let remoteVideoTrack = 'none';
      if (remoteStream) {
        const rvt = remoteStream.getVideoTracks()[0];
        remoteVideoTrack = rvt
          ? (rvt.readyState === 'ended' ? 'ended' : rvt.enabled ? 'live' : 'muted')
          : 'no-video-track';
      }

      // 5. Remote video element actual playback
      const vid = remoteVideoRef.current;
      const remoteVideoPlaying =
        !!vid && vid.readyState >= 2 && !vid.paused && !vid.ended;

      setMediaState({ rtcConnectionState, rtcIceState, localVideoTrack, localAudioTrack, remoteVideoTrack, remoteVideoPlaying });
    };

    diagnosticsIntervalRef.current = setInterval(pollMediaState, 1000);
    pollMediaState(); // immediate first read
    return () => clearInterval(diagnosticsIntervalRef.current);
  }, [peerConnectionRef, localStream, remoteStream]);

  // Local ML Hand Tracking Results Handler
  const handleTrackingResults = useCallback((data) => {
    const { normalizedVectors } = data;
    if (!normalizedVectors || normalizedVectors.length === 0 || isVideoDisabled) {
      setLocalPredictedSign(null);
      smootherRef.current.process(null);
      return;
    }

    const primaryVector = normalizedVectors[0];

    if (signClassifierService.isReady) {
      const pred = signClassifierService.predict(primaryVector);
      setLocalPredictedSign(pred);

      smootherRef.current.process(pred, (confirmedSign) => {
        // Send confirmed sign across WebRTC DataChannel to peer
        sendSign(confirmedSign);

        setActiveSignToast({
          word: confirmedSign.ttsText || confirmedSign.displayText,
          confidence: Math.round((confirmedSign.confidence || 0.9) * 100),
          source: 'You'
        });

        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => setActiveSignToast(null), 3000);

        setSignHistory((prev) => [
          {
            id: Date.now(),
            source: 'You',
            word: confirmedSign.ttsText || confirmedSign.displayText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          },
          ...prev.slice(0, 24)
        ]);
      });
    }
  }, [isVideoDisabled, sendSign]);

  // Hook up MediaPipe Hand Tracker
  const { fps } = useHandTracker(localVideoRef, localCanvasRef, {
    enabled: permissionState === 'granted' && !isVideoDisabled,
    showSkeleton: showSkeleton,
    onResults: handleTrackingResults
  });

  // Toggle Voice Captions (Speech-to-Text)
  const toggleSTT = () => {
    if (isSTTActive) {
      sttService.stop();
      setIsSTTActive(false);
      setInterimLocalTranscript('');
    } else {
      const started = sttService.start({
        onInterim: (text) => {
          setInterimLocalTranscript(text);
          sendSpeechTranscript(text, false);
        },
        onFinal: (text) => {
          setInterimLocalTranscript('');
          sendSpeechTranscript(text, true);
        },
        onError: (err) => console.warn('STT Error:', err),
        onStatusChange: (status) => setIsSTTActive(status)
      });
      if (started) {
        setIsSTTActive(true);
      }
    }
  };

  // Hardware Controls
  const toggleAudio = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoDisabled(!videoTrack.enabled);
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendChatMessage(chatInput.trim(), userRole === 'deaf' ? 'Signer' : userRole === 'hearing' ? 'Speaker' : 'You');
      setChatInput('');
    }
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}/#room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleExit = () => {
    // 1. Stop speech services
    sttService.stop();
    ttsService.cancel();

    // 2. Release the video element's reference to the stream BEFORE stopping tracks.
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    // 3. Stop all local media tracks — uses localStreamRef to always see current stream.
    //    localStream state may be stale inside event handlers.
    const activeStream = localStreamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach((t) => {
        try {
          if (t.readyState !== 'ended') t.stop();
        } catch (_) { /* already stopped */ }
      });
      localStreamRef.current = null;
    }

    // 4. Navigate back to dashboard
    onLeaveCall();
  };

  // Helper: returns true if a stream exists and all its tracks are live
  const isStreamLive = (stream) => {
    if (!stream) return false;
    const tracks = stream.getTracks();
    return tracks.length > 0 && tracks.every((t) => t.readyState === 'live');
  };

  // Request / validate camera on mount.
  // Always checks that the existing stream's tracks are actually live before using it.
  // If tracks were stopped (e.g. by Lobby cleanup timing), re-acquires camera.
  useEffect(() => {
    const acquireMedia = async () => {
      const existing = initialSettings.existingStream;

      // Use the Lobby stream only if its tracks are genuinely live
      if (isStreamLive(existing)) {
        // Tracks are live — use the handed-off stream directly
        if (!localStream || localStream !== existing) {
          setLocalStream(existing);
          localStreamRef.current = existing;
        }
        setPermissionState('granted');
        return;
      }

      // Either no existing stream, or its tracks have been stopped.
      // Request a fresh camera stream.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: true
        });
        // Apply mute/disable preferences from Lobby before making stream live in state
        if (initialSettings.isAudioMuted) {
          stream.getAudioTracks().forEach((t) => { t.enabled = false; });
        }
        if (initialSettings.isVideoDisabled) {
          stream.getVideoTracks().forEach((t) => { t.enabled = false; });
        }
        setLocalStream(stream);
        localStreamRef.current = stream;
        setPermissionState('granted');
      } catch (err) {
        console.error('[Room] Camera access error:', err);
        setPermissionState('denied');
      }
    };

    acquireMedia();
    signClassifierService.initialize().catch((err) => console.warn('Classifier init:', err));

    return () => {
      // Always clean up on unmount — covers all exit paths:
      // End Call button, sign-out, browser navigation, hash change, etc.
      sttService.stop();
      ttsService.cancel();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (diagnosticsIntervalRef.current) clearInterval(diagnosticsIntervalRef.current);

      // Release the local video element's stream reference
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      // Stop all local media tracks so the webcam LED turns off.
      // Uses localStreamRef (not localStream state) to avoid stale closure:
      // localStream captured at mount may be null even if media was acquired later.
      const activeStream = localStreamRef.current;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => {
          try {
            if (t.readyState !== 'ended') t.stop();
          } catch (_) { /* already stopped or unavailable */ }
        });
        localStreamRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#ffffff', overflow: 'hidden' }}>
      
      {/* Top Bar (Minimal Google Meet style) */}
      <header style={{
        height: '56px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        zIndex: 30
      }}>
        {/* Left: Meeting Code & Copy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
            {roomId}
          </div>
          <button
            type="button"
            className="btn-flat"
            onClick={copyRoomLink}
            style={{ padding: '0.3rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--accent-blue)' }}
            title="Copy meeting link"
          >
            {copiedLink ? <IconCheck size={16} /> : <IconCopy size={16} />}
            <span style={{ marginLeft: '0.3rem' }}>{copiedLink ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Center: Call Timer & Role Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {formatDuration(callDuration)}
          </span>

          <div className="segmented-control" style={{ padding: '2px' }}>
            <button
              type="button"
              className={`segmented-btn ${userRole === 'deaf' ? 'active' : ''}`}
              onClick={() => setUserRole('deaf')}
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
            >
              Signer
            </button>
            <button
              type="button"
              className={`segmented-btn ${userRole === 'hearing' ? 'active' : ''}`}
              onClick={() => setUserRole('hearing')}
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
            >
              Speaker
            </button>
            <button
              type="button"
              className={`segmented-btn ${userRole === 'unified' ? 'active' : ''}`}
              onClick={() => setUserRole('unified')}
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
            >
              Unified
            </button>
          </div>
        </div>

        {/* Right: Connection Badge + Diagnostics Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {connectionStatus === 'connected' ? (
            <span className="badge badge-green" style={{ fontSize: '0.75rem' }}>RTC: connected</span>
          ) : connectionStatus === 'connecting' ? (
            <span className="badge badge-blue" style={{ fontSize: '0.75rem' }}>RTC: connecting…</span>
          ) : connectionStatus === 'signaling' ? (
            <span className="badge badge-blue" style={{ fontSize: '0.75rem' }}>RTC: signaling…</span>
          ) : connectionStatus === 'failed' ? (
            <span className="badge badge-red" style={{ fontSize: '0.75rem' }}>RTC: failed</span>
          ) : (
            <span className="badge badge-gray" style={{ fontSize: '0.75rem' }}>RTC: waiting</span>
          )}
          <button
            type="button"
            className="btn-flat"
            onClick={() => setShowDiagnostics((v) => !v)}
            style={{
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.72rem',
              color: showDiagnostics ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontWeight: 500,
              border: '1px solid var(--border-light)',
              letterSpacing: '0.01em'
            }}
            title="Toggle media state diagnostics"
          >
            {showDiagnostics ? 'Hide diagnostics' : 'Diagnostics'}
          </button>
        </div>
      </header>

      {/* Diagnostics Panel — real state, no invented metrics */}
      {showDiagnostics && (
        <div style={{
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid var(--border-light)',
          padding: '0.5rem 1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem 1.25rem',
          fontSize: '0.72rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)'
        }}>
          <DiagRow label="RTC conn" value={mediaState.rtcConnectionState} />
          <DiagRow label="ICE" value={mediaState.rtcIceState} />
          <DiagRow label="Local cam" value={mediaState.localVideoTrack} />
          <DiagRow label="Local mic" value={mediaState.localAudioTrack} />
          <DiagRow label="Remote video track" value={mediaState.remoteVideoTrack} />
          <DiagRow label="Remote playing" value={mediaState.remoteVideoPlaying ? 'yes' : 'no'} highlight={!mediaState.remoteVideoPlaying && mediaState.rtcConnectionState === 'connected'} />
        </div>
      )}

      {/* Main Call Stage */}
      {permissionState !== 'granted' && !localStream ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <PermissionPrompt onRequestPermission={() => {}} />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden', backgroundColor: '#202124' }}>
          
          {/* Video Area Container */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', padding: '1rem', overflow: 'hidden' }}>
            
            {/* Real-Time Sign Interpretation Floating Toast (confirmed sign) */}
            {activeSignToast && (
              <div className="interpretation-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <IconHandSign size={18} style={{ color: 'var(--accent-blue)' }} />
                  <span className="interpretation-label">
                    {activeSignToast.source === 'You' ? 'Sign detected' : 'Peer signed'}
                  </span>
                </div>
                <span className="interpretation-word">
                  {activeSignToast.word}
                </span>
                {activeSignToast.confidence && (
                  <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>
                    {activeSignToast.confidence}%
                  </span>
                )}
              </div>
            )}

            {/* Raw prediction indicator — subtle intermediate state, not a confirmed sign */}
            {localPredictedSign && !activeSignToast && (
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(255, 255, 255, 0.88)',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                padding: '0.35rem 0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                zIndex: 25,
                pointerEvents: 'none',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--accent-blue)', display: 'inline-block', animation: 'pulse 1.2s ease-in-out infinite' }} />
                <span>Recognizing…</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {localPredictedSign.name || localPredictedSign.displayText}
                </span>
              </div>
            )}

            {/* Live Captions Layer (Floating Subtitles) */}
            {(remoteTranscript || interimLocalTranscript) && (
              <div className="caption-overlay">
                {remoteTranscript || interimLocalTranscript}
              </div>
            )}

            {/* Video Canvas Stage */}
            <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }}>
              
              {/* Dominant Remote Video or Waiting State */}
              {remoteStream ? (
                <VideoTile
                  stream={remoteStream}
                  videoRef={remoteVideoRef}
                  label={`Peer${remotePeerInfo?.role ? ` · ${remotePeerInfo.role}` : ''}`}
                  isLocal={false}
                  statusOverride={
                    mediaState.remoteVideoTrack === 'no-video-track'
                      ? 'No video track received'
                      : mediaState.remoteVideoTrack === 'ended'
                      ? 'Remote video track ended'
                      : !mediaState.remoteVideoPlaying && mediaState.rtcConnectionState === 'connected'
                      ? 'Stream received — video not yet playing'
                      : null
                  }
                />
              ) : (
                /* No remote stream yet — connection-aware waiting state */
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#282a2d',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  padding: '2rem',
                  textAlign: 'center'
                }}>
                  {connectionStatus === 'connecting' || connectionStatus === 'signaling' ? (
                    /* Peer is connecting — show spinner */
                    <>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        border: '3px solid rgba(255,255,255,0.12)',
                        borderTopColor: '#1a73e8',
                        animation: 'spin 0.9s linear infinite',
                        marginBottom: '1rem'
                      }} />
                      <h3 style={{ color: '#ffffff', fontWeight: 500, fontSize: '1.15rem', marginBottom: '0.4rem' }}>
                        Connecting to peer…
                      </h3>
                      <p style={{ color: '#9aa0a6', fontSize: '0.85rem', maxWidth: '300px', lineHeight: 1.4 }}>
                        Establishing peer-to-peer connection. This usually takes a few seconds.
                      </p>
                    </>
                  ) : connectionStatus === 'connected' ? (
                    /* Connected but no video stream yet */
                    <>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', marginBottom: '1rem' }}>
                        <IconUsers size={24} />
                      </div>
                      <h3 style={{ color: '#ffffff', fontWeight: 500, fontSize: '1.15rem', marginBottom: '0.4rem' }}>
                        Connected — waiting for video stream
                      </h3>
                      <p style={{ color: '#9aa0a6', fontSize: '0.85rem', maxWidth: '300px', lineHeight: 1.4 }}>
                        Peer connection established. Waiting for remote video track to arrive.
                      </p>
                    </>
                  ) : connectionStatus === 'failed' ? (
                    /* Connection failed */
                    <>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#3a1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f28b82', marginBottom: '1rem' }}>
                        <IconUsers size={24} />
                      </div>
                      <h3 style={{ color: '#ffffff', fontWeight: 500, fontSize: '1.15rem', marginBottom: '0.4rem' }}>
                        Connection failed
                      </h3>
                      <p style={{ color: '#9aa0a6', fontSize: '0.85rem', maxWidth: '300px', lineHeight: 1.4 }}>
                        Could not establish peer connection. Check your network and try rejoining.
                      </p>
                    </>
                  ) : (
                    /* Waiting for peer to join (disconnected / waiting) */
                    <>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#3c4043', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bdc1c6', marginBottom: '1rem' }}>
                        <IconUsers size={28} />
                      </div>
                      <h3 style={{ color: '#ffffff', fontWeight: 500, fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                        Waiting for someone to join
                      </h3>
                      <p style={{ color: '#9aa0a6', fontSize: '0.9rem', maxWidth: '340px', marginBottom: '1.5rem', lineHeight: 1.4 }}>
                        Share the meeting code or link with someone to start the call.
                      </p>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={copyRoomLink}
                        style={{ backgroundColor: '#ffffff', color: 'var(--accent-blue)' }}
                      >
                        {copiedLink ? <IconCheck size={18} /> : <IconCopy size={18} />}
                        <span>{copiedLink ? 'Link copied' : 'Copy link'}</span>
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Floating Local Picture-in-Picture Tile */}
              <div style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                width: '240px',
                aspectRatio: '16 / 9',
                borderRadius: '10px',
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                border: '2px solid rgba(255, 255, 255, 0.15)',
                zIndex: 15
              }}>
                <VideoTile
                  stream={localStream}
                  videoRef={localVideoRef}
                  canvasRef={localCanvasRef}
                  label="You"
                  isLocal={true}
                  isMuted={isAudioMuted}
                  isVideoOff={isVideoDisabled}
                />
              </div>

            </div>

          </div>

          {/* Collapsible Side Drawer (Chat / History) */}
          {isDrawerOpen && (
            <div className="side-drawer">
              <div className="drawer-header">
                <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  In-call details
                </div>
                <button
                  type="button"
                  className="btn-flat"
                  onClick={() => setIsDrawerOpen(false)}
                  style={{ padding: '0.25rem', borderRadius: '50%' }}
                >
                  <IconClose size={20} />
                </button>
              </div>

              {/* Drawer Tabs */}
              <div className="drawer-tabs">
                <button
                  type="button"
                  className={`drawer-tab ${drawerTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setDrawerTab('chat')}
                >
                  <IconChat size={16} />
                  <span>Chat {chatMessages.length > 0 && `(${chatMessages.length})`}</span>
                </button>
                <button
                  type="button"
                  className={`drawer-tab ${drawerTab === 'history' ? 'active' : ''}`}
                  onClick={() => setDrawerTab('history')}
                >
                  <IconHistory size={16} />
                  <span>Sign log {signHistory.length > 0 && `(${signHistory.length})`}</span>
                </button>
              </div>

              {/* Tab 1: Live Chat */}
              {drawerTab === 'chat' ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', overflow: 'hidden' }}>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    {chatMessages.length === 0 ? (
                      <EmptyState
                        icon={IconChat}
                        title="No messages yet"
                        description="Messages sent during the call will appear here."
                      />
                    ) : (
                      chatMessages.map((msg) => (
                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.8rem', color: msg.senderName === 'You' ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                              {msg.senderName}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-disabled)' }}>
                              {msg.timestamp}
                            </span>
                          </div>
                          <div style={{
                            backgroundColor: msg.senderName === 'You' ? 'var(--accent-blue-light)' : 'var(--bg-secondary)',
                            color: msg.senderName === 'You' ? 'var(--accent-blue)' : 'var(--text-primary)',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            border: '1px solid var(--border-light)',
                            alignSelf: msg.senderName === 'You' ? 'flex-end' : 'flex-start',
                            maxWidth: '90%'
                          }}>
                            {msg.text}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Send a message..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!chatInput.trim()}
                      style={{ padding: '0.5rem 0.75rem' }}
                    >
                      <IconSend size={16} />
                    </button>
                  </form>
                </div>
              ) : (
                /* Tab 2: Sign History */
                <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {signHistory.length === 0 ? (
                    <EmptyState
                      icon={IconHistory}
                      title="No signs detected yet"
                      description="Gestures recognized during this call will be logged here."
                    />
                  ) : (
                    signHistory.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-light)',
                          borderRadius: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: item.source === 'You' ? 'var(--accent-blue)' : 'var(--color-success)' }}>
                            {item.source}:
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                            {item.word}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-disabled)' }}>
                          {item.time}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Google Meet-Style Bottom Control Bar */}
      <footer className="meeting-controls-bar">
        {/* Mic Toggle */}
        <button
          type="button"
          className={`ctrl-btn ${isAudioMuted ? 'danger' : ''}`}
          onClick={toggleAudio}
          title={isAudioMuted ? 'Turn on microphone' : 'Turn off microphone'}
        >
          {isAudioMuted ? <IconMicOff size={20} /> : <IconMic size={20} />}
        </button>

        {/* Camera Toggle */}
        <button
          type="button"
          className={`ctrl-btn ${isVideoDisabled ? 'danger' : ''}`}
          onClick={toggleVideo}
          title={isVideoDisabled ? 'Turn on camera' : 'Turn off camera'}
        >
          {isVideoDisabled ? <IconVideoOff size={20} /> : <IconVideo size={20} />}
        </button>

        {/* Sign Tracking & Skeleton Toggle */}
        <button
          type="button"
          className={`ctrl-btn ${showSkeleton ? 'active' : ''}`}
          onClick={() => setShowSkeleton(!showSkeleton)}
          title={showSkeleton ? 'Hide hand landmarks' : 'Show hand landmarks'}
        >
          <IconHandSign size={20} />
        </button>

        {/* Live Voice Captions Toggle */}
        <button
          type="button"
          className={`ctrl-btn ${isSTTActive ? 'active' : ''}`}
          onClick={toggleSTT}
          title={isSTTActive ? 'Stop live voice captions' : 'Broadcast live voice captions'}
        >
          <IconCaptions size={20} />
        </button>

        {/* Text-to-Speech Audio Toggle */}
        <button
          type="button"
          className={`ctrl-btn ${!isTTSActive ? 'danger' : ''}`}
          onClick={() => {
            const next = !isTTSActive;
            setIsTTSActive(next);
            ttsService.setMuted(!next);
          }}
          title={isTTSActive ? 'Mute sign text-to-speech voice' : 'Unmute sign text-to-speech voice'}
        >
          {isTTSActive ? <IconVolumeUp size={20} /> : <IconVolumeOff size={20} />}
        </button>

        {/* Chat & Details Drawer Toggle */}
        <button
          type="button"
          className={`ctrl-btn ${isDrawerOpen ? 'active' : ''}`}
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          title="Chat and meeting details"
        >
          <IconChat size={20} />
        </button>

        {/* End Call Button */}
        <button
          type="button"
          className="ctrl-btn hangup"
          onClick={handleExit}
          title="Leave call"
        >
          <IconPhoneHangup size={24} />
        </button>
      </footer>

    </div>
  );
}
