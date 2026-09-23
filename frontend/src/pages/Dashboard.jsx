import React, { useState } from 'react';
import { IconVideo, IconKeyboard, IconHistory, IconHandSign, IconCopy, IconCheck } from '../components/Icons';
import JoinModal from '../components/JoinModal';
import EmptyState from '../components/EmptyState';

export default function Dashboard({ user, onNavigate, onStartMeeting, onJoinRoom, recentRooms = [] }) {
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div style={{ flex: 1, backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
      
      {/* Hero Section */}
      <div style={{ maxWidth: '960px', margin: '3rem auto 2rem auto', padding: '0 1.5rem', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem', alignItems: 'center' }}>
          
          {/* Left Column: Heading & CTAs */}
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 400, color: 'var(--text-primary)', marginBottom: '1rem', lineHeight: 1.25 }}>
              Video calls with real-time sign language interpretation
            </h1>
            
            <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', marginBottom: '2.5rem', lineHeight: 1.5 }}>
              Connect and converse seamlessly with instant sign-to-speech translation and real-time live captions.
            </p>

            {/* Primary Actions: New Meeting & Join with Code */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={onStartMeeting}
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
              >
                <IconVideo size={20} />
                <span>New meeting</span>
              </button>

              <button
                className="btn btn-secondary btn-lg"
                onClick={() => setIsJoinModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
              >
                <IconKeyboard size={20} />
                <span>Join with code</span>
              </button>
            </div>
          </div>

          {/* Right Column: Visual Product Preview / Graphic Card */}
          <div>
            <div className="card-white" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--accent-blue-light)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconHandSign size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Two-Way Accessibility</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sign-to-speech & live captions</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.9rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Sign to Voice</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Hand gestures detected on camera are recognized and spoken aloud in real time.
                  </div>
                </div>

                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Voice to Text</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Spoken words from the microphone are transcribed into real-time live captions.
                  </div>
                </div>

                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Private & On-Device</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    All video processing and machine learning run directly in your browser. No server recording.
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Recent Meetings / Activity Section */}
        <div style={{ marginTop: '3.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '2.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            Recent calls
          </h2>

          {recentRooms.length === 0 ? (
            <EmptyState
              icon={IconHistory}
              title="No recent calls"
              description="Calls you create or join will appear here for quick access."
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {recentRooms.map((room) => (
                <div
                  key={room.id}
                  className="card-white"
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {room.id}
                    </span>
                    <button
                      className="btn-flat"
                      onClick={() => handleCopy(room.id)}
                      title="Copy room code"
                      style={{ padding: '0.25rem' }}
                    >
                      {copiedCode === room.id ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </button>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {room.timestamp ? new Date(room.timestamp).toLocaleDateString() : 'Recent call'}
                  </div>

                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', marginTop: '0.25rem', fontSize: '0.85rem', padding: '0.45rem' }}
                    onClick={() => onJoinRoom(room.id)}
                  >
                    Rejoin call
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Join with Code Modal */}
      <JoinModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onJoin={onJoinRoom}
      />

    </div>
  );
}
