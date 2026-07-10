#!/usr/bin/env python3
"""
FastAPI Server for Music Mixing and Mastering Suite
Endpoints:
1. POST /upload - Upload an unmixed WAV/MP3 track.
2. POST /process - Trigger mastering with parameters (LUFS, Character). Returns job ID and progress.
3. GET /download/{job_id}/{format} - Download the processed track (WAV or MP3).
4. GET /status/{job_id} - Check status of background processing job.
"""

import os
import uuid
import shutil
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import our mastering engine
from mastering import MasteringEngine

app = FastAPI(
    title="Audio Mastering API",
    description="Automated Music Mixing & Mastering API using Digital Signal Processing (DSP)",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants & Setup
UPLOAD_DIR = os.path.join(os.getcwd(), "storage", "unmixed")
OUTPUT_DIR = os.path.join(os.getcwd(), "storage", "mastered")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# In-memory database of mastering jobs
jobs = {}

class ProcessRequest(BaseModel):
    file_id: str
    target_lufs: float = -14.0 # Streaming (-14 LUFS), Club (-9 LUFS), CD (-7 LUFS)
    character: str = "balanced" # warm, bright, balanced

def run_mastering_task(job_id: str, input_file: str, target_lufs: float, character: str):
    """Background task to process audio to avoid blocking the main server thread."""
    try:
        jobs[job_id]["status"] = "processing"
        jobs[job_id]["stage"] = "Analyzing Audio Dynamics..."
        
        # Instantiate DSP mastering engine
        engine = MasteringEngine()
        
        # Define output file paths
        wav_out = os.path.join(OUTPUT_DIR, f"{job_id}.wav")
        mp3_out = os.path.join(OUTPUT_DIR, f"{job_id}.mp3")
        
        # We process to WAV first
        jobs[job_id]["stage"] = "Applying EQ & Compression..."
        # Simulate processing stages update for progress bars
        # (In a production system, these can be hooks inside mastering.py)
        
        # Run DSP pipeline
        engine.process(input_file, wav_out, target_lufs=target_lufs, character=character)
        
        jobs[job_id]["stage"] = "Stereo Widening & Harmonic Saturation..."
        # Generates MP3 download option too
        jobs[job_id]["stage"] = "Limiting & Finalizing..."
        engine.save_audio(engine.load_audio(wav_out)[0], mp3_out, format='mp3')
        
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["stage"] = "Mastered successfully"
        jobs[job_id]["outputs"] = {
            "wav": wav_out,
            "mp3": mp3_out
        }
    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
        print(f"Mastering failed for job {job_id}: {e}")

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Uploads an unmixed audio track (WAV or MP3)."""
    # Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".wav", ".mp3", ".m4a"]:
        raise HTTPException(status_code=400, detail="Only WAV, MP3, and M4A audio formats are supported.")
    
    file_id = str(uuid.uuid4())
    saved_name = f"{file_id}{ext}"
    saved_path = os.path.join(UPLOAD_DIR, saved_name)
    
    try:
        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")
        
    return {
        "file_id": file_id,
        "filename": file.filename,
        "format": ext[1:],
        "status": "uploaded"
    }

@app.post("/process")
def process_audio(req: ProcessRequest, background_tasks: BackgroundTasks):
    """Triggers the mixing and mastering pipeline on an uploaded file."""
    # Find uploaded file
    file_id = req.file_id
    matching_files = [f for f in os.listdir(UPLOAD_DIR) if f.startswith(file_id)]
    if not matching_files:
        raise HTTPException(status_code=404, detail="Uploaded file not found or expired.")
        
    input_file_path = os.path.join(UPLOAD_DIR, matching_files[0])
    
    # Initialize job tracking
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "job_id": job_id,
        "file_id": file_id,
        "status": "queued",
        "stage": "Initializing...",
        "target_lufs": req.target_lufs,
        "character": req.character,
        "outputs": None,
        "error": None
    }
    
    # Queue processing to background
    background_tasks.add_task(
        run_mastering_task,
        job_id=job_id,
        input_file=input_file_path,
        target_lufs=req.target_lufs,
        character=req.character
    )
    
    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Mastering job queued successfully."
    }

@app.get("/status/{job_id}")
def get_status(job_id: str):
    """Checks the progress and status of a mastering job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Mastering job not found.")
    return jobs[job_id]

@app.get("/download/{job_id}/{audio_format}")
def download_file(job_id: str, audio_format: str):
    """Downloads the mastered audio file in WAV or MP3 format."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Mastering job not found.")
        
    job = jobs[job_id]
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail=f"Job is not completed. Current status: {job['status']}")
        
    audio_format = audio_format.lower()
    if audio_format not in ["wav", "mp3"]:
        raise HTTPException(status_code=400, detail="Requested format must be 'wav' or 'mp3'.")
        
    file_path = job["outputs"][audio_format]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Output file for {audio_format} not found on disk.")
        
    media_types = {
        "wav": "audio/wav",
        "mp3": "audio/mpeg"
    }
    
    return FileResponse(
        path=file_path,
        media_type=media_types[audio_format],
        filename=f"mastered_{job_id}.{audio_format}"
    )

if __name__ == "__main__":
    import uvicorn
    print("Starting FastAPI Mastering Server on http://0.0.0.0:8000...")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
