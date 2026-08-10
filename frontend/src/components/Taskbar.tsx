import React, { useState, useEffect } from 'react';
import { Home, Battery, Wifi, Volume2 } from 'lucide-react';
import './Taskbar.css';

interface TaskbarProps {
  apps: { id: string; icon: React.ReactNode; isOpen: boolean; isFocused: boolean; name: string }[];
  onAppClick: (id: string) => void;
  onStartClick: () => void;
}

export const Taskbar: React.FC<TaskbarProps> = ({ apps, onAppClick, onStartClick }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="taskbar glass">
      <div className="taskbar-left">
        {/* Weather widget placeholder */}
        <div className="taskbar-weather">
          <span>☁️ 24°C</span>
        </div>
      </div>
      
      <div className="taskbar-center">
        <button className="taskbar-icon start-btn" onClick={onStartClick} title="Start">
          <Home size={22} color="#0078d4" />
        </button>
        
        {apps.map((app) => (
          <button
            key={app.id}
            className={`taskbar-icon ${app.isOpen ? 'open' : ''} ${app.isFocused ? 'focused' : ''}`}
            onClick={() => onAppClick(app.id)}
            title={app.name}
          >
            {app.icon}
            {app.isOpen && <div className="taskbar-indicator" />}
          </button>
        ))}
      </div>
      
      <div className="taskbar-right">
        <div className="system-tray">
          <Wifi size={16} />
          <Volume2 size={16} />
          <Battery size={16} />
        </div>
        <div className="taskbar-time">
          <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span>{time.toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};
