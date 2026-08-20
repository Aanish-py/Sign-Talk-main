import React, { useEffect, useRef } from 'react';

/**
 * VideoTile Component
 * 
 * Displays an HTML5 video feed (local webcam or remote peer) with:
 * - Proper mirroring for local webcam
 * - Attached MediaStream lifecycle
 * - Overlay canvas support for drawing MediaPipe hand landmarks
 * - Status pills (Muted, Camera Off, Hand Tracking active)
 */
export default function VideoTile({
  stream,
  label = 'Camera',
  isLocal = false,
  isMuted = false,
  isVideoOff = false,
  videoRef: externalVideoRef = null,
  canvasRef = null,
  statusBadge = null
}) {
  const internalVideoRef = useRef(null);
  const activeVideoRef = externalVideoRef || internalVideoRef;

  useEffect(() => {
    if (activeVideoRef.current) {
      if (stream) {
        activeVideoRef.current.srcObject = stream;
      } else {
        activeVideoRef.current.srcObject = null;
      }
    }
  }, [stream, activeVideoRef]);

  return (
    <div className="video-wrapper">
      {/* Video element */}
      {isVideoOff ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'var(--text-muted)'
        }}>
          <div style={{ fontSize: '2.5rem' }}>📷🚫</div>
          <p style={{ fontWeight: 600 }}>Camera Disabled</p>
        </div>
      ) : (
        <video
          ref={activeVideoRef}
          autoPlay
          playsInline
          muted={isLocal} // Always mute local video to prevent audio feedback loop
          className={`video-element ${isLocal ? 'mirrored' : ''}`}
        />
      )}

      {/* Overlay Canvas for landmark visualization (MediaPipe) */}
      {canvasRef && !isVideoOff && (
        <canvas
          ref={canvasRef}
          className={`canvas-overlay ${isLocal ? 'mirrored' : ''}`}
        />
      )}

      {/* Top label badge */}
      <div className="video-label-badge">
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {stream && !isVideoOff && <span className="live-dot" />}
          {label}
        </span>
      </div>

      {/* Bottom status badge / hand tracking indicator */}
      {statusBadge && (
        <div className="video-status-badge">
          {statusBadge}
        </div>
      )}

      {/* Muted audio indicator */}
      {isMuted && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'rgba(239, 68, 68, 0.85)',
          color: '#ffffff',
          padding: '0.3rem 0.6rem',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          fontWeight: 700,
          zIndex: 10
        }}>
          🎤 Muted
        </div>
      )}
    </div>
  );
}
