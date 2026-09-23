import React, { useState } from 'react';
import { IconClose, IconKeyboard } from './Icons';

export default function JoinModal({ isOpen, onClose, onJoin }) {
  const [inputVal, setInputVal] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    let code = inputVal.trim();
    if (!code) {
      setError('Please enter a meeting code or link.');
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
      setError('Meeting codes must be at least 3 characters.');
      return;
    }

    onJoin(code);
    setInputVal('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Join a meeting</div>
          <button className="btn-flat" onClick={onClose} aria-label="Close" style={{ padding: '0.25rem', borderRadius: '50%' }}>
            <IconClose size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" htmlFor="meeting-code-input">
              Enter meeting code or link
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="meeting-code-input"
                type="text"
                className="form-input"
                placeholder="e.g. isl-492"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                autoFocus
              />
            </div>
            {error && (
              <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                {error}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-flat" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!inputVal.trim()}>
              Join
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
