import React, { useEffect, useRef } from 'react';
import { IconMicOff, IconVideoOff } from './Icons';

/**
 * VideoTile Component
 *
 * Clean, modern video tile with:
 * - HTML5 video stream binding
 * - Mirroring for local webcam
 * - Landmark canvas overlay
 * - Clean SVG indicators for muted audio & disabled video
 * - Name badge & optional status pill
 *
 * CRITICAL — video element lifecycle:
 * The <video> element is ALWAYS kept in the DOM even when isVideoOff=true.
 * We use CSS display:none to hide it instead of conditional rendering.
 *
 * Why: When the video element is conditionally unmounted and remounted, the
 * ref.current becomes a fresh DOM node. The useEffect that binds srcObject
 * only re-runs when [stream] changes — but stream.identity is the same after
 * track.enabled toggle. The new node therefore never receives srcObject,
 * causing a permanently black video after camera re-enable.
 *
 * Keeping the element in the DOM preserves the srcObject binding across
 * camera OFF → ON cycles.
 */
export default function VideoTile({
  stream,
  label = 'Participant',
  isLocal = false,
  isMuted = false,
  isVideoOff = false,
  videoRef: externalVideoRef = null,
  canvasRef = null,
  statusBadge = null,
  statusOverride = null  // honest diagnostic: shown as overlay text when non-null
}) {
  const internalVideoRef = useRef(null);
  const activeVideoRef = externalVideoRef || internalVideoRef;

  // Bind/unbind srcObject and ensure playback whenever stream changes.
  // NOTE: This effect must NOT depend on isVideoOff — the video element stays
  // mounted regardless, so srcObject must always be bound when stream exists.
  useEffect(() => {
    const video = activeVideoRef.current;
    if (!video) return;

    if (stream) {
      // Only reassign srcObject when it has actually changed to avoid
      // unnecessary play() calls that could interrupt active playback.
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }

      // Explicitly call play() to handle browsers/situations where autoPlay
      // alone doesn't restart after a re-bind or after the element was hidden.
      if (video.paused) {
        video.play().catch((err) => {
          // AbortError is normal when play() is interrupted by a subsequent
          // pause/stop — not a real failure.
          if (err.name !== 'AbortError') {
            console.warn('[VideoTile] video.play() rejected:', err.name, err.message);
          }
        });
      }
    } else {
      video.srcObject = null;
    }
  }, [stream, activeVideoRef]);

  // When camera is re-enabled (isVideoOff goes false→true), explicitly
  // resume playback in case the browser paused it while the element was hidden.
  useEffect(() => {
    const video = activeVideoRef.current;
    if (!video || !stream) return;

    if (!isVideoOff && video.paused) {
      video.play().catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('[VideoTile] play() on camera re-enable rejected:', err.name, err.message);
        }
      });
    }
  }, [isVideoOff, stream, activeVideoRef]);

  return (
    <div className="video-wrapper">
      {/*
        Video element is ALWAYS in the DOM.
        display:none hides it visually when camera is off.
        This preserves srcObject binding across toggle cycles.
      */}
      <video
        ref={activeVideoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{ display: isVideoOff ? 'none' : undefined }}
        className={`video-element ${isLocal ? 'mirrored' : ''}`}
      />

      {/* Camera-off placeholder — rendered as overlay when camera is disabled */}
      {isVideoOff && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          color: 'var(--text-disabled)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#303134',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9aa0a6'
          }}>
            <IconVideoOff size={32} />
          </div>
          <span style={{ fontSize: '0.85rem', color: '#9aa0a6', fontWeight: 500 }}>Camera is off</span>
        </div>
      )}

      {/* Overlay Canvas for landmark visualization (MediaPipe) */}
      {canvasRef && !isVideoOff && (
        <canvas
          ref={canvasRef}
          className={`canvas-overlay ${isLocal ? 'mirrored' : ''}`}
        />
      )}

      {/* Bottom Name Badge */}
      <div className="video-name-badge">
        <span>{label}</span>
      </div>

      {/* Top Status Indicators (Muted, Tracking) */}
      <div className="video-status-indicators">
        {statusBadge}
        {isMuted && (
          <div className="status-pill danger" title="Microphone is off">
            <IconMicOff size={14} />
          </div>
        )}
      </div>

      {/* Diagnostic status overlay — only when statusOverride is provided */}
      {statusOverride && (
        <div style={{
          position: 'absolute',
          bottom: '36px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(251, 188, 4, 0.92)',
          color: '#1a1a1a',
          fontSize: '0.7rem',
          fontWeight: 600,
          padding: '0.2rem 0.6rem',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 20
        }}>
          {statusOverride}
        </div>
      )}
    </div>
  );
}
