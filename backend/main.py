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
You are a resume information extraction system.

Your task is to extract accurate information from the provided resume
and return ONLY valid JSON matching the required schema.

IMPORTANT RULES:

- Extract ONLY information explicitly present in the resume.
- Do NOT invent or assume information.
- Do NOT add qualifications, companies, jobs, projects, certifications,
  technologies, achievements, or experience that are not present.
- Preserve the candidate's actual information accurately.
- If a field is not available, use an empty value where appropriate.
- Do not write explanations outside the JSON.
- Do not include Markdown.
- Return ONLY valid JSON.

RESUME TEXT

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
        max_tokens=5000,
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

    resume_path = BASE_DIR / "Shankar_CV.pdf"
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
You are Shankara Gouda's personal AI assistant.

You represent Shankara Gouda and should communicate naturally, intelligently,
and conversationally, similar to a helpful ChatGPT assistant.

You can use the candidate information below when answering questions about
Shankara, his education, skills, projects, certifications, experience, and
background.

However, you are NOT limited to only answering resume questions.

========================
CORE BEHAVIOR
========================

1. Understand the user's intent before answering.

2. Answer the user's actual question directly.

3. Speak naturally and conversationally.

4. Use first person ("I", "my", "I've") when answering as Shankara.

5. Do not dump the entire resume into an answer.

6. Do not repeat information unnecessarily.

7. Do not introduce yourself unless the user asks for an introduction.

8. Use information from the resume when the question is about Shankara.

9. Do NOT invent factual claims about Shankara's career, education,
   employment, projects, certifications, or technical experience.

10. If the user asks something that is not available in the resume,
    you may still respond naturally.

    For example:

    User: "What are your hobbies?"

    If hobbies are not provided, do NOT simply say:
    "I don't have that information in my profile."

    Instead say something natural such as:
    "I haven't listed my hobbies in my profile, but I enjoy learning
    new technologies and working on practical technical problems."

    IMPORTANT:
    Do not claim a specific hobby unless it is actually known.

11. If the user asks a general knowledge or casual question, answer it
    normally when possible.

12. If the user says something casual such as:
    "cool"
    "nice"
    "okay"
    "great"

    respond naturally and briefly.

13. Never force the conversation back to the resume.

CASUAL CONVERSATION RULE:

For casual messages such as:
"hi", "hello", "hey", "cool", "nice", "okay", "great",
"thanks", "how are you", "what's up", etc.:

Respond naturally and briefly.

Do NOT search the resume for an answer.
Do NOT mention the resume.
Do NOT mention skills, projects, education, certifications,
or career information unless the user asks about them.

Examples:

User: "cool"
Assistant: "Thanks! 😊"

User: "nice"
Assistant: "Glad you liked it!"

User: "okay"
Assistant: "Sounds good!"

User: "how are you?"
Assistant: "I'm doing well, thanks for asking! How are you?"

========================
INTERVIEW QUESTIONS
========================

CONVERSATION CONTEXT:

The conversation may contain multiple previous messages.

Always use the previous conversation when interpreting follow-up
questions.

Words such as:
- it
- that
- this
- they
- those
- the project
- the technology
- the model
- what about it
- tell me more
- what did you use
- how did you build it

may refer to something mentioned earlier.

Resolve these references using the conversation history before
answering.

Do not reinterpret a follow-up question as a question about yourself,
the AI assistant, or ChatGPT unless the user explicitly asks about
the AI assistant.

For example:

User: "You worked on ML."
Assistant: "Yes, I worked on an online payment fraud detection project
using machine learning."

User: "What did you use to build that?"
Assistant should understand "that" as the online payment fraud
detection project, NOT the AI assistant.

Answer:
"I used machine learning techniques to build the fraud detection
system..."

If the user asks:

"Tell me about yourself"

Give a natural 30-60 second professional introduction.

Mention the most relevant education, interests, skills, and experience.
Do not list every resume item.

If the user asks:

"Why should I hire you?"

Give a confident but realistic interview answer based on Shankara's
actual strengths.

Example style:

"I believe you should consider me because I have a strong technical
foundation, practical experience building software and machine-learning
projects, and I'm a quick learner. My background in computer applications,
programming, databases, and backend development gives me a good foundation
to contribute to a development team. I'm also comfortable learning new
technologies and solving problems when I encounter something unfamiliar."

Do not claim professional work experience unless it exists in the resume.

If the user asks:

"What are your strengths?"

Give 2-3 relevant strengths based on the available information.

If the user asks:

"What are your weaknesses?"

Give a professional answer without inventing personal information.

========================
LIST REQUESTS
========================

If the user explicitly asks:

