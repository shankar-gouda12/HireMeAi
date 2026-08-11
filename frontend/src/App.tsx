import React, { useEffect, useState } from 'react';
import { Folder, Image as ImageIcon, MessageCircle } from 'lucide-react';
import { MenuBar } from './components/MenuBar';
import { Dock } from './components/Dock';
import { Window } from './components/Window';
import { ChatGPTApp } from './apps/ChatGPTApp';
import { GalleryApp } from './apps/GalleryApp';
import { ProjectsApp } from './apps/ProjectsApp';
import './App.css';

interface AppState {
  id: string;
  name: string;
  icon: React.ReactNode;
  desktopIcon?: React.ReactNode;
  isOpen: boolean;
  isMinimized: boolean;
  isFocused: boolean;
  zIndex: number;
  component: React.ReactNode;
  width?: number;
  height?: number;
}

const IOSIcon = ({ children, gradient }: { children: React.ReactNode, gradient: string }) => (
  <div style={{
    width: '100%',
    height: '100%',
    background: gradient,
    borderRadius: '16px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4), 0 2px 4px rgba(0,0,0,0.2)'
  }}>
    {children}
  </div>
);

const INITIAL_APPS: AppState[] = [
  {
    id: 'projects',
    name: 'Folder',
    icon: <IOSIcon gradient="linear-gradient(135deg, #3c8ce7, #00eaff)"><Folder color="#fff" size={28} fill="#fff" /></IOSIcon>,
    desktopIcon: <IOSIcon gradient="linear-gradient(135deg, #3c8ce7, #00eaff)"><Folder color="#fff" size={36} fill="#fff" /></IOSIcon>,
    isOpen: false,
    isMinimized: false,
    isFocused: false,
    zIndex: 0,
    component: <ProjectsApp />,
    width: 800,
    height: 550,
  },
  {
    id: 'gallery',
    name: 'Gallery',
    icon: <IOSIcon gradient="linear-gradient(135deg, #f15bb5, #ff8a5b)"><ImageIcon color="#fff" size={28} /></IOSIcon>,
    desktopIcon: <IOSIcon gradient="linear-gradient(135deg, #f15bb5, #ff8a5b)"><ImageIcon color="#fff" size={36} /></IOSIcon>,
    isOpen: false,
    isMinimized: false,
    isFocused: false,
    zIndex: 0,
    component: <GalleryApp />,
    width: 900,
    height: 600,
  },
  {
    id: 'chatgpt',
    name: 'Ask Me',
    icon: <IOSIcon gradient="linear-gradient(135deg, #00b894, #55efc4)"><MessageCircle color="#fff" size={28} fill="#fff" /></IOSIcon>,
    desktopIcon: <IOSIcon gradient="linear-gradient(135deg, #00b894, #55efc4)"><MessageCircle color="#fff" size={36} fill="#fff" /></IOSIcon>,
    isOpen: false,
    isMinimized: false,
    isFocused: false,
    zIndex: 0,
    component: <ChatGPTApp />,
    width: 450,
    height: 550,
  }
];

function App() {
  const [apps, setApps] = useState<AppState[]>(INITIAL_APPS);
  const [maxZIndex, setMaxZIndex] = useState(1);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const focusApp = (id: string) => {
    setMaxZIndex(prev => prev + 1);
    setApps(prevApps => prevApps.map(app => 
      app.id === id 
        ? { ...app, isFocused: true, zIndex: maxZIndex + 1 }
        : { ...app, isFocused: false }
    ));
  };

  const openApp = (id: string) => {
    setMaxZIndex(prev => prev + 1);
    setApps(prevApps => {
      const app = prevApps.find(a => a.id === id);
      if (!app) return prevApps;
      
      return prevApps.map(a => 
        a.id === id 
          ? { ...a, isOpen: true, isMinimized: false, isFocused: true, zIndex: maxZIndex + 1 }
          : isMobile
            ? { ...a, isOpen: false, isMinimized: true, isFocused: false }
            : { ...a, isFocused: false }
      );
    });
  };

  const toggleApp = (id: string) => {
    const app = apps.find(item => item.id === id);
    if (app?.isOpen && !app.isMinimized) {
      minimizeApp(id);
      return;
    }
    openApp(id);
  };

  const minimizeApp = (id: string) => {
    setApps(prevApps => prevApps.map(app =>
      app.id === id ? { ...app, isMinimized: true, isFocused: false } : app
    ));
  };

  const closeApp = (id: string) => {
    setApps(prevApps => prevApps.map(app =>
      app.id === id ? { ...app, isOpen: false, isMinimized: false, isFocused: false } : app
    ));
  };

  return (
    <div className="desktop">
      <main className="background-text" aria-label="Shankara Gouda portfolio">
        <p className="bg-name">Hey, I'm Shankara Gouda! welcome to my</p>
        <h1 className="bg-portfolio">Portfolio</h1>
      </main>

      <MenuBar />

      <div className="windows-container">
        {apps.map(app => (
          <Window
            key={app.id}
            id={app.id}
            title={app.name}
            icon={app.id === 'chatgpt' ? <span style={{fontSize: 14}}>✨</span> : undefined}
            isOpen={app.isOpen}
            isMinimized={app.isMinimized}
            isFocused={app.isFocused}
            onClose={closeApp}
            onMinimize={minimizeApp}
            onFocus={focusApp}
            zIndex={app.zIndex}
            width={app.width}
            height={app.height}
            isMobile={isMobile}
          >
            {app.component}
          </Window>
        ))}
      </div>

      <Dock
        apps={['projects', 'chatgpt', 'gallery'].map(id => {
          const { icon, isOpen, isFocused, name } = apps.find(app => app.id === id)!;
          return { id, icon, isOpen, isFocused, name };
        })}
        onAppClick={toggleApp}
      />

    </div>
  );
}

export default App;
