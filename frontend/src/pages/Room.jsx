import React, { useState, useEffect, useRef, useCallback } from 'react';
import VideoTile from '../components/VideoTile';
import PermissionPrompt from '../components/PermissionPrompt';
import { useHandTracker } from '../ml/useHandTracker';
import { signClassifierService } from '../ml/signClassifier';
import { GestureSmoother } from '../ml/gestureSmoother';
import { ttsService, sttService } from '../ml/speechEngine';
import { useWebRTC } from '../webrtc/useWebRTC';
import signsData from '../ml/signs.json';

/**
 * Live Integrated Video Call Room Component (Stage 9)
 * 
 * Features:
 * - Peer-to-peer 2-way WebRTC video & audio
 * - Role-adaptive user interface: Deaf (Signer) vs Hearing (Speaker) vs Unified
 * - Real-time client-side MediaPipe landmark detection on local webcam
 * - TensorFlow.js neural sign classification & anti-flicker smoothing
 * - Automated Text-to-Speech (TTS) triggering for hearing participants
 * - Real-time Speech-to-Text (STT) live caption streaming for Deaf participants
 * - WebRTC DataChannel instant synchronization for signs, speech transcripts & text chat
 * - In-call text chat & sign timeline drawer
 */
export default function Room({ roomId, isHost = false, onLeaveCall }) {
  const [localStream, setLocalStream] = useState(null);
  const [permissionState, setPermissionState] = useState('prompt');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);

  // User Role: 'deaf' (sign-focused), 'hearing' (voice-focused), 'unified' (both)
  const [userRole, setUserRole] = useState('unified');

  // Features Toggles
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [isTTSActive, setIsTTSActive] = useState(true);
  const [isSTTActive, setIsSTTActive] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('chat'); // 'chat' | 'history'

  // Translation State
  const [localPredictedSign, setLocalPredictedSign] = useState(null);
  const [remoteReceivedSign, setRemoteReceivedSign] = useState(null);
  const [remoteTranscript, setRemoteTranscript] = useState('');
  const [interimLocalTranscript, setInterimLocalTranscript] = useState('');
  const [signHistory, setSignHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // DOM Refs
  const localVideoRef = useRef(null);
  const localCanvasRef = useRef(null);
  const smootherRef = useRef(new GestureSmoother({ windowSize: 10, minAgreementRatio: 0.7, minConfidence: 0.75 }));
  const isTTSActiveRef = useRef(isTTSActive);

  useEffect(() => {
    isTTSActiveRef.current = isTTSActive;
  }, [isTTSActive]);

  // WebRTC DataChannel callbacks
  const handleRemoteSign = useCallback((sign) => {
    setRemoteReceivedSign(sign);
    setSignHistory((prev) => [
      { id: Date.now(), source: 'Peer', text: sign.ttsText, display: sign.displayText, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 19)
    ]);

    // Speak incoming sign pose aloud if TTS is enabled
    if (isTTSActiveRef.current) {
      ttsService.speak(sign.ttsText);
    }
  }, []);

  const handleRemoteTranscript = useCallback(({ transcript, isFinal }) => {
    setRemoteTranscript(transcript);
  }, []);

  // WebRTC Hook
  const {
    connectionStatus,
    remoteStream,
    remotePeerInfo,
    chatMessages,
    sendSign,
    sendSpeechTranscript,
    sendChatMessage
  } = useWebRTC(roomId, localStream, userRole, {
    onRemoteSignReceived: handleRemoteSign,
    onRemoteTranscriptReceived: handleRemoteTranscript
  });

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
      signClassifierService.predict(primaryVector).then((pred) => {
        if (pred) {
          setLocalPredictedSign(pred);

          smootherRef.current.process(pred, (confirmedSign) => {
            // Send confirmed sign across WebRTC DataChannel to peer
            sendSign(confirmedSign);

            // Record to local sign history
            setSignHistory((prev) => [
              { id: Date.now(), source: 'You', text: confirmedSign.ttsText, display: confirmedSign.displayText, time: new Date().toLocaleTimeString() },
              ...prev.slice(0, 19)
            ]);
          });
        }
      });
    }
  }, [isVideoDisabled, sendSign]);

  // Hook up MediaPipe Hand Tracker
  const { fps, latencyMs, detectedHandsCount } = useHandTracker(localVideoRef, localCanvasRef, {
    enabled: permissionState === 'granted' && !isVideoDisabled,
    showSkeleton: showSkeleton,
    onResults: handleTrackingResults
  });

  // Toggle Speech-to-Text (Voice Captions)
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

  // Start webcam request
  const requestMediaAccess = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true
      });

      setLocalStream(mediaStream);
      setPermissionState('granted');
    } catch (err) {
      console.error('Camera access error:', err);
      setPermissionState('denied');
    }
  };

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
      sendChatMessage(chatInput.trim(), userRole === 'deaf' ? 'Signer' : userRole === 'hearing' ? 'Speaker' : 'User');
      setChatInput('');
    }
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}/#room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleExit = () => {
    sttService.stop();
    ttsService.cancel();
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    onLeaveCall();
  };

  // Auto request camera on mount
  useEffect(() => {
    requestMediaAccess();
    signClassifierService.initialize().catch((err) => console.warn('Classifier init:', err));

    return () => {
      sttService.stop();
      ttsService.cancel();
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 75px)', background: 'var(--bg-primary)' }}>
      
      {/* In-Call Top Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.6rem 1.25rem',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
            Room: <code style={{ color: 'var(--accent-cyan)' }}>{roomId}</code>
          </span>
          <button className="btn btn-secondary" onClick={copyRoomLink} style={{ padding: '0.25rem 0.6rem', minHeight: 'auto', fontSize: '0.8rem' }}>
            {copiedLink ? '✅ Copied' : '📋 Copy Link'}
          </button>
        </div>

        {/* User Role Adaptive Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-primary)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0 0.4rem' }}>Your Role:</span>
          <button
            className={`btn ${userRole === 'deaf' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.25rem 0.6rem', minHeight: 'auto', fontSize: '0.8rem' }}
            onClick={() => setUserRole('deaf')}
          >
            🤟 Deaf (Signer)
          </button>
          <button
            className={`btn ${userRole === 'hearing' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.25rem 0.6rem', minHeight: 'auto', fontSize: '0.8rem' }}
            onClick={() => setUserRole('hearing')}
          >
            🎧 Hearing (Speaker)
          </button>
          <button
            className={`btn ${userRole === 'unified' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.25rem 0.6rem', minHeight: 'auto', fontSize: '0.8rem' }}
            onClick={() => setUserRole('unified')}
          >
            🔄 Unified
          </button>
        </div>

        {/* Connection Status Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {connectionStatus === 'connected' ? (
            <span className="badge badge-success">🟢 Peer Connected</span>
          ) : connectionStatus === 'connecting' ? (
            <span className="badge badge-info">🟡 Handshaking WebRTC...</span>
          ) : (
            <span className="badge badge-secondary">⌛ Waiting for Peer to Join</span>
          )}
        </div>
      </div>

      {permissionState !== 'granted' ? (
        <div className="container" style={{ maxWidth: '640px', marginTop: '3rem' }}>
          <PermissionPrompt onRequestPermission={requestMediaAccess} />
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
          
          {/* Main Video Call Grid */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', gap: '1rem', overflowY: 'auto' }}>
            
            {/* Live Captions Bar (High Visibility for Deaf Participants) */}
            {(remoteTranscript || interimLocalTranscript) && (
              <div style={{
                background: 'rgba(15, 23, 42, 0.95)',
                border: '2px solid var(--accent-green)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1.25rem',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
                animation: 'fadeIn 0.2s ease-in'
              }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-green)', fontWeight: 700, marginBottom: '0.2rem' }}>
                  🎙️ Live Voice Captions (Speaker):
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff' }}>
                  {remoteTranscript || interimLocalTranscript}
                </div>
              </div>
            )}

            {/* Video Streams Container */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: remoteStream ? '1fr 1fr' : '1fr',
              gap: '1rem',
              flex: 1,
              minHeight: '340px'
            }}>
              
              {/* Local Webcam Video Tile */}
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <VideoTile
                  stream={localStream}
                  videoRef={localVideoRef}
                  canvasRef={localCanvasRef}
                  label={`You (${userRole === 'deaf' ? 'Signer' : userRole === 'hearing' ? 'Speaker' : 'Unified'})`}
                  isLocal={true}
                  isMuted={isAudioMuted}
                  isVideoOff={isVideoDisabled}
                  statusBadge={
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <span className="badge badge-success">Local ({fps} FPS)</span>
                      {localPredictedSign && (
                        <span className="badge badge-info">
                          {localPredictedSign.displayText}
                        </span>
                      )}
                    </div>
                  }
                />
              </div>

              {/* Remote Peer Video Tile */}
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                {remoteStream ? (
                  <VideoTile
                    stream={remoteStream}
                    label={`Peer (${remotePeerInfo?.role || 'Connected'})`}
                    isLocal={false}
                    statusBadge={
                      remoteReceivedSign && (
                        <span className="badge badge-info" style={{ fontSize: '1rem', padding: '0.4rem 0.8rem' }}>
                          🗣️ {remoteReceivedSign.displayText}
                        </span>
                      )
                    }
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '2px dashed var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                    padding: '2rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '3rem' }}>⏳</div>
                    <h3>Waiting for the other participant...</h3>
                    <p style={{ maxWidth: '380px', fontSize: '0.9rem' }}>
                      Share the room link or code <code style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{roomId}</code> to start the conversation.
                    </p>
                    <button className="btn btn-primary" onClick={copyRoomLink}>
                      {copiedLink ? '✅ Link Copied!' : '📋 Copy Shareable Link'}
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* In-Call Controls Bottom Bar */}
            <div className="control-bar" style={{ marginTop: 'auto' }}>
              <button
                className={`btn ${isAudioMuted ? 'btn-danger' : 'btn-secondary'}`}
                onClick={toggleAudio}
              >
                {isAudioMuted ? '🔇 Unmute' : '🎙️ Mute'}
              </button>

              <button
                className={`btn ${isVideoDisabled ? 'btn-danger' : 'btn-secondary'}`}
                onClick={toggleVideo}
              >
                {isVideoDisabled ? '📷 Start Video' : '🚫 Stop Video'}
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
                {isTTSActive ? '🔊 TTS Audio: On' : '🔇 TTS Audio: Muted'}
              </button>

              <button
                className={`btn ${isSTTActive ? 'btn-success' : 'btn-secondary'}`}
                onClick={toggleSTT}
              >
                {isSTTActive ? '🛑 Stop Voice Captions' : '🎙️ Broadcast Voice Captions'}
              </button>

              <button
                className={`btn ${isDrawerOpen ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              >
                💬 Chat & History {chatMessages.length > 0 && `(${chatMessages.length})`}
              </button>

              <button
                className="btn btn-danger"
                onClick={handleExit}
              >
                🛑 Leave Call
              </button>
            </div>

          </div>

          {/* Slide-over Drawer for Chat & Sign History */}
          {isDrawerOpen && (
            <div style={{
              width: '320px',
              background: 'var(--bg-surface)',
              borderLeft: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 30
            }}>
              {/* Drawer Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => setDrawerTab('chat')}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: drawerTab === 'chat' ? 'var(--bg-surface-elevated)' : 'transparent',
                    color: drawerTab === 'chat' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    border: 'none',
                    borderBottom: drawerTab === 'chat' ? '2px solid var(--accent-cyan)' : 'none',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  💬 Chat ({chatMessages.length})
                </button>
                <button
                  onClick={() => setDrawerTab('history')}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: drawerTab === 'history' ? 'var(--bg-surface-elevated)' : 'transparent',
                    color: drawerTab === 'history' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    border: 'none',
                    borderBottom: drawerTab === 'history' ? '2px solid var(--accent-cyan)' : 'none',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  📜 Sign Log ({signHistory.length})
                </button>
              </div>

              {/* Tab 1: Live Chat */}
              {drawerTab === 'chat' ? (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0.75rem', overflow: 'hidden' }}>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {chatMessages.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2rem' }}>
                        No messages yet. Send a message to your peer!
                      </div>
                    ) : (
                      chatMessages.map((msg) => (
                        <div key={msg.id} style={{ background: 'var(--bg-primary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                            <strong style={{ color: msg.senderName === 'Me' ? 'var(--accent-cyan)' : 'var(--accent-green)' }}>{msg.senderName}</strong>
                            <span>{msg.timestamp}</span>
                          </div>
                          <div style={{ fontSize: '0.9rem' }}>{msg.text}</div>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="text"
                      placeholder="Type a message..."
                      className="form-input"
                      style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 0.8rem', minHeight: 'auto' }}>
                      Send
                    </button>
                  </form>
                </div>
              ) : (
                /* Tab 2: Sign History */
                <div style={{ flex: 1, padding: '0.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {signHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2rem' }}>
                      No sign gestures logged yet in this call.
                    </div>
                  ) : (
                    signHistory.map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontWeight: 600, color: item.source === 'You' ? 'var(--accent-cyan)' : 'var(--accent-green)' }}>
                          {item.source}: {item.display}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.time}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
