// import React, { useState, useEffect } from 'react';
// import { Apple, Battery, Code2, Download, Search, Trash2, Upload, Wifi, X } from 'lucide-react';
// import './MenuBar.css';

// const OWNER_USERNAME = 'shankara';
// const OWNER_PASSWORD = 'portfolio2026';
// const DEFAULT_RESUME_PATH = '/Shankar_CV.pdf';
// const RESUME_LOCAL_STORAGE_KEY = 'portfolio-resume-source';
// const RESUME_NAME_LOCAL_STORAGE_KEY = 'portfolio-resume-name';

// export const MenuBar: React.FC = () => {
//   const [time, setTime] = useState(new Date());
//   const [showContact, setShowContact] = useState(false);
//   const [showResume, setShowResume] = useState(false);
//   const [showAdmin, setShowAdmin] = useState(false);
//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const [loginForm, setLoginForm] = useState({ username: '', password: '' });
//   const [statusMessage, setStatusMessage] = useState('Use the Apple logo to sign in as the owner.');
//   const [resumeSource, setResumeSource] = useState<string | null>(null);
//   const [resumeName, setResumeName] = useState('Shankar_CV.pdf');
//   const [resumeStatusMessage, setResumeStatusMessage] = useState();

//   useEffect(() => {
//     const timer = setInterval(() => setTime(new Date()), 1000);
//     return () => clearInterval(timer);
//   }, []);

//   useEffect(() => {
//     const storedSession = window.localStorage.getItem('portfolio-owner-session');
//     if (storedSession === 'true') {
//       setIsAuthenticated(true);
//     }

//     const storedResumeSource = window.localStorage.getItem(RESUME_LOCAL_STORAGE_KEY);
//     const storedResumeName = window.localStorage.getItem(RESUME_NAME_LOCAL_STORAGE_KEY);

//     if (storedResumeSource) {
//       setResumeSource(storedResumeSource);
//       setResumeName(storedResumeName || 'resume.pdf');
//       setResumeStatusMessage(`Loaded ${storedResumeName || 'uploaded resume'}.`);
//     }
//   }, []);

//   const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
//     event.preventDefault();

//     if (loginForm.username.trim().toLowerCase() === OWNER_USERNAME && loginForm.password === OWNER_PASSWORD) {
//       setIsAuthenticated(true);
//       setShowAdmin(false);
//       setStatusMessage('Welcome back. You can update your profile and projects now.');
//       window.localStorage.setItem('portfolio-owner-session', 'true');
//       window.dispatchEvent(new CustomEvent('owner-session-changed', { detail: { isAuthenticated: true } }));
//       setLoginForm({ username: '', password: '' });
//       return;
//     }

//     setStatusMessage('Invalid credentials. Please try again.');
//   };

//   const handleLogout = () => {
//     setIsAuthenticated(false);
//     setShowAdmin(false);
//     setStatusMessage('Signed out. Your content stays saved in this browser.');
//     window.localStorage.removeItem('portfolio-owner-session');
//     window.dispatchEvent(new CustomEvent('owner-session-changed', { detail: { isAuthenticated: false } }));
//   };

//   const handleResumeUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
//     const file = event.target.files?.[0];
//     if (!file) {
//       return;
//     }

//     if (file.type !== 'application/pdf') {
//       setResumeStatusMessage('Please choose a PDF file.');
//       event.target.value = '';
//       return;
//     }

//     const reader = new FileReader();
//     reader.onload = () => {
//       const result = reader.result as string;
//       setResumeSource(result);
//       setResumeName(file.name);
//       setResumeStatusMessage(`Using ${file.name}.`);
//       window.localStorage.setItem(RESUME_LOCAL_STORAGE_KEY, result);
//       window.localStorage.setItem(RESUME_NAME_LOCAL_STORAGE_KEY, file.name);
//     };
//     reader.onerror = () => {
//       setResumeStatusMessage('The file could not be read. Please try again.');
//     };
//     reader.readAsDataURL(file);
//     event.target.value = '';
//   };

