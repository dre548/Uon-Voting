import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import random
import string
import hashlib
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CRYPTOGRAPHIC PARAMETERS (Safe Prime Groups) ---
P = 1009
G = 11
PRIVATE_KEY_RHO = 43  # Kept strictly secure on the server
PUBLIC_KEY_Y = pow(G, PRIVATE_KEY_RHO, P) # 432

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
                    (national_id TEXT PRIMARY KEY, name TEXT, pin TEXT, has_voted BOOLEAN, revoked BOOLEAN DEFAULT 0)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS settings 
                    (id INTEGER PRIMARY KEY, name TEXT, status TEXT, positions TEXT, end_time TEXT)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS audit_log 
                    (id INTEGER PRIMARY KEY AUTOINCREMENT, ts DATETIME DEFAULT CURRENT_TIMESTAMP, action TEXT, details TEXT, actor TEXT)''')
    
    # NEW CRYPTO TABLE
    conn.execute('''CREATE TABLE IF NOT EXISTS votes_crypto 
                    (id INTEGER PRIMARY KEY AUTOINCREMENT, tracking_code TEXT, national_id TEXT, candidate_id INTEGER, 
                     alpha TEXT, beta TEXT, zkp_c TEXT, zkp_s TEXT, ts DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    
    # Safe Migrations
    try: conn.execute("ALTER TABLE voters ADD COLUMN revoked BOOLEAN DEFAULT 0")
    except sqlite3.OperationalError: pass
    try: conn.execute("ALTER TABLE settings ADD COLUMN end_time TEXT")
    except sqlite3.OperationalError: pass

    # Ensure all old hashed PINs are readable 6-digit ones for printing
    voters = conn.execute("SELECT national_id, pin FROM voters").fetchall()
    for v in voters:
        if len(str(v["pin"])) > 6:
            new_pin = ''.join(random.choices(string.digits, k=6))
            conn.execute("UPDATE voters SET pin=? WHERE national_id=?", (new_pin, v["national_id"]))

    if not conn.execute("SELECT * FROM settings").fetchone():
        conn.execute("INSERT INTO settings (id, name, status, end_time) VALUES (1, 'UoN General Election', 'open', '')")
            
    conn.commit()
    conn.close()

init_db()

def log_audit(conn, action: str, details: str, actor: str = "System"):
    conn.execute("INSERT INTO audit_log (action, details, actor) VALUES (?, ?, ?)", (action, details, actor))

def is_election_closed(conn):
    settings = conn.execute("SELECT status, end_time FROM settings WHERE id=1").fetchone()
    if not settings: return False
    if settings["status"] == "closed": return True
    if settings["end_time"]:
        try:
            end_dt = datetime.fromisoformat(settings["end_time"])
            if datetime.now() > end_dt:
                return True
        except ValueError:
            pass
    return False

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

class SingleVote(BaseModel):
    candidate_id: int
    alpha: str
    beta: str
    zkp_c: str
    zkp_s: str

class VotePayload(BaseModel):
    national_id: str
    votes: List[SingleVote]

class SettingsUpdate(BaseModel):
    name: str
    status: str
    end_time: Optional[str] = ""

# --- ENDPOINTS ---
@app.get("/public-key")
def get_public_key():
    return {"p": P, "g": G, "Y": PUBLIC_KEY_Y}

@app.get("/settings")
def get_settings():
    conn = get_db()
    settings = conn.execute("SELECT * FROM settings WHERE id=1").fetchone()
    conn.close()
    return dict(settings)

@app.put("/admin/settings")
def update_settings(s: SettingsUpdate):
    conn = get_db()
    conn.execute("UPDATE settings SET name=?, status=?, end_time=? WHERE id=1", 
                 (s.name, s.status, s.end_time))
    log_audit(conn, "CONFIG_UPDATED", f"Election settings updated", "Admin")
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/admin/audit")
def get_audit_log():
    conn = get_db()
    logs = conn.execute("SELECT * FROM audit_log ORDER BY ts DESC LIMIT 100").fetchall()
    conn.close()
    return [dict(l) for l in logs]

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
    log_audit(conn, "CANDIDATE_REGISTERED", f"{cand.name} added", "Admin")
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.put("/admin/candidates/{cand_id}")
def update_candidate(cand_id: int, cand: Candidate):
    conn = get_db()
    conn.execute("UPDATE candidates SET name=?, party=?, position=?, photo_url=? WHERE id=?", 
                 (cand.name, cand.party, cand.position, cand.photo_url, cand_id))
    log_audit(conn, "CANDIDATE_UPDATED", f"Updated details for candidate ID {cand_id}", "Admin")
    conn.commit()
    conn.close()
    return {"status": "updated"}

@app.delete("/admin/candidates/{cand_id}")
def delete_candidate(cand_id: int):
    conn = get_db()
    conn.execute("DELETE FROM candidates WHERE id=?", (cand_id,))
    log_audit(conn, "CANDIDATE_REMOVED", f"Removed candidate ID {cand_id}", "Admin")
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
    conn.execute("INSERT INTO voters (national_id, name, pin, has_voted, revoked) VALUES (?, ?, ?, ?, ?)", 
                 (voter.national_id, voter.name, pin, False, False))
    log_audit(conn, "VOTER_REGISTERED", f"Registered {voter.name}", "Admin")
    conn.commit()
    conn.close()
    return {"status": "success", "pin": pin}

@app.post("/admin/voters/bulk")
def register_voters_bulk(req: BulkReq):
    conn = get_db()
    results = []
    registered_count = 0
    
    for v in req.voters:
        existing = conn.execute("SELECT * FROM voters WHERE national_id=?", (v.national_id,)).fetchone()
        if existing:
            results.append({"national_id": v.national_id, "name": v.name, "status": "Skipped (Exists)", "pin": "N/A"})
            continue
        
        pin = ''.join(random.choices(string.digits, k=6))
        conn.execute("INSERT INTO voters (national_id, name, pin, has_voted, revoked) VALUES (?, ?, ?, ?, ?)", 
                     (v.national_id, v.name, pin, False, False))
        
        results.append({"national_id": v.national_id, "name": v.name, "status": "Registered", "pin": pin})
        registered_count += 1
        
    log_audit(conn, "BULK_IMPORT", f"Imported {registered_count} voters", "Admin")
    conn.commit()
    conn.close()
    return {"processed": len(req.voters), "results": results}

@app.get("/admin/voters")
def get_voters():
    conn = get_db()
    voters = conn.execute("SELECT national_id, name, pin, has_voted, revoked FROM voters").fetchall()
    conn.close()
    return [dict(v) for v in voters]

# --- VOTER AUTHENTICATION ---
@app.post("/voter/login")
def login_voter(auth: VoterAuth):
    conn = get_db()
    if is_election_closed(conn):
        conn.close()
        raise HTTPException(status_code=403, detail="Voting is currently closed or the deadline has passed.")

    voter = conn.execute("SELECT * FROM voters WHERE national_id=?", (auth.national_id,)).fetchone()
    conn.close()
    
    if not voter: raise HTTPException(status_code=404, detail="Voter not found")
    if voter["revoked"]: raise HTTPException(status_code=403, detail="Voter credential has been revoked")
    if voter["has_voted"]: raise HTTPException(status_code=403, detail="Voter has already cast a ballot")
    if str(auth.pin) != str(voter["pin"]): raise HTTPException(status_code=401, detail="Invalid PIN")
        
    return {"status": "authenticated", "name": voter["name"]}

# --- CRYPTOGRAPHIC VOTING & TALLYING ---
@app.post("/vote")
def cast_vote(payload: VotePayload):
    conn = get_db()
    if is_election_closed(conn):
        conn.close()
        raise HTTPException(status_code=403, detail="Voting is currently closed.")

    voter = conn.execute("SELECT * FROM voters WHERE national_id=?", (payload.national_id,)).fetchone()
    if not voter or voter["has_voted"] or voter["revoked"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Unauthorized, already voted, or revoked")

    # Generate ONE tracking code for the entire ballot
    tracking_code = "UON-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
    
    # Process and verify ZKP for each candidate voted for
    for vote in payload.votes:
        alpha_val = int(vote.alpha)
        beta_val = int(vote.beta)
        c_val = int(vote.zkp_c)
        s_val = int(vote.zkp_s)

        g_s = pow(G, s_val, P)
        alpha_c_inv = pow(pow(alpha_val, c_val, P), P - 2, P)
        t_reconstructed = (g_s * alpha_c_inv) % P
        challenge_str = f"{alpha_val}{beta_val}{t_reconstructed}"
        expected_c = int(hashlib.sha256(challenge_str.encode()).hexdigest(), 16) % (P - 1)

        if c_val != expected_c:
            conn.close()
            raise HTTPException(status_code=400, detail="Cryptographic ZKP failed. Ballot rejected.")

        conn.execute('''INSERT INTO votes_crypto (tracking_code, national_id, candidate_id, alpha, beta, zkp_c, zkp_s) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)''', 
                     (tracking_code, payload.national_id, vote.candidate_id, vote.alpha, vote.beta, vote.zkp_c, vote.zkp_s))
    
    # Mark the voter as having voted once all votes are securely logged
    conn.execute("UPDATE voters SET has_voted=1 WHERE national_id=?", (payload.national_id,))
    
    log_audit(conn, "VOTE_CAST", f"Vote cast successfully by {voter['name']}", "System")
    conn.commit()
    conn.close()
    return {"status": "success", "tracking_code": tracking_code}

@app.get("/verify/{tracking_code}")
def verify_receipt(tracking_code: str):
    conn = get_db()
    rows = conn.execute('''
        SELECT v.tracking_code, v.ts, c.name as candidate_name, c.position, c.party, c.photo_url
        FROM votes_crypto v 
        JOIN candidates c ON v.candidate_id = c.id 
        WHERE v.tracking_code = ?
    ''', (tracking_code,)).fetchall()
    conn.close()
    
    if not rows: raise HTTPException(status_code=404, detail="Receipt not found on the bulletin board.")
    
    return {
        "tracking_code": rows[0]["tracking_code"],
        "ts": rows[0]["ts"],
        "positions": [dict(r) for r in rows]
    }

@app.get("/admin/tally")
def get_tally():
    conn = get_db()
    registered = conn.execute("SELECT COUNT(*) FROM voters").fetchone()[0]
    total_cast = conn.execute("SELECT COUNT(DISTINCT tracking_code) FROM votes_crypto").fetchone()[0]
    
    votes = conn.execute("SELECT candidate_id, alpha, beta FROM votes_crypto").fetchall()
    conn.close()

    candidate_ciphertexts = {}
    for row in votes:
        cid = row["candidate_id"]
        if cid not in candidate_ciphertexts: candidate_ciphertexts[cid] = []
        candidate_ciphertexts[cid].append({"alpha": int(row["alpha"]), "beta": int(row["beta"])})

    results = {}
    for cid, cts in candidate_ciphertexts.items():
        alpha_prod = 1
        beta_prod = 1
        for ct in cts:
            alpha_prod = (alpha_prod * ct["alpha"]) % P
            beta_prod = (beta_prod * ct["beta"]) % P
            
        denominator = pow(alpha_prod, PRIVATE_KEY_RHO, P)
        denominator_inv = pow(denominator, P - 2, P)
        aggregate_m = (beta_prod * denominator_inv) % P
        
        tally = 0
        while pow(G, tally, P) != aggregate_m and tally < 2000:
            tally += 1
        results[cid] = tally

    return {"registered": registered, "total_cast": total_cast, "results": results}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
              
