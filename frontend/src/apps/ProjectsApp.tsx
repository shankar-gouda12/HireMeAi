import React, { useEffect, useState } from 'react';
import { Folder, FileCode2, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import './ProjectsApp.css';

type ProjectItem = {
  id: number;
  name: string;
  desc?: string;
  video?: string;
  github?: string;
};

type ProjectFormState = {
  name: string;
  video: string;
  github: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE as string) || '/svc/api';
const EMPTY_FORM: ProjectFormState = { name: '', video: '', github: '' };

export const ProjectsApp: React.FC = () => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [form, setForm] = useState<ProjectFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // fetch initial projects from backend
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/projects`);
        if (res.ok) setProjects(await res.json());
      } catch (e) {
        console.error('Failed to load projects', e);
      }
    })();

    const savedSession = window.localStorage.getItem('portfolio-owner-session');
    if (savedSession === 'true') setIsAuthenticated(true);

    // websocket to receive updates
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket((API_BASE.replace('http', 'ws')) + '/ws');
      ws.addEventListener('message', async ev => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg && msg.type === 'projects-updated') {
            const res = await fetch(`${API_BASE}/projects`);
            if (res.ok) setProjects(await res.json());
          }
        } catch (err) {}
      });
    } catch (err) {
      console.warn('WebSocket not available', err);
    }

    const onOwnerSession = (e: Event) => {
      const detail = (e as CustomEvent).detail as { isAuthenticated: boolean } | undefined;
      if (detail) setIsAuthenticated(!!detail.isAuthenticated);
    };
    window.addEventListener('owner-session-changed', onOwnerSession as EventListener);
    return () => {
      window.removeEventListener('owner-session-changed', onOwnerSession as EventListener);
      try { ws?.close(); } catch {}
    };
  }, []);

  useEffect(() => {
    // persisted on backend
  }, [projects]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const updateFormField = (field: keyof ProjectFormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setStatusMessage('Please add a project name before saving.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      desc: '',
      video: form.video.trim(),
      github: form.github.trim(),
    };

    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `${API_BASE}/projects/${editingId}` : `${API_BASE}/projects`;

    fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(async res => {
        if (!res.ok) throw new Error('save failed');
        const item = await res.json();
        setProjects(prev => {
          if (editingId) {
            return prev.map(project => (project.id === item.id ? item : project));
          }
          return [item, ...prev];
        });
        setStatusMessage(editingId ? 'Project updated successfully.' : 'Project added successfully.');
        resetForm();
      })
      .catch(err => {
        console.error(err);
        setStatusMessage('Save failed');
      });
  };

  const handleEdit = (p: ProjectItem) => {
    setEditingId(p.id);
    setForm({ name: p.name, video: p.video || '', github: p.github || '' });
  };

  const handleDelete = (id: number) => {
    fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error('delete failed');
        if (editingId === id) resetForm();
        setProjects(prev => prev.filter(project => project.id !== id));
        setStatusMessage('Project removed.');
      })
      .catch(err => {
        console.error(err);
        setStatusMessage('Failed to delete project.');
      });
  };

  const clearAllProjects = () => {
    if (!isAuthenticated) return;
    setProjects([]);
    setStatusMessage("Owner cleared all projects.");
  };

  return (
    <div className="explorer-container">
      <div className="explorer-sidebar">
        <div className="sidebar-section">
          <h3>Quick access</h3>
          <ul>
            <li className="active"><Folder size={16} color="#facc15" /> Projects</li>
          </ul>
        </div>
      </div>

      <div className="explorer-main">
        <div className="explorer-path"><span>This PC</span> &gt; <span>Projects</span></div>

        <div className="project-toolbar">
          <div>
            <h3>My projects</h3>
            <p>{statusMessage}</p>
          </div>
          {isAuthenticated ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="tool-button primary" onClick={() => resetForm()}><PlusCircle size={14} /> Add project</button>
              <button type="button" className="tool-button danger" onClick={clearAllProjects}>Clear all projects</button>
            </div>
          ) : null}
        </div>

        {isAuthenticated ? (
          <form className="project-form" onSubmit={handleProjectSubmit}>
            <div className="form-row">
              <label>
                <span>Project name</span>
                <input type="text" value={form.name} onChange={e => updateFormField('name', e.target.value)} placeholder="My project" />
              </label>
              <label>
                <span>GitHub link</span>
                <input type="url" value={form.github} onChange={e => updateFormField('github', e.target.value)} placeholder="https://github.com/your/repo" />
              </label>
            </div>
            <label>
              <span>Demo link</span>
              <input type="url" value={form.video} onChange={e => updateFormField('video', e.target.value)} placeholder="https://..." />
            </label>
            <div className="form-actions">
              <button type="submit" className="tool-button primary">{editingId ? 'Save changes' : 'Add project'}</button>
              {editingId ? <button type="button" className="tool-button secondary" onClick={resetForm}>Cancel</button> : null}
            </div>
          </form>
        ) : null}

        {!isAuthenticated && projects.length === 0 ? (
          <div className="projects-empty">No projects yet. Owner hasn't added any.</div>
        ) : null}

        <div className="files-grid">
          {projects.map(project => (
            <div key={project.id} className="file-item">
              <FileCode2 size={48} color="#0078d4" />
              <div className="file-info">
                <h4>{project.name}</h4>
              </div>
              <div className="project-links">
                {project.github ? <a href={project.github} target="_blank" rel="noreferrer">GitHub</a> : null}
                {project.video ? <a href={project.video} target="_blank" rel="noreferrer">Demo</a> : null}
                {isAuthenticated ? (
                  <button type="button" className="icon-button" onClick={() => handleEdit(project)} aria-label={`Edit ${project.name}`}>
                    <Pencil size={14} />
                  </button>
                ) : null}
                {isAuthenticated ? (
                  <button type="button" className="icon-button" onClick={() => handleDelete(project.id)} aria-label={`Delete ${project.name}`}>
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectsApp;