//   const handleResumeRemove = () => {
//     setResumeSource(null);
//     setResumeName('Shankar_CV.pdf');
//     setResumeStatusMessage('The default resume is back.');
//     window.localStorage.removeItem(RESUME_LOCAL_STORAGE_KEY);
//     window.localStorage.removeItem(RESUME_NAME_LOCAL_STORAGE_KEY);
//   };

//   const currentResumePath = resumeSource || DEFAULT_RESUME_PATH;

//   return (
//     <div className="menubar">
//       <div className="menubar-left">
//         <div className="menubar-item apple-logo" role="button" tabIndex={0} onClick={() => { setShowAdmin(value => !value); setShowContact(false); setShowResume(false); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setShowAdmin(value => !value); setShowContact(false); setShowResume(false); } }}>
//           <Apple size={14} fill="currentColor" />
//         </div>
//         <div className="menubar-item bold">Shankara Gouda's Portfolio</div>
//         <div className="contact-menu">
//           <button className="menubar-item menu-button" type="button" onClick={() => { setShowContact(value => !value); setShowResume(false); }}>Contact</button>
//           {showContact && (
//             <div className="contact-popover">
//               <a href="mailto:oxyshankar@gmail.com">oxyshankar@gmail.com</a>
//               <a href="tel:+919148209559">+91 9148209559</a>
//             </div>
//           )}
//         </div>
//         <button className="menubar-item menu-button" type="button" onClick={() => { setShowResume(value => !value); setShowContact(false); }}>Resume</button>
//         <a className="menubar-item social-link" href="https://www.linkedin.com/in/shankara-gouda-672505366/" target="_blank" rel="noreferrer" aria-label="LinkedIn profile" title="LinkedIn">
//           LinkedIn
//         </a>
//         <a className="menubar-item social-link" href="https://github.com/shankar-gouda12" target="_blank" rel="noreferrer" aria-label="GitHub profile" title="GitHub">
//           GitHub
//         </a>
//         <a className="menubar-item social-link" href="https://leetcode.com/u/shankar_gouda/" target="_blank" rel="noreferrer" aria-label="LeetCode profile" title="LeetCode">
//           <Code2 size={15} />
//         </a>
//       </div>
      
//       {showAdmin && (
//         <div className="admin-popover" role="dialog" aria-label="Admin login">
//           <div className="admin-popover-header">
//             <strong>Owner access</strong>
//             <button type="button" className="resume-close" onClick={() => setShowAdmin(false)} aria-label="Close admin menu"><X size={16} /></button>
//           </div>
//           {isAuthenticated ? (
//             <div className="admin-popover-body">
//               <p>{statusMessage}</p>
//               <button type="button" className="menu-button admin-action" onClick={handleLogout}>Sign out</button>
//             </div>
//           ) : (
//             <form className="admin-login-form" onSubmit={handleLogin}>
//               <p>{statusMessage}</p>
//               <input type="text" placeholder="Username" value={loginForm.username} onChange={(event) => setLoginForm(prev => ({ ...prev, username: event.target.value }))} />
//               <input type="password" placeholder="Password" value={loginForm.password} onChange={(event) => setLoginForm(prev => ({ ...prev, password: event.target.value }))} />
//               <button type="submit" className="menu-button admin-action">Sign in</button>
//             </form>
//           )}
//         </div>
//       )}

//       <div className="menubar-right">
//         <div className="menubar-item">
//           {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
//           {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
//         </div>
//       </div>

//       {showResume && (
//         <div className="resume-overlay" role="dialog" aria-modal="true" aria-label="Resume preview" onClick={() => setShowResume(false)}>
//           <section className="resume-preview" onClick={event => event.stopPropagation()}>
//             <header className="resume-preview-header">
//               <span>Shankara Gouda - Resume</span>
//               <button type="button" className="resume-close" onClick={() => setShowResume(false)} aria-label="Close resume preview"><X size={18} /></button>
//             </header>
//             <div className="resume-preview-body">
//               {isAuthenticated && (
//                 <div className="resume-controls">
//                   <label className="resume-action-button" htmlFor="resume-upload-input">
//                     <Upload size={16} /> Upload Resume
//                   </label>
//                   <input id="resume-upload-input" type="file" accept="application/pdf" onChange={handleResumeUpload} hidden />
//                   <button type="button" className="resume-action-button secondary" onClick={handleResumeRemove}>
//                     <Trash2 size={16} /> Remove Resume
//                   </button>
//                 </div>
//               )}
//               <p className="resume-status">{resumeStatusMessage}</p>
//               <object className="resume-document" data={currentResumePath} type="application/pdf">
//                 <p>Preview is unavailable in this browser.</p>
//               </object>
//             </div>
//             <footer className="resume-preview-footer">
//               <a href={currentResumePath} download={resumeName}><Download size={16} /> Download Resume</a>
//             </footer>
//           </section>
//         </div>
//       )}
//     </div>
//   );
// };

