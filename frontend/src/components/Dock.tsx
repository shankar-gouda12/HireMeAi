import React from 'react';
import './Dock.css';

interface DockProps {
  apps: { id: string; icon: React.ReactNode; isOpen: boolean; isFocused: boolean; name: string }[];
  onAppClick: (id: string) => void;
}

export const Dock: React.FC<DockProps> = ({ apps, onAppClick }) => {
  return (
    <div className="dock-container">
      <div className="dock glass">
        {apps.map((app) => (
          <div key={app.id} className="dock-item-wrapper">
            <button
              className={`dock-icon ${app.id === 'chatgpt' ? 'dock-chat-button' : ''}`}
              onClick={() => onAppClick(app.id)}
              title={app.name}
            >
              {app.icon}
              {app.id === 'chatgpt' && <span>Ask Me</span>}
            </button>
            {app.isOpen && <div className="dock-indicator" />}
          </div>
        ))}
      </div>
    </div>
  );
};
