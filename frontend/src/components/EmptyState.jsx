import React from 'react';

/**
 * Clean reusable EmptyState component
 */
export default function EmptyState({ icon: Icon, title, description, action = null, className = '' }) {
  return (
    <div className={`empty-state ${className}`}>
      {Icon && (
        <div className="empty-state-icon">
          <Icon size={24} />
        </div>
      )}
      {title && <div className="empty-state-title">{title}</div>}
      {description && <div className="empty-state-desc">{description}</div>}
      {action && <div style={{ marginTop: '1rem' }}>{action}</div>}
    </div>
  );
}