import React, { useState, useEffect } from 'react';
import { Apple,  Code2, Download, Trash2, Upload, X } from 'lucide-react';
import './MenuBar.css';

const OWNER_USERNAME = 'shankara';
const OWNER_PASSWORD = 'portfolio2026';
const DEFAULT_RESUME_PATH = '/Shankar_CV.pdf';
const RESUME_LOCAL_STORAGE_KEY = 'portfolio-resume-source';
const RESUME_NAME_LOCAL_STORAGE_KEY = 'portfolio-resume-name';

export const MenuBar: React.FC = () => {
  const [time, setTime] = useState(new Date());
  const [showContact, setShowContact] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [statusMessage, setStatusMessage] = useState('Use the Apple logo to sign in as the owner.');
  const [resumeSource, setResumeSource] = useState<string | null>(null);
  const [resumeName, setResumeName] = useState('Shankar_CV.pdf');
  const [resumeStatusMessage, setResumeStatusMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const storedSession = window.localStorage.getItem('portfolio-owner-session');
    if (storedSession === 'true') {
      setIsAuthenticated(true);
    }

    const storedResumeSource = window.localStorage.getItem(RESUME_LOCAL_STORAGE_KEY);
    const storedResumeName = window.localStorage.getItem(RESUME_NAME_LOCAL_STORAGE_KEY);

    if (storedResumeSource) {
      setResumeSource(storedResumeSource);
      setResumeName(storedResumeName || 'resume.pdf');
      setResumeStatusMessage(`Loaded ${storedResumeName || 'uploaded resume'}.`);
    }
  }, []);

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loginForm.username.trim().toLowerCase() === OWNER_USERNAME && loginForm.password === OWNER_PASSWORD) {
      setIsAuthenticated(true);
      setShowAdmin(false);
      setStatusMessage('Welcome back. You can update your profile and projects now.');
      window.localStorage.setItem('portfolio-owner-session', 'true');
      window.dispatchEvent(new CustomEvent('owner-session-changed', { detail: { isAuthenticated: true } }));
      setLoginForm({ username: '', password: '' });
      return;
    }

    setStatusMessage('Invalid credentials. Please try again.');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setShowAdmin(false);
    setStatusMessage('Signed out. Your content stays saved in this browser.');
    window.localStorage.removeItem('portfolio-owner-session');
    window.dispatchEvent(new CustomEvent('owner-session-changed', { detail: { isAuthenticated: false } }));
  };

  const handleResumeUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.type !== 'application/pdf') {
      setResumeStatusMessage('Please choose a PDF file.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setResumeSource(result);
      setResumeName(file.name);
      setResumeStatusMessage(`Using ${file.name}.`);
      window.localStorage.setItem(RESUME_LOCAL_STORAGE_KEY, result);
      window.localStorage.setItem(RESUME_NAME_LOCAL_STORAGE_KEY, file.name);
    };
    reader.onerror = () => {
      setResumeStatusMessage('The file could not be read. Please try again.');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleResumeRemove = () => {
    setResumeSource(null);
    setResumeName('Shankar_CV.pdf');
    setResumeStatusMessage('The default resume is back.');
    window.localStorage.removeItem(RESUME_LOCAL_STORAGE_KEY);
    window.localStorage.removeItem(RESUME_NAME_LOCAL_STORAGE_KEY);
  };

  const currentResumePath = resumeSource || DEFAULT_RESUME_PATH;

  return (
    <div className="menubar">
      <div className="menubar-left">
        <div className="menubar-item apple-logo" role="button" tabIndex={0} onClick={() => { setShowAdmin(value => !value); setShowContact(false); setShowResume(false); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setShowAdmin(value => !value); setShowContact(false); setShowResume(false); } }}>
          <Apple size={14} fill="currentColor" />
        </div>
        <div className="menubar-item bold">Shankara Gouda's Portfolio</div>
        <div className="contact-menu">
          <button className="menubar-item menu-button" type="button" onClick={() => { setShowContact(value => !value); setShowResume(false); }}>Contact</button>
          {showContact && (
            <div className="contact-popover">
              <a href="mailto:oxyshankar@gmail.com">oxyshankar@gmail.com</a>
              <a href="tel:+919148209559">+91 9148209559</a>
            </div>
          )}
        </div>
        <button className="menubar-item menu-button" type="button" onClick={() => { setShowResume(value => !value); setShowContact(false); }}>Resume</button>
        <a className="menubar-item social-link" href="https://www.linkedin.com/in/shankara-gouda-672505366/" target="_blank" rel="noreferrer" aria-label="LinkedIn profile" title="LinkedIn">
          LinkedIn
        </a>
        <a className="menubar-item social-link" href="https://github.com/shankar-gouda12" target="_blank" rel="noreferrer" aria-label="GitHub profile" title="GitHub">
          GitHub
        </a>
        <a className="menubar-item social-link" href="https://leetcode.com/u/shankar_gouda/" target="_blank" rel="noreferrer" aria-label="LeetCode profile" title="LeetCode">
          <Code2 size={15} />
        </a>
      </div>
      
      {showAdmin && (
        <div className="admin-popover" role="dialog" aria-label="Admin login">
          <div className="admin-popover-header">
            <strong>Owner access</strong>
            <button type="button" className="resume-close" onClick={() => setShowAdmin(false)} aria-label="Close admin menu"><X size={16} /></button>
          </div>
          {isAuthenticated ? (
            <div className="admin-popover-body">
              <p>{statusMessage}</p>
              <button type="button" className="menu-button admin-action" onClick={handleLogout}>Sign out</button>
            </div>
          ) : (
            <form className="admin-login-form" onSubmit={handleLogin}>
              <p>{statusMessage}</p>
              <input type="text" placeholder="Username" value={loginForm.username} onChange={(event) => setLoginForm(prev => ({ ...prev, username: event.target.value }))} />
              <input type="password" placeholder="Password" value={loginForm.password} onChange={(event) => setLoginForm(prev => ({ ...prev, password: event.target.value }))} />
              <button type="submit" className="menu-button admin-action">Sign in</button>
            </form>
          )}
        </div>
      )}

      <div className="menubar-right">
        <div className="menubar-item">
          {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {showResume && (
        <div className="resume-overlay" role="dialog" aria-modal="true" aria-label="Resume preview" onClick={() => setShowResume(false)}>
          <section className="resume-preview" onClick={event => event.stopPropagation()}>
            <header className="resume-preview-header">
              <span>Shankara Gouda - Resume</span>
              <button type="button" className="resume-close" onClick={() => setShowResume(false)} aria-label="Close resume preview"><X size={18} /></button>
            </header>
            <div className="resume-preview-body">
              {isAuthenticated && (
                <div className="resume-controls">
                  <label className="resume-action-button" htmlFor="resume-upload-input">
                    <Upload size={16} /> Upload Resume
                  </label>
                  <input id="resume-upload-input" type="file" accept="application/pdf" onChange={handleResumeUpload} hidden />
                  <button type="button" className="resume-action-button secondary" onClick={handleResumeRemove}>
                    <Trash2 size={16} /> Remove Resume
                  </button>
                </div>
              )}
              <p className="resume-status">{resumeStatusMessage}</p>
              <object className="resume-document" data={currentResumePath} type="application/pdf">
                <p>Preview is unavailable in this browser.</p>
              </object>
            </div>
            <footer className="resume-preview-footer">
              <a href={currentResumePath} download={resumeName}><Download size={16} /> Download Resume</a>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};
