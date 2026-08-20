import React, { useState, useEffect } from 'react';
import Landing from './pages/Landing';
import CameraPreview from './pages/CameraPreview';
import CreateRoom from './pages/CreateRoom';
import JoinRoom from './pages/JoinRoom';
import DataCollector from './pages/DataCollector';
import Room from './pages/Room';

/**
 * SignSpeak Root App Component
 * 
 * Manages routing across:
 * - 'landing': Project overview, limitation notice, vocabulary
 * - 'preview': Webcam, landmark tracker & live translation studio (Stages 1, 2, 5, 6)
 * - 'collector': Landmark data collection & TF.js training studio (Stages 3, 4)
 * - 'create': Generate room code & link
 * - 'join': Enter room code & join
 * - 'call': Live WebRTC video call with two-way translation (Stages 7-9)
 */
export default function App() {
  const [currentPage, setCurrentPage] = useState('landing');
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [isHost, setIsHost] = useState(false);

  // Check URL hash on initial load (e.g. #room=isl-492)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#room=')) {
        const roomId = hash.replace('#room=', '').split('&')[0];
        if (roomId) {
          setActiveRoomId(roomId);
          setIsHost(false);
          setCurrentPage('call');
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleEnterRoom = (roomId, hostStatus = false) => {
    setActiveRoomId(roomId);
    setIsHost(hostStatus);
    window.location.hash = `room=${roomId}`;
    setCurrentPage('call');
  };

  const handleLeaveCall = () => {
    setActiveRoomId(null);
    window.location.hash = '';
    setCurrentPage('landing');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Accessible Header Navigation */}
      <header className="app-header">
        <div className="logo-area" style={{ cursor: 'pointer' }} onClick={() => setCurrentPage('landing')}>
          <div className="logo-icon">🤟</div>
          <div>
            <div className="logo-title">SignSpeak</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1 }}>
              ISL Sign-to-Speech Video Call
            </div>
          </div>
        </div>

        <nav className="nav-links">
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.4rem 0.9rem', minHeight: 'auto', fontSize: '0.9rem' }}
            onClick={() => setCurrentPage('landing')}
          >
            🏠 Home
          </button>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.4rem 0.9rem', minHeight: 'auto', fontSize: '0.9rem' }}
            onClick={() => setCurrentPage('preview')}
          >
            📷 Live Studio
          </button>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.4rem 0.9rem', minHeight: 'auto', fontSize: '0.9rem' }}
            onClick={() => setCurrentPage('collector')}
          >
            🧠 AI Studio
          </button>
          <button 
            className="btn btn-primary" 
            style={{ padding: '0.4rem 0.9rem', minHeight: 'auto', fontSize: '0.9rem' }}
            onClick={() => setCurrentPage('create')}
          >
            📹 New Call
          </button>
        </nav>
      </header>

      {/* Main Page Routing */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {currentPage === 'landing' && (
          <Landing onNavigate={setCurrentPage} />
        )}

        {currentPage === 'preview' && (
          <CameraPreview onNavigate={setCurrentPage} />
        )}

        {currentPage === 'collector' && (
          <DataCollector onNavigate={setCurrentPage} />
        )}

        {currentPage === 'create' && (
          <CreateRoom onNavigate={setCurrentPage} onEnterRoom={handleEnterRoom} />
        )}

        {currentPage === 'join' && (
          <JoinRoom onNavigate={setCurrentPage} onEnterRoom={handleEnterRoom} />
        )}

        {currentPage === 'call' && activeRoomId && (
          <Room
            roomId={activeRoomId}
            isHost={isHost}
            onLeaveCall={handleLeaveCall}
          />
        )}
      </main>

      {/* Global Footer with Educational Disclosure (Hidden on Call screen for maximum viewport) */}
      {currentPage !== 'call' && (
        <footer className="app-footer">
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              SignSpeak — Engineering Design & Innovation (EDI) Project MVP
            </p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
              Notice: Simplified static hand-pose approximations are used for demo recognition. 
              Runs 100% client-side in the browser. No raw video is stored or transmitted to a server.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
