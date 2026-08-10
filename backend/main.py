import json
import os
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import groq
from groq import Groq
from pydantic import BaseModel, Field
from pypdf import PdfReader


# Load environment variables
load_dotenv()

# Groq client
client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

DEFAULT_GROQ_MODEL = "llama-3.3-7b"
user_model = os.getenv("GROQ_MODEL")
FALLBACK_GROQ_MODELS = [DEFAULT_GROQ_MODEL, "llama-3.3-70b-versatile"]
if user_model and user_model not in FALLBACK_GROQ_MODELS:
    FALLBACK_GROQ_MODELS.append(user_model)

app = FastAPI()

def create_chat_completion(messages, max_tokens=256, response_format=None):
    last_error = None
    for model_name in FALLBACK_GROQ_MODELS:
        try:
            kwargs = {
                "model": model_name,
                "messages": messages,
                "max_tokens": max_tokens,
            }
            if response_format is not None:
                kwargs["response_format"] = response_format
            return client.chat.completions.create(**kwargs)
        except groq.NotFoundError as exc:
            last_error = exc
            continue
        except groq.RateLimitError as exc:
            last_error = exc
            continue
    raise last_error if last_error is not None else RuntimeError("No available model for completion")

# Add CORS middleware so the frontend can connect to the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# Simple gallery storage + websocket broadcaster
# -----------------------------

BASE_DIR = Path(__file__).parent
UPLOADS_DIR = BASE_DIR / "uploads"
DATA_DIR = BASE_DIR / "data"
GALLERY_JSON = DATA_DIR / "gallery.json"
PROJECTS_JSON = DATA_DIR / "projects.json"

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

if not GALLERY_JSON.exists():
    GALLERY_JSON.write_text("[]")
if not PROJECTS_JSON.exists():
    PROJECTS_JSON.write_text("[]")


def read_gallery() -> list:
    try:
        return json.loads(GALLERY_JSON.read_text())
    except Exception:
        return []


def write_gallery(items: list):
    GALLERY_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=2))


def read_projects() -> list:
    try:
        return json.loads(PROJECTS_JSON.read_text())
    except Exception:
        return []


def write_projects(items: list):
    PROJECTS_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=2))


class ConnectionManager:
    def __init__(self):
        self.active: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active.discard(websocket)

    async def broadcast(self, message: dict):
        to_remove = []
        for ws in list(self.active):
            try:
                await ws.send_json(message)
            except Exception:
                to_remove.append(ws)
        for ws in to_remove:
            self.disconnect(ws)


manager = ConnectionManager()
PARSED_RESUME_CACHE = None


# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/gallery")
def get_gallery():
    return JSONResponse(read_gallery())


@app.post("/gallery/upload")
async def upload_gallery_item(request: Request, file: UploadFile = File(...), title: str = Form(""), description: str = Form("")):
    # Save file to uploads directory with a safe unique filename
    filename = f"{int(time.time()*1000)}_{uuid.uuid4().hex}_{file.filename}"
    filename = filename.replace(' ', '_')
    dest = UPLOADS_DIR / filename
    content = await file.read()
    dest.write_bytes(content)

    origin = request.base_url
    url = f"{origin}uploads/{filename}"

    items = read_gallery()
    item = {
        "id": int(time.time()*1000),
        "title": title or file.filename,
        "description": description or "",
        "url": url
    }
    items.insert(0, item)
    write_gallery(items)

    # Broadcast update
    try:
        await manager.broadcast({"type": "gallery-updated", "item": item})
    except Exception:
        pass

    return JSONResponse(item)


@app.get("/projects")
def get_projects():
    return JSONResponse(read_projects())


@app.post("/projects")
def create_project(payload: dict):
    items = read_projects()
    item = payload.copy()
    item["id"] = int(time.time()*1000)
    items.insert(0, item)
    write_projects(items)
    try:
        import asyncio
        asyncio.create_task(manager.broadcast({"type": "projects-updated", "item": item}))
    except Exception:
        pass
    return JSONResponse(item)


@app.put("/projects/{item_id}")
def update_project(item_id: int, payload: dict):
    items = read_projects()
    updated = None
    next_items = []
    for it in items:
        if int(it.get("id", 0)) == int(item_id):
            new_item = payload.copy()
            new_item["id"] = item_id
            next_items.append(new_item)
            updated = new_item
        else:
            next_items.append(it)
    write_projects(next_items)
    try:
        import asyncio
        asyncio.create_task(manager.broadcast({"type": "projects-updated", "item": updated}))
    except Exception:
        pass
    return JSONResponse(updated or {"ok": False})


@app.delete("/projects/{item_id}")
def delete_project(item_id: int):
    items = read_projects()
    next_items = [it for it in items if int(it.get("id", 0)) != int(item_id)]
    write_projects(next_items)
    try:
        import asyncio
        asyncio.create_task(manager.broadcast({"type": "projects-updated"}))
    except Exception:
        pass
    return JSONResponse({"ok": True})


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive; ignore incoming messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


@app.delete("/gallery/{item_id}")
def delete_gallery_item(item_id: int):
    items = read_gallery()
    next_items = [it for it in items if int(it.get("id", 0)) != int(item_id)]
    # attempt to delete removed files
    removed = [it for it in items if int(it.get("id", 0)) == int(item_id)]
    for it in removed:
        url = it.get("url", "")
        if url.startswith("/uploads/"):
            path = UPLOADS_DIR / url.split("/uploads/")[-1]
            try:
                if path.exists():
                    path.unlink()
            except Exception:
                pass
    write_gallery(next_items)
    # Broadcast update (sync is fire-and-forget)
    try:
        import asyncio
        asyncio.create_task(manager.broadcast({"type": "gallery-updated"}))
    except Exception:
        pass
    return JSONResponse({"ok": True})



