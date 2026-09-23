import React, { useRef, useEffect } from 'react';
import { IconUser, IconSettings, IconLogout, IconVideo } from './Icons';

export default function ProfileMenu({ user, onNavigate, onSignOut, onClose }) {
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : (user?.email ? user.email.slice(0, 2).toUpperCase() : 'U');

  return (
    <div className="profile-popover" ref={popoverRef}>
      {/* User Information */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
        <div className="avatar-btn" style={{ width: '42px', height: '42px', fontSize: '1rem' }}>
          {initials}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {user?.name || 'SignSpeak User'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {user?.email || 'user@signspeak.local'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-disabled)', marginTop: '0.2rem' }}>
            Browser session only
          </div>
        </div>
      </div>

      {/* Menu Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingTop: '0.5rem' }}>
        <button
          className="btn-flat"
          style={{ width: '100%', justifyContent: 'flex-start', padding: '0.5rem 0.6rem', borderRadius: '4px', fontSize: '0.875rem' }}
          onClick={() => {
            onClose();
            onNavigate('studio');
          }}
        >
          <IconVideo size={18} style={{ color: 'var(--text-secondary)' }} />
          <span>Camera & Microphone</span>
        </button>

        <button
          className="btn-flat"
          style={{ width: '100%', justifyContent: 'flex-start', padding: '0.5rem 0.6rem', borderRadius: '4px', fontSize: '0.875rem', color: 'var(--color-danger)' }}
          onClick={() => {
            onClose();
            onSignOut();
          }}
        >
          <IconLogout size={18} style={{ color: 'var(--color-danger)' }} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}
