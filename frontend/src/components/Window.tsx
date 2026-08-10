import React, { useState } from 'react';
import './Window.css';

export interface WindowProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  isMinimized: boolean;
  isFocused: boolean;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onFocus: (id: string) => void;
  zIndex: number;
  width?: number;
  height?: number;
  isMobile?: boolean;
}

export const Window: React.FC<WindowProps> = ({
  id,
  title,
  icon,
  children,
  isOpen,
  isMinimized,
  isFocused,
  onClose,
  onMinimize,
  onFocus,
  zIndex,
  width = 800,
  height = 600,
  isMobile = false,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  if (!isOpen || isMinimized) return null;

  return (
    <div
      className={`window-container glass glass-panel ${isFocused ? 'focused' : ''} ${isMobile ? 'mobile-fullscreen' : ''} ${isMaximized ? 'maximized' : ''}`}
      style={!isMobile
        ? { zIndex, width, height }
        : { zIndex, top: 0 }}
      onPointerDown={() => onFocus(id)}
    >
      <div className="titlebar">
        <div className="titlebar-left">
          <button className="mac-btn close" type="button" aria-label={`Close ${title}`} onClick={event => { event.stopPropagation(); onClose(id); }} />
          <button className="mac-btn minimize" type="button" aria-label={`Minimize ${title}`} onClick={event => { event.stopPropagation(); onMinimize(id); }} />
          <button className="mac-btn maximize" type="button" aria-label={`${isMaximized ? 'Restore' : 'Maximize'} ${title}`} onClick={event => { event.stopPropagation(); setIsMaximized(value => !value); }} />
        </div>
        <div className="titlebar-center">
          {icon && <span className="titlebar-icon">{icon}</span>}
          <span className="titlebar-title">{title}</span>
        </div>
        <div className="titlebar-spacer" />
      </div>
      <div className="window-content">
        {children}
      </div>
    </div>
  );
};
