import React from 'react';
import signsData from '../ml/signs.json';

/**
 * Landing Page Component
 * 
 * Introduces the SignSpeak project, clearly presents the scope and
 * honest constraints of the static-pose approximation approach,
 * and provides navigation to create/join rooms or test hardware.
 */
export default function Landing({ onNavigate }) {
  return (
    <div className="container">
      {/* Hero Section */}
      <div style={{ textAlign: 'center', maxWidth: '820px', margin: '0 auto 2.5rem auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }} className="badge badge-info">
          <span>✨ Engineering Design & Innovation (EDI) Project</span>
        </div>
        <h1 style={{ marginBottom: '1rem' }}>
          Bridging Conversations with <span style={{ color: 'var(--accent-cyan)' }}>SignSpeak</span>
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '1.75rem' }}>
          An accessible, peer-to-peer video calling tool that translates Indian Sign Language static key-poses into spoken words and transcribes voice into real-time text.
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

      {/* Mandatory Scope & Limitation Disclosure */}
      <div className="notice-box notice-warning" style={{ maxWidth: '900px', margin: '0 auto 2.5rem auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div>
            <strong>Important Educational Scope & Constraint Notice:</strong>
            <p style={{ marginTop: '0.35rem', fontSize: '0.95rem' }}>
              This demo uses <strong>simplified static hand-pose approximations</strong> of words for recognition purposes. 
              It recognizes a small, predefined vocabulary of 10 static signs held in front of the webcam.
              <strong> It is NOT a full, fluent, or linguistically complete rendering of Indian Sign Language (ISL).</strong> 
              No raw video is ever sent to a server; all ML inference executes client-side inside your browser.
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
              A lightweight TensorFlow.js neural network classifies normalized coordinates into one of the 10 supported signs with anti-flicker stability.
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

      {/* Supported 10-Sign Vocabulary List */}
      <div className="card" style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h2>Supported Sign Vocabulary (10 Signs)</h2>
            <p style={{ fontSize: '0.95rem' }}>Hold each pose steadily in view of your camera to trigger recognition.</p>
          </div>
          <span className="badge badge-info">{signsData.length} Signs Configured</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {signsData.map((sign) => (
            <div 
              key={sign.id} 
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem'
              }}
            >
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                {sign.displayText}
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                {sign.description}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
