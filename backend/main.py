import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import sqlite3
import random
import string
import hashlib

app = FastAPI()

# Allow the Vercel frontend to communicate with this Render backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE SETUP ---
def get_db():
    conn = sqlite3.connect("election.db", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute('''CREATE TABLE IF NOT EXISTS candidates 
                    (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, party TEXT, position TEXT, photo_url TEXT)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS voters 
                    (national_id TEXT PRIMARY KEY, name TEXT, pin TEXT, has_voted BOOLEAN)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS votes 
                    (tracking_code TEXT PRIMARY KEY, national_id TEXT, candidate_id INTEGER)''')
    conn.commit()
    conn.close()

init_db()

# --- PYDANTIC MODELS ---
class Candidate(BaseModel):
    name: str
    party: str
    position: str
    photo_url: str = ""

class Voter(BaseModel):
    name: str
    national_id: str

class BulkReq(BaseModel):
    voters: List[Voter]

class VoterAuth(BaseModel):
    national_id: str
    pin: str

class Vote(BaseModel):
    national_id: str
    alpha: str
    beta: str
    t: str
    s: str

# --- ENDPOINTS ---
@app.get("/public-key")
def get_public_key():
    # ElGamal Cryptographic Parameters for the Voting Terminal
    return {"p": 1009, "g": 11, "Y": 432}

# --- CANDIDATE MANAGEMENT ---
@app.get("/candidates")
def get_candidates():
    conn = get_db()
    cands = conn.execute("SELECT * FROM candidates").fetchall()
    conn.close()
    return [dict(c) for c in cands]

@app.post("/admin/candidates")
def add_candidate(cand: Candidate):
    conn = get_db()
    conn.execute("INSERT INTO candidates (name, party, position, photo_url) VALUES (?, ?, ?, ?)", 
                 (cand.name, cand.party, cand.position, cand.photo_url))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.put("/admin/candidates/{cand_id}")
def update_candidate(cand_id: int, cand: Candidate):
    conn = get_db()
    conn.execute("UPDATE candidates SET name=?, party=?, position=?, photo_url=? WHERE id=?", 
                 (cand.name, cand.party, cand.position, cand.photo_url, cand_id))
    conn.commit()
    conn.close()
    return {"status": "updated"}

@app.delete("/admin/candidates/{cand_id}")
def delete_candidate(cand_id: int):
    conn = get_db()
    conn.execute("DELETE FROM candidates WHERE id=?", (cand_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}

# --- VOTER MANAGEMENT ---
@app.post("/admin/voters")
def register_voter(voter: Voter):
    conn = get_db()
    existing = conn.execute("SELECT * FROM voters WHERE national_id=?", (voter.national_id,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Voter ID already registered")
    
    pin = ''.join(random.choices(string.digits, k=6))
    hashed_pin = hashlib.sha256(pin.encode()).hexdigest()
    
    conn.execute("INSERT INTO voters (national_id, name, pin, has_voted) VALUES (?, ?, ?, ?)", 
                 (voter.national_id, voter.name, hashed_pin, False))
    conn.commit()
    conn.close()
    return {"status": "success", "pin": pin}

@app.post("/admin/voters/bulk")
def register_voters_bulk(req: BulkReq):
    conn = get_db()
    results = []
    
    for v in req.voters:
        existing = conn.execute("SELECT * FROM voters WHERE national_id=?", (v.national_id,)).fetchone()
        if existing:
            results.append({"national_id": v.national_id, "name": v.name, "status": "Skipped (Exists)", "pin": "N/A"})
            continue
        
        pin = ''.join(random.choices(string.digits, k=6))
        hashed_pin = hashlib.sha256(pin.encode()).hexdigest()
        
        conn.execute("INSERT INTO voters (national_id, name, pin, has_voted) VALUES (?, ?, ?, ?)", 
                     (v.national_id, v.name, hashed_pin, False))
        
        results.append({"national_id": v.national_id, "name": v.name, "status": "Registered", "pin": pin})
        
    conn.commit()
    conn.close()
    return {"processed": len(req.voters), "results": results}

@app.get("/admin/voters")
def get_voters():
    conn = get_db()
    voters = conn.execute("SELECT national_id, name, has_voted FROM voters").fetchall()
    conn.close()
    return [dict(v) for v in voters]

# --- VOTER AUTHENTICATION ---
@app.post("/voter/login")
def login_voter(auth: VoterAuth):
    conn = get_db()
    voter = conn.execute("SELECT * FROM voters WHERE national_id=?", (auth.national_id,)).fetchone()
    conn.close()
    
    if not voter:
        raise HTTPException(status_code=404, detail="Voter not found")
    if voter["has_voted"]:
        raise HTTPException(status_code=403, detail="Voter has already cast a ballot")
        
    hashed_input = hashlib.sha256(auth.pin.encode()).hexdigest()
    if hashed_input != voter["pin"]:
        raise HTTPException(status_code=401, detail="Invalid PIN")
        
    return {"status": "authenticated", "name": voter["name"]}

# --- VOTING & TALLYING ---
@app.post("/vote")
def cast_vote(vote: Vote):
    conn = get_db()
    voter = conn.execute("SELECT * FROM voters WHERE national_id=?", (vote.national_id,)).fetchone()
    if not voter or voter["has_voted"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Unauthorized or already voted")

    cand_id = 1 
    cands = conn.execute("SELECT id FROM candidates").fetchall()
    for c in cands:
        cand_id = c["id"] 
        break 

    tracking_code = "UON-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
    
    conn.execute("UPDATE voters SET has_voted=1 WHERE national_id=?", (vote.national_id,))
    conn.execute("INSERT INTO votes (tracking_code, national_id, candidate_id) VALUES (?, ?, ?)", 
                 (tracking_code, vote.national_id, cand_id))
    conn.commit()
    conn.close()
    return {"status": "success", "tracking_code": tracking_code}

@app.get("/admin/tally")
def get_tally():
    conn = get_db()
    registered = conn.execute("SELECT COUNT(*) FROM voters").fetchone()[0]
    total_cast = conn.execute("SELECT COUNT(*) FROM votes").fetchone()[0]
    
    results = {}
    vote_counts = conn.execute("SELECT candidate_id, COUNT(*) as tally FROM votes GROUP BY candidate_id").fetchall()
    for vc in vote_counts:
        results[vc["candidate_id"]] = vc["tally"]
        
    conn.close()
    return {"registered": registered, "total_cast": total_cast, "results": results}