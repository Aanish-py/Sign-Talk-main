import React, { useState } from 'react';

/**
 * JoinRoom Page
 * 
 * Allows a peer to enter an existing room ID or full link
 * and connect to the room.
 */
export default function JoinRoom({ onNavigate, onEnterRoom }) {
  const [inputVal, setInputVal] = useState('');
  const [error, setError] = useState('');

  const handleJoin = (e) => {
    e.preventDefault();
    setError('');

    let code = inputVal.trim();
    if (!code) {
      setError('Please enter a room code or link.');
      return;
    }

    // Extract code if user pasted a full URL
    if (code.includes('room=')) {
      code = code.split('room=')[1].split('&')[0];
    } else if (code.includes('/')) {
      code = code.split('/').pop();
    }

    code = code.trim().toLowerCase();

    if (code.length < 3) {
      setError('Invalid room code. Room codes must be at least 3 characters.');
      return;
    }

    if (onEnterRoom) {
      onEnterRoom(code, false); // false = not host
    }
  };

  return (
    <div className="container" style={{ maxWidth: '640px' }}>
      <div className="card">
        <h2 style={{ marginBottom: '0.5rem' }}>Join an Existing Call</h2>
        <p style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          Enter the room code (e.g. <code>isl-492</code>) or paste the link you were given.
        </p>

        <form onSubmit={handleJoin}>
          <div className="form-group">
            <label className="form-label" htmlFor="room-code-input">Room Code or Link</label>
            <input
              id="room-code-input"
              type="text"
              placeholder="e.g. isl-492 or paste link"
              className="form-input"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              autoFocus
            />
            {error && (
              <p style={{ color: 'var(--accent-red)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                ⚠️ {error}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => onNavigate('landing')} style={{ flex: 1 }}>
              ← Back
            </button>
            <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 2 }}>
              🔗 Join Video Call
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
