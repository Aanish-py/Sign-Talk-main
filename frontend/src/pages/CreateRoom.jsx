import React, { useState } from 'react';

/**
 * CreateRoom Page
 * 
 * Generates a random room code and allows the user to copy
 * the shareable link or proceed directly to the call.
 */
export default function CreateRoom({ onNavigate, onEnterRoom }) {
  const [roomId] = useState(() => {
    // Generate a human-friendly 6-character room code (e.g. "isl-492")
    const num = Math.floor(100 + Math.random() * 900);
    return `isl-${num}`;
  });

  const [copied, setCopied] = useState(false);

  const roomUrl = `${window.location.origin}/#room=${roomId}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleStartCall = () => {
    if (onEnterRoom) {
      onEnterRoom(roomId, true); // true = isHost
    }
  };

  return (
    <div className="container" style={{ maxWidth: '640px' }}>
      <div className="card">
        <h2 style={{ marginBottom: '0.5rem' }}>Create a New Video Call</h2>
        <p style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          Share the room code or link below with the other participant to start your call.
        </p>

        <div className="form-group">
          <label className="form-label">Generated Room Code</label>
          <div style={{
            background: 'var(--bg-primary)',
            border: '2px solid var(--accent-cyan)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            textAlign: 'center',
            fontSize: '1.8rem',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.1em',
            color: 'var(--accent-cyan)'
          }}>
            {roomId}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Shareable Call Link</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              readOnly
              value={roomUrl}
              className="form-input"
              style={{ fontSize: '0.95rem' }}
            />
            <button className="btn btn-secondary" onClick={copyToClipboard}>
              {copied ? '✅ Copied!' : '📋 Copy'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button className="btn btn-secondary" onClick={() => onNavigate('landing')} style={{ flex: 1 }}>
            ← Back
          </button>
          <button className="btn btn-primary btn-lg" onClick={handleStartCall} style={{ flex: 2 }}>
            🚀 Enter Room & Connect
          </button>
        </div>
      </div>
    </div>
  );
}
