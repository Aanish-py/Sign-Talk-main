import React, { useState, useEffect, useRef } from 'react';
import VideoTile from '../components/VideoTile';
import { IconMic, IconMicOff, IconVideo, IconVideoOff, IconCopy, IconCheck } from '../components/Icons';

export default function Lobby({ roomId, onJoinRoom, onCancel }) {
  const [localStream, setLocalStream] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [selectedRole, setSelectedRole] = useState('unified'); // 'deaf' | 'hearing' | 'unified'
  const [copiedLink, setCopiedLink] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const videoRef = useRef(null);

  // Initialize camera preview
  useEffect(() => {
    let streamRef = null;
    // Tracks whether the stream was handed off to Room on join.
    // If handed off, Room owns the stream and is responsible for stopping it.
    // If NOT handed off (cancel/error), this cleanup stops it.
    let streamHandedOff = false;

    const startCamera = async () => {
      setCameraLoading(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: true
        });
        streamRef = stream;
        setLocalStream(stream);
      } catch (err) {
        console.error('Lobby camera access error:', err);
        setCameraError('Unable to access camera or microphone. Please check your browser permissions.');
      } finally {
        setCameraLoading(false);
      }
    };

    startCamera();

    // Expose a way to mark the stream as handed off before unmount
    // We attach this to the component via a module-level flag since
    // useEffect closures capture variables at creation time.
    window.__lobbyStreamHandedOff = false;

    return () => {
      // Only stop tracks if the user cancelled/errored — not if they joined.
      // When joining, Room receives the stream and calls track.stop() itself.
      if (streamRef && !window.__lobbyStreamHandedOff) {
        streamRef.getTracks().forEach((track) => track.stop());
      }
      delete window.__lobbyStreamHandedOff;
    };
  }, []);

  const toggleMic = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioMuted(!audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoDisabled(!videoTrack.enabled);
    }
  };

  const copyMeetingLink = () => {
    const link = `${window.location.origin}/#room=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleJoin = () => {
    // Mark stream as handed off to Room — Lobby cleanup must NOT stop it.
    window.__lobbyStreamHandedOff = true;
    onJoinRoom(roomId, selectedRole, {
      isAudioMuted,
      isVideoDisabled,
      existingStream: localStream
    });
  };

  // Join is enabled once camera resolves (success or permission error) — never during loading
  const canJoin = !cameraLoading;

  return (
    <div style={{ flex: 1, backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '1040px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '3rem', alignItems: 'center' }}>
        
        {/* Left: Video Preview & Quick Hardware Controls */}
        <div>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-md)', backgroundColor: '#202124' }}>

            {/* Camera initializing state */}
            {cameraLoading && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9aa0a6', gap: '0.85rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: '3px solid rgba(255,255,255,0.1)',
                  borderTopColor: '#1a73e8',
                  animation: 'spin 0.9s linear infinite'
                }} />
                <span style={{ fontSize: '0.9rem' }}>Initializing camera…</span>
              </div>
            )}

            {/* Camera access error */}
            {!cameraLoading && cameraError && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', color: '#ffffff' }}>
                <div style={{ marginBottom: '0.75rem', color: '#f28b82' }}>
                  <IconVideoOff size={36} />
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 500, marginBottom: '0.5rem' }}>Camera access required</div>
                <div style={{ fontSize: '0.85rem', color: '#9aa0a6' }}>{cameraError}</div>
              </div>
            )}

            {/* Live camera preview — only when stream is real */}
            {!cameraLoading && !cameraError && (
              <VideoTile
                stream={localStream}
                videoRef={videoRef}
                label="You"
                isLocal={true}
                isMuted={isAudioMuted}
                isVideoOff={isVideoDisabled}
              />
            )}

            {/* Floating Hardware Controls — only when stream is available */}
            {!cameraLoading && !cameraError && (
              <div style={{
                position: 'absolute',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                zIndex: 20
              }}>
                <button
                  type="button"
                  className={`ctrl-btn ${isAudioMuted ? 'danger' : ''}`}
                  onClick={toggleMic}
                  title={isAudioMuted ? 'Turn on microphone' : 'Turn off microphone'}
                >
                  {isAudioMuted ? <IconMicOff size={20} /> : <IconMic size={20} />}
                </button>

                <button
                  type="button"
                  className={`ctrl-btn ${isVideoDisabled ? 'danger' : ''}`}
                  onClick={toggleCamera}
                  title={isVideoDisabled ? 'Turn on camera' : 'Turn off camera'}
                >
                  {isVideoDisabled ? <IconVideoOff size={20} /> : <IconVideo size={20} />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Meeting Details & Role Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '440px' }}>
          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Ready to join?
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Set your preferred communication role before entering the call.
            </p>
          </div>

          {/* Role Segmented Control */}
          <div className="card-white" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Select your conversation role
            </div>

            <div className="segmented-control" style={{ width: '100%', display: 'flex' }}>
              <button
                type="button"
                className={`segmented-btn ${selectedRole === 'deaf' ? 'active' : ''}`}
                onClick={() => setSelectedRole('deaf')}
                style={{ flex: 1 }}
              >
                Signer
              </button>
              <button
                type="button"
                className={`segmented-btn ${selectedRole === 'hearing' ? 'active' : ''}`}
                onClick={() => setSelectedRole('hearing')}
                style={{ flex: 1 }}
              >
                Speaker
              </button>
              <button
                type="button"
                className={`segmented-btn ${selectedRole === 'unified' ? 'active' : ''}`}
                onClick={() => setSelectedRole('unified')}
                style={{ flex: 1 }}
              >
                Unified
              </button>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: 1.4 }}>
              {selectedRole === 'deaf' && 'Signer mode: Hand gestures are tracked and spoken aloud in real time.'}
              {selectedRole === 'hearing' && 'Speaker mode: Your speech is transcribed into live captions on screen.'}
              {selectedRole === 'unified' && 'Unified mode: Both sign-to-speech and live voice captions are active.'}
            </div>
          </div>

          {/* Room Code Display & Copy Link */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.25rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Meeting code</div>
              <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{roomId}</div>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={copyMeetingLink}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              {copiedLink ? <IconCheck size={16} /> : <IconCopy size={16} />}
              <span>{copiedLink ? 'Link copied' : 'Copy link'}</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-flat"
              onClick={onCancel}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={handleJoin}
              disabled={!canJoin}
              style={{
                flex: 2,
                opacity: canJoin ? 1 : 0.55,
                cursor: canJoin ? 'pointer' : 'not-allowed'
              }}
              title={cameraLoading ? 'Waiting for camera to initialize…' : undefined}
            >
              {cameraLoading ? 'Initializing…' : 'Join meeting'}
            </button>
          </div>

          {/* Camera error — user can still join without video */}
          {!cameraLoading && cameraError && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              You can still join the call without camera access. Other participants will not see your video.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
