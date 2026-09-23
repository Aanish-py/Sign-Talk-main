import React, { useState } from 'react';
import { IconHandSign } from '../components/Icons';

export default function Auth({ onLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() && !name.trim()) {
      setError('Please enter your name or email to continue.');
      return;
    }

    const userData = {
      name: name.trim() || email.split('@')[0] || 'User',
      email: email.trim() || `${(name.trim() || 'user').toLowerCase().replace(/\s+/g, '')}@signspeak.local`
    };

    onLogin(userData);
  };

  const handleGuest = () => {
    const guestUser = {
      name: 'Guest Signer',
      email: `guest-${Math.floor(100 + Math.random() * 900)}@signspeak.local`
    };
    onLogin(guestUser);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem'
    }}>
      <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        
        {/* Brand Icon & Title */}
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '12px',
          backgroundColor: 'var(--accent-blue)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem auto',
          boxShadow: '0 2px 8px rgba(26, 115, 232, 0.3)'
        }}>
          <IconHandSign size={30} />
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          SignSpeak
        </h1>

        <p style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 400, marginBottom: '0.5rem' }}>
          Communication without barriers.
        </p>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.5 }}>
          Peer-to-peer video calling with real-time sign language recognition, text-to-speech, and live captions.
        </p>

        {/* Authentication Card */}
        <div className="card-white" style={{ padding: '2rem', textAlign: 'left' }}>
          {/* Session disclosure */}
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.4, padding: '0.6rem 0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
            Your details are stored only in this browser session. No account creation needed.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="auth-name">
                Your name
              </label>
              <input
                id="auth-name"
                type="text"
                className="form-input"
                placeholder="e.g. Alex Chen"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" htmlFor="auth-email">
                Email address
              </label>
              <input
                id="auth-email"
                type="email"
                className="form-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {error && (
              <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '0.75rem' }}>
              Start SignSpeak
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%' }}
              onClick={handleGuest}
            >
              Continue as Guest
            </button>
          </form>
        </div>

        {/* Privacy Note */}
        <p style={{ fontSize: '0.8rem', color: 'var(--text-disabled)', marginTop: '2rem', lineHeight: 1.4 }}>
          On-device AI: video frames and hand tracking are processed locally and never recorded or sent to a server.
        </p>

      </div>
    </div>
  );
}
