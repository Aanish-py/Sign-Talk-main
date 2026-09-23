import React, { useState } from 'react';
import { IconPlus, IconHandSign } from './Icons';
import ProfileMenu from './ProfileMenu';

export default function Header({ currentPage, onNavigate, user, onSignOut, onStartMeeting }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : (user?.email ? user.email.slice(0, 2).toUpperCase() : 'U');

  return (
    <header className="app-header">
      {/* Left: Brand */}
      <div className="brand" onClick={() => onNavigate('dashboard')}>
        <div className="brand-icon">
          <IconHandSign size={22} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span className="brand-name">SignSpeak</span>
          <span className="brand-badge">P2P</span>
        </div>
      </div>

      {/* Center: Navigation (Home, Live Studio - NO AI Studio) */}
      <nav className="nav-group">
        <button
          className={`nav-link-btn ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          Home
        </button>
        <button
          className={`nav-link-btn ${currentPage === 'studio' ? 'active' : ''}`}
          onClick={() => onNavigate('studio')}
        >
          Live Studio
        </button>
      </nav>

      {/* Right: New meeting CTA + Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
        <button
          className="btn btn-primary"
          style={{ padding: '0.45rem 0.9rem', fontSize: '0.875rem' }}
          onClick={onStartMeeting}
        >
          <IconPlus size={18} />
          <span>New meeting</span>
        </button>

        <button
          className="avatar-btn"
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          aria-label="User profile"
        >
          {initials}
        </button>

        {isProfileOpen && (
          <ProfileMenu
            user={user}
            onNavigate={onNavigate}
            onSignOut={onSignOut}
            onClose={() => setIsProfileOpen(false)}
          />
        )}
      </div>
    </header>
  );
}
