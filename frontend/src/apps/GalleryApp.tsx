import React, { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import './GalleryApp.css';

type GalleryItem = {
  id: number;
  title: string;
  description: string;
  url: string;
};

const DEFAULT_IMAGES: GalleryItem[] = [];
const API_BASE = (import.meta.env.VITE_API_BASE as string) || '/svc/api';

export const GalleryApp: React.FC = () => {
  const [images, setImages] = useState<GalleryItem[]>(DEFAULT_IMAGES);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const gridRef = React.useRef<HTMLDivElement | null>(null);

  const normalizeUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return `${API_BASE}${url}`;
    return `${API_BASE}/${url}`;
  };

  const normalizeItem = (item: GalleryItem) => ({ ...item, url: normalizeUrl(item.url) });

  useEffect(() => {
    // Fetch initial gallery from backend
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/gallery`);
        if (res.ok) {
          const data = await res.json();
          setImages((data as GalleryItem[]).map(normalizeItem));
        }
      } catch (err) {
        console.error('Failed to fetch gallery', err);
      }
    })();

    const savedSession = window.localStorage.getItem('portfolio-owner-session');
    if (savedSession === 'true') setIsAuthenticated(true);

    // WebSocket for realtime updates
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket((API_BASE.replace('http', 'ws')) + '/ws');
      ws.addEventListener('message', async ev => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg && msg.type === 'gallery-updated') {
            const res = await fetch(`${API_BASE}/gallery`);
            if (res.ok) {
              const data = await res.json();
              setImages((data as GalleryItem[]).map(normalizeItem));
            }
          }
        } catch (e) {
          // ignore
        }
      });
    } catch (e) {
      console.warn('WebSocket unavailable', e);
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

  // no localStorage writes — data is stored on backend

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileObj(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setPreviewUrl(result);
      };
      reader.onerror = () => {
        setPreviewUrl(null);
        setFileName('Preview failed');
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
      setStatusMessage('Only image files are allowed.');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const uploadPreview = () => {
    if (!previewUrl || !fileObj) return;
    const form = new FormData();
    form.append('file', fileObj);
    form.append('title', title.trim());
    form.append('description', description.trim());
    setStatusMessage('Uploading...');
    fetch(`${API_BASE}/gallery/upload`, { method: 'POST', body: form })
      .then(async res => {
        if (!res.ok) throw new Error('upload failed');
        const item = normalizeItem(await res.json());
        setImages(prev => [item, ...prev]);
        setStatusMessage('Image uploaded');
        setTitle('');
        setDescription('');
        setFileName('');
        setPreviewUrl(null);
        setFileObj(null);
        setTimeout(() => setStatusMessage(null), 2500);
        setTimeout(() => gridRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .catch(err => {
        console.error(err);
        setStatusMessage('Upload failed');
        setTimeout(() => setStatusMessage(null), 3000);
      });
  };

  const cancelPreview = () => {
    setPreviewUrl(null);
    setFileName('');
    setFileObj(null);
  };

  const handleDelete = (id: number) => {
    // call backend to delete
    fetch(`${API_BASE}/gallery/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error('delete failed');
        setImages(prev => prev.filter(item => item.id !== id));
      })
      .catch(err => console.error(err));
  };

  const openImage = (item: GalleryItem) => {
    setSelectedImage(item);
  };

  const closeImage = () => {
    setSelectedImage(null);
  };

  const createSvgDataUrl = (bg: string, label: string) => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'><rect width='100%' height='100%' fill='${bg}'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='48' fill='#fff'>${label}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const insertSampleImages = () => {
    const samples: GalleryItem[] = [
      { id: Date.now() + 1, title: 'Sample Photo', description: 'Example photo added by owner', url: createSvgDataUrl('#4f46e5', 'Sample Photo') },
      { id: Date.now() + 2, title: 'Certificate', description: 'Example certificate image', url: createSvgDataUrl('#047857', 'Certificate') },
    ];
    setImages(prev => [...samples, ...prev]);
  };

  const emptyState = useMemo(() => images.length === 0, [images.length]);

  return (
    <div className="gallery-container">
      <div className="gallery-header">
        <h2>Photos & Certificates</h2>
      </div>

      {isAuthenticated ? (
        <div className="gallery-uploader">
          <div className="owner-banner">Owner mode — you can upload and delete items.</div>
          <div style={{display: 'flex', gap: 8}}>
            <button type="button" className="insert-samples" onClick={insertSampleImages}>Insert sample images</button>
          </div>
          {previewUrl ? (
            <div className="preview-container">
              <button type="button" className="cancel-preview-btn" onClick={cancelPreview}>×</button>
              {previewUrl ? (
                <img src={previewUrl} alt={title || fileName || 'preview'} style={{maxWidth: 240, maxHeight: 160}} />
              ) : null}
              <div style={{display: 'flex', gap: 8, marginTop: 8}}>
                <button type="button" className="tool-button primary" onClick={uploadPreview}>Upload</button>
              </div>
            </div>
          ) : (
            <label className="upload-box">
              <ImagePlus size={20} />
              <span>{fileName ? `Selected: ${fileName}` : 'Choose an image to upload'}</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} />
            </label>
          )}
          <input type="text" placeholder="Short title" value={title} onChange={event => setTitle(event.target.value)} />
          <input type="text" placeholder="Short description" value={description} onChange={event => setDescription(event.target.value)} />
        </div>
      ) : (
        <div className="gallery-note"></div>
      )}
      {statusMessage ? <div className="gallery-status">{statusMessage}</div> : null}
      {emptyState ? (
        <div className="gallery-empty">No images yet. Add your first one above.</div>
      ) : (
        <div className="gallery-grid" ref={gridRef}>
          {images.map(img => (
            <div key={img.id} className="gallery-item">
              <img src={img.url} alt={img.title} onClick={() => openImage(img)} />
              <div className="gallery-overlay">
                <span>{img.title}</span>
                {img.description ? <small>{img.description}</small> : null}
              </div>
              {isAuthenticated ? (
                <button type="button" className="gallery-delete" onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }} aria-label={`Delete ${img.title}`}>
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {selectedImage ? (
        <div className="gallery-fullscreen-overlay" onClick={closeImage}>
          <div className="gallery-fullscreen-content" onClick={e => e.stopPropagation()}>
            <div className="gallery-fullscreen-image">
              <img src={selectedImage.url} alt={selectedImage.title} />
            </div>
            <div className="gallery-fullscreen-meta">
              <div className="fullscreen-meta-top">
                <h3>{selectedImage.title}</h3>
                <button type="button" className="fullscreen-close-secondary" onClick={closeImage}>Close</button>
              </div>
              {selectedImage.description ? <p>{selectedImage.description}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
