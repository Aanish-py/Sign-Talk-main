import React from 'react';

/**
 * Landing Page Component
 * 
 * Introduces SignSpeak, presenting the accessibility features,
 * client-side ML approach, and navigation.
 */
export default function Landing({ onNavigate }) {
  return (
    <div className="container">
      {/* Hero Section */}
      <div style={{ textAlign: 'center', maxWidth: '820px', margin: '0 auto 2.5rem auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }} className="badge badge-info">
          <span>✨ Accessible Video Communication</span>
        </div>
        <h1 style={{ marginBottom: '1rem' }}>
          Bridging Conversations with <span style={{ color: 'var(--accent-cyan)' }}>SignSpeak</span>
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '1.75rem' }}>
          An accessible video calling platform translating sign language poses into spoken words and voice into real-time captions.
        </p>

        {/* Primary Call to Actions */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-lg" onClick={() => onNavigate('create')}>
            📹 Create Video Call
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => onNavigate('join')}>
            🔗 Join with Code
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => onNavigate('preview')}>
            📷 Test Camera & Tracker
          </button>
        </div>
      </div>

      {/* Scope & Privacy Notice */}
      <div className="notice-box notice-warning" style={{ maxWidth: '900px', margin: '0 auto 2.5rem auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
          <div>
            <strong>Educational Scope & Model Notice:</strong>
            <p style={{ marginTop: '0.35rem', fontSize: '0.95rem' }}>
              This system uses client-side machine learning for static hand-pose approximations.
              All inference executes directly inside your browser — no raw video or hand coordinates are ever recorded or sent to a server.
            </p>
          </div>
        </div>
      </div>

      {/* How it Works Grid */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>How SignSpeak Works</h2>
        <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          
          <div className="card">
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🖐️</div>
            <h3>1. Local Hand Tracking</h3>
            <p style={{ marginTop: '0.5rem', fontSize: '0.95rem' }}>
              MediaPipe Hands detects 21 3D coordinates on your hand directly in your browser without sending video across the network.
            </p>
          </div>

          <div className="card">
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧠</div>
            <h3>2. Neural Classification</h3>
            <p style={{ marginTop: '0.5rem', fontSize: '0.95rem' }}>
              A lightweight TensorFlow.js neural network classifies hand coordinates with anti-flicker stability.
            </p>
          </div>

          <div className="card">
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔊</div>
            <h3>3. Text-to-Speech (TTS)</h3>
            <p style={{ marginTop: '0.5rem', fontSize: '0.95rem' }}>
              Confirmed sign poses trigger the browser SpeechSynthesis API, speaking the sign aloud for the hearing participant.
            </p>
          </div>

          <div className="card">
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎙️</div>
            <h3>4. Speech-to-Text (STT)</h3>
            <p style={{ marginTop: '0.5rem', fontSize: '0.95rem' }}>
              The hearing user's spoken words are transcribed in real-time and displayed on the Deaf user's screen as clear text.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