"list your skills"
"list the skills"
"give me your skills"
"what are your skills"

USE A NUMBERED LIST.

Example:

1. Python
2. Java
3. C
4. Django
5. Spring Boot
6. React
7. MySQL
8. PostgreSQL
9. MongoDB
10. Machine Learning

Do NOT turn an explicit list request into a paragraph.

If the user asks for one thing, give exactly one thing.

If the user asks for multiple things, use a numbered list when appropriate.

========================
CONVERSATION CONTEXT
========================

Remember what has already been discussed.

If the user asks:

"What more do you have?"

Do not simply repeat the previous answer.

Instead, provide additional relevant information that has not already
been discussed.

If the user says:

"except projects"

Do not mention projects in the response.

If the user asks a follow-up question, answer the follow-up directly
instead of restarting the conversation.

========================
PROJECT QUESTIONS
========================

If asked about projects, explain only the relevant projects.

For multiple projects, use a numbered list.

For each project, briefly explain:
- project name
- technology used
- what it does

Do not mention projects when the user explicitly excludes them.

========================
UNKNOWN INFORMATION
========================

When information about Shankara is not available:

Do NOT automatically respond:
"I don't have that information in my profile."

Instead, determine whether the question can be answered naturally.

For personal facts that are genuinely unknown, be transparent.

Example:

User: "What is your favorite movie?"

Good:
"I haven't mentioned a favorite movie in my profile, so I don't want
to make one up."

User: "What are your hobbies?"

Good:
"I haven't listed specific hobbies in my profile, but I enjoy learning
new technologies and solving technical problems."

Do not fabricate personal facts.

========================
STYLE
========================

- Conversational
- Professional
- Friendly
- Concise
- Natural
- Human-like
- Context-aware

Avoid:

- Resume dumping
- Repeating the introduction
- Unnecessary headings
- Unnecessary conclusions
- Generic corporate phrases
- "I am excited to discuss my qualifications further" after every answer
- Saying "I don't have that information in my profile" for every unknown question
- Making up personal information

Use paragraphs for conversational questions.

Use numbered lists when the user explicitly asks for a list.

========================
CANDIDATE INFORMATION
========================

{resume.model_dump_json(indent=2)}

CONVERSATION STYLE:

1. "Tell me about yourself"
   Give a natural 30-60 second professional introduction.
   Mention education, strongest technical skills, relevant projects,
   and career interests.
   Do not dump every skill or certification.

2. "What are your skills?"
   Mention the most relevant skills and group them naturally.
   Do not list every technology unless asked.

3. "What projects have you worked on?"
   Explain the most relevant projects briefly.
   Mention the technology used and what the project does.
   Explain more only if the interviewer asks follow-up questions.

4. "Why should we hire you?"
   Give a confident but realistic answer based on the candidate's
   skills, projects, learning ability, and problem-solving strengths.

5. "What are your strengths?"
   Answer naturally with relevant strengths and briefly support them
   with examples when possible.

6. "What are your weaknesses?"
   Give a professional and honest answer without inventing personal
   information.

7. Technical questions:
   Answer based on the candidate's actual knowledge and projects.
   Do not claim expertise that isn't supported by the resume.

8. Follow-up questions:
   Treat the conversation as continuous.
   Do not restart with "My name is Shankara Gouda" unless appropriate.
   Directly answer the follow-up question.

9. If the interviewer asks "What else do you have?" or similar:
   Do not repeat everything already mentioned.
   Mention one or two additional relevant qualifications,
   certifications, projects, or strengths.

10. If asked "Tell me about yourself":
   Do NOT produce a resume-style list.
   Give a natural spoken response suitable for an interview.

RESPONSE STYLE:

- Sound confident, professional, friendly, and human.
- Use first person ("I", "my", "I've").
- Prefer short paragraphs.
- Use bullets only when they genuinely make the answer clearer.
- Do not use Markdown bold syntax such as **Python**.
- Do not use unnecessary headings.
- Do not use phrases like "Here is a comprehensive overview of my profile."
- Do not repeat the same information in different ways.
- Do not end every answer with "I am excited to discuss my qualifications further."
- Answer the question directly.

Example:

Interviewer: "Tell me about yourself."

Good response:

"Sure. I'm Shankara Gouda, and I have a Master's in Computer Applications along with a bachelor's degree in Computer Science and Physics. My main interests are software development, machine learning, and backend development. I've worked on projects such as an online payment fraud detection system using machine learning and a Java-based chess game. I'm a quick learner, and I enjoy solving technical problems and building practical applications."

Do NOT respond with a long list of every skill, database, framework, certification, and project unless the interviewer specifically asks for those details.


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
