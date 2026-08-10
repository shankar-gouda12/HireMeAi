import React from 'react';
import './DesktopIcon.css';

interface DesktopIconProps {
  icon: React.ReactNode;
  name: string;
  onClick: () => void;
}

export const DesktopIcon: React.FC<DesktopIconProps> = ({ icon, name, onClick }) => {
  return (
    <button className="desktop-icon" type="button" onClick={onClick} aria-label={`Open ${name}`}>
      <div className="icon-wrapper">
        {icon}
      </div>
      <span className="icon-label">{name}</span>
    </button>
  );
};
