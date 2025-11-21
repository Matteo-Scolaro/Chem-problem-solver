from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


# --- Simple health check (to see if the API is alive) ---
@app.get("/health")
def health_check():
    return {"status": "ok"}


# --- Example stoichiometry endpoint (TEMP, just to test the flow) ---

class StoichRequest(BaseModel):
    value: float  # for now just a number, later we'll send full reaction data


class StoichResponse(BaseModel):
    result: float


@app.post("/api/stoich", response_model=StoichResponse)
def stoich_example(req: StoichRequest):
    """
    TEMP: returns value * 2 just to prove that
    the frontend can talk to Python and get a JSON back.
    Later we replace this with real chemistry logic.
    """
    return StoichResponse(result=req.value * 2)