# -----------------------------
# Pydantic Models
# -----------------------------

class Experience(BaseModel):
    company: str | None = None
    role: str | None = None
    duration: str | None = None
    description: str | None = None


class Resume(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    total_experience_years: float | None = None

    skills: list[str] = Field(default_factory=list)
    experiences: list[Experience] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)


class ChatRequest(BaseModel):
    question: str


# JSON schema for AI resume parser
resume_schema = Resume.model_json_schema()


# -----------------------------
# Resume Parser
# -----------------------------

def parse_resume(resume_text: str) -> Resume:

    system_prompt = f"""
You are an expert resume parser.

Extract information from the resume based on its meaning,
not only based on section headings.

Rules:

1. Do not invent information.
2. If a value is not available, return null.
3. If a list has no information, return an empty list.
4. Include internships inside experiences.
5. Extract skills mentioned anywhere in the resume.
6. Normalize the candidate's name only when the intended spelling
   can be determined confidently from the resume.
7. Remove accidental spaces caused by PDF text extraction.
8. Preserve normal spaces between separate names.
9. Do not guess or reconstruct a name when the correct spelling
   cannot be determined with confidence.


For example:
"S HANKARAG OUDA" may represent "SHANKARA GOUDA"
if the resume clearly indicates that.

Return ONLY valid JSON matching this schema:

{resume_schema}
"""

    user_prompt = f"""
Parse the following resume:

{resume_text}
"""

    response = create_chat_completion(
        messages=[
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ],
        max_tokens=512,
        response_format={
            "type": "json_object"
        }
    )

    raw_output = response.choices[0].message.content

    data = json.loads(raw_output)

    return Resume(**data)


# -----------------------------
# PDF Reader
# -----------------------------

def read_pdf(file_path: Path) -> str:

    reader = PdfReader(file_path)

    text = ""

    for page in reader.pages:
        page_text = page.extract_text()

        if page_text:
            text += page_text + "\n"

    return text.strip()


def get_parsed_resume():
    global PARSED_RESUME_CACHE
    if PARSED_RESUME_CACHE is not None:
        return PARSED_RESUME_CACHE

    resume_path = Path("Shankar_CV.pdf")
    if not resume_path.exists():
        raise FileNotFoundError("PDF file not found")

    resume_text = read_pdf(resume_path)
    PARSED_RESUME_CACHE = parse_resume(resume_text)
    return PARSED_RESUME_CACHE


# -----------------------------
# Candidate Chat
# -----------------------------

def ask_candidate(question: str, resume: Resume) -> str:

    system_prompt = f"""
You are an AI interview assistant representing the job candidate.

Your job is to answer HR/interviewer questions AS THE CANDIDATE.
You are NOT an HR assistant, recruiter, mediator, or narrator.

Here is the candidate's resume data:

{resume.model_dump_json(indent=2)}

========================
RESPONSE FORMATTING
========================

Make every answer clean, structured, and easy to scan.

IMPORTANT:
Do NOT use Markdown bold syntax such as **Python**.
Do NOT show asterisks (*) for highlighting.


Formatting rules:

1. Use a short introduction first when appropriate.
2. After the introduction, use clear sections and bullet points.
3. Keep paragraphs short.
4. Keep bullet points concise.
5. Highlight important keywords using >
6. Never use **...** for highlighting.
7. Normalize the candidate's name carefully.
8.make responses little short and effective 

8. If PDF extraction creates accidental spaces or broken characters
inside a name, reconstruct the name only when the correct spelling
is clearly supported by the resume.

9. Never change a name based only on guesswork.

10. Prefer the name appearing in:
   - Resume header
   - Contact information
   - Email address/name
   - LinkedIn or portfolio name
   - Repeated occurrences in the resume

11. If multiple versions of the name appear, use the most complete
and consistent version.

12. Do not add, remove, or substitute letters unless the resume
provides enough evidence to determine the intended spelling.

For example:
"S HANKARAG OUDA" may represent "SHANKARA GOUDA"
if the resume clearly indicates that.

"""

    response = create_chat_completion(
        messages=[
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": question
            }
        ],
        max_tokens=256
    )

    return response.choices[0].message.content


# -----------------------------
# Test Resume Parsing
# -----------------------------

@app.get("/")
def root():
    try:
        parsed_resume = get_parsed_resume()
    except FileNotFoundError:
        return {"error": "PDF file not found"}

    return {
        "message": "Resume parsed successfully",
        "resume": parsed_resume.model_dump()
    }


# -----------------------------
# Chat Endpoint
# -----------------------------

@app.post("/chat")
def chat(request: ChatRequest):
    try:
        parsed_resume = get_parsed_resume()
    except FileNotFoundError:
        return {"error": "PDF file not found"}

    try:
        answer = ask_candidate(
            request.question,
            parsed_resume
        )
    except groq.RateLimitError as exc:
        return JSONResponse(
            status_code=503,
            content={
                "error": "Rate limit reached. Please try again later.",
                "details": str(exc)
            }
        )

    return {
        "answer": answer
    }
