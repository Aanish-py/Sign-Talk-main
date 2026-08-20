import React from 'react';

/**
 * PermissionPrompt Component
 * 
 * Explains to the user why camera/microphone access is required BEFORE
 * triggering the browser's permission dialog. Also displays helpful recovery
 * instructions if the user previously denied permission.
 */
export default function PermissionPrompt({ 
  onRequestPermission, 
  errorState, 
  onRetry,
  needAudio = true 
}) {
  return (
    <div className="card" style={{ maxWidth: '640px', margin: '2rem auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: 'rgba(56, 189, 248, 0.15)',
          color: 'var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem'
        }}>
          📷
        </div>
        <div>
          <h2>Camera & Microphone Access</h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
            Required for sign landmark tracking and two-way video calling
          </p>
        </div>
      </div>

      {errorState ? (
        <div className="notice-box notice-danger">
          <strong>Access Blocked or Unavailable:</strong>
          <p style={{ marginTop: '0.5rem', color: '#fee2e2' }}>
            {errorState.message || 'The browser was unable to access your camera or microphone.'}
          </p>
          <div style={{ marginTop: '1rem', fontSize: '0.9rem', background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '6px' }}>
            <strong>How to fix this:</strong>
            <ol style={{ marginLeft: '1.25rem', marginTop: '0.25rem' }}>
              <li>Click the lock or camera icon next to the URL in your browser address bar.</li>
              <li>Change <em>Camera</em> and <em>Microphone</em> permissions to <strong>Allow</strong>.</li>
              <li>Ensure no other application (like Zoom or Teams) is using your webcam.</li>
              <li>Click <strong>Retry Access</strong> below.</li>
            </ol>
          </div>
          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-primary" onClick={onRetry}>
              🔄 Retry Access
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="notice-box notice-info">
            <strong>🔒 Privacy Guarantee:</strong>
            <p style={{ marginTop: '0.35rem', fontSize: '0.95rem' }}>
              Your camera stream is processed <strong>locally inside your browser</strong> by AI models (MediaPipe & TensorFlow.js). 
              Raw video frames are <strong>never</strong> recorded, saved, or uploaded to any server.
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ marginBottom: '0.75rem' }}>
              SignSpeak uses:
            </p>
            <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)' }}>
              <li><strong>Webcam:</strong> To track 21 hand landmarks and recognize static Indian Sign Language key-poses.</li>
              {needAudio && <li><strong>Microphone:</strong> To enable real-time speech transcription for hearing participants.</li>}
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button 
              className="btn btn-primary btn-lg" 
              onClick={onRequestPermission}
              style={{ width: '100%' }}
            >
              ✅ Grant Camera & Mic Access
            </button>
          </div>
        </>
      )}
    </div>
  );
}
