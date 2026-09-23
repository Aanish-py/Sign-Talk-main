import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import CameraPreview from './pages/CameraPreview';

/**
 * SignSpeak Root App Component
 * 
 * Google Meet-inspired clean light/white communication platform.
 * Routes:
 * - 'auth': Clean session entry
 * - 'dashboard': Main conversational hub
 * - 'lobby': Pre-meeting camera/mic preview & role selection
 * - 'call': Flagship 2-way WebRTC meeting room
 * - 'studio': Diagnostic hardware & recognition workbench
 */
export default function App() {
  // Session User State
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('signspeak_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Recent Rooms (real visited rooms stored in localStorage)
  const [recentRooms, setRecentRooms] = useState(() => {
    try {
      const saved = localStorage.getItem('signspeak_recent_rooms');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentPage, setCurrentPage] = useState(() => (user ? 'dashboard' : 'auth'));
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [roomRole, setRoomRole] = useState('unified');
  const [roomSettings, setRoomSettings] = useState({});

  // Helper to record a room to recent history
  const recordRoom = (roomId) => {
    setRecentRooms((prev) => {
      const filtered = prev.filter((r) => r.id !== roomId);
      const updated = [{ id: roomId, timestamp: Date.now() }, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('signspeak_recent_rooms', JSON.stringify(updated));
      } catch (err) {
        console.warn('Could not save recent room:', err);
      }
      return updated;
    });
  };

  // URL Hash routing (e.g. #room=isl-492)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#room=')) {
        const roomId = hash.replace('#room=', '').split('&')[0];
        if (roomId) {
          setActiveRoomId(roomId);
          if (user) {
            setCurrentPage('lobby');
          } else {
            setCurrentPage('auth');
          }
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [user]);

  // Auth Handlers
  const handleLogin = (userData) => {
    setUser(userData);
    try {
      localStorage.setItem('signspeak_user', JSON.stringify(userData));
    } catch (err) {
      console.warn('Could not save user session:', err);
    }

    if (activeRoomId) {
      setCurrentPage('lobby');
    } else {
      setCurrentPage('dashboard');
    }
  };

  const handleSignOut = () => {
    setUser(null);
    try {
      localStorage.removeItem('signspeak_user');
    } catch (err) {
      console.warn('Could not clear user session:', err);
    }
    setActiveRoomId(null);
    window.location.hash = '';
    setCurrentPage('auth');
  };

  // New Meeting Flow: Generate human-friendly code & open Lobby
  const handleStartNewMeeting = () => {
    const num = Math.floor(100 + Math.random() * 900);
    const code = `isl-${num}`;
    setActiveRoomId(code);
    setCurrentPage('lobby');
  };

  // Join Room from Dashboard Modal or Rejoin
  const handleJoinFromCode = (code) => {
    setActiveRoomId(code);
    setCurrentPage('lobby');
  };

  // Enter Call from Pre-join Lobby
  const handleJoinMeetingFromLobby = (roomId, role, settings) => {
    setActiveRoomId(roomId);
    setRoomRole(role);
    setRoomSettings(settings);
    recordRoom(roomId);
    window.location.hash = `room=${roomId}`;
    setCurrentPage('call');
  };

  // Exit Call
  const handleLeaveCall = () => {
    setActiveRoomId(null);
    window.location.hash = '';
    setCurrentPage('dashboard');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#ffffff' }}>
      
      {/* Global Header (shown on all pages except Call and Auth) */}
      {currentPage !== 'call' && currentPage !== 'auth' && (
        <Header
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          user={user}
          onSignOut={handleSignOut}
          onStartMeeting={handleStartNewMeeting}
        />
      )}

      {/* Main Views */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {currentPage === 'auth' && (
          <Auth onLogin={handleLogin} />
        )}

        {currentPage === 'dashboard' && (
          <Dashboard
            user={user}
            onNavigate={setCurrentPage}
            onStartMeeting={handleStartNewMeeting}
            onJoinRoom={handleJoinFromCode}
            recentRooms={recentRooms}
          />
        )}

        {currentPage === 'lobby' && (
          <Lobby
            roomId={activeRoomId || `isl-${Math.floor(100 + Math.random() * 900)}`}
            onJoinRoom={handleJoinMeetingFromLobby}
            onCancel={() => {
              setActiveRoomId(null);
              window.location.hash = '';
              setCurrentPage('dashboard');
            }}
          />
        )}

        {currentPage === 'call' && activeRoomId && (
          <Room
            roomId={activeRoomId}
            initialRole={roomRole}
            initialSettings={roomSettings}
            onLeaveCall={handleLeaveCall}
          />
        )}

        {currentPage === 'studio' && (
          <CameraPreview onNavigate={setCurrentPage} />
        )}
      </main>

      {/* Clean, Subtle Educational Disclosure Footer (omitted during active call) */}
      {currentPage !== 'call' && currentPage !== 'auth' && (
        <footer style={{
          backgroundColor: '#ffffff',
          borderTop: '1px solid var(--border-light)',
          padding: '1.5rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ maxWidth: '820px', margin: '0 auto', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              SignSpeak — Real-Time Accessible Video Communication
            </div>
            <div>
              Notice: Educational engineering prototype recognizing 10 static ISL key-poses client-side. No raw video is stored or transmitted to a server.
            </div>
          </div>
        </footer>
      )}

    </div>
  );
}
