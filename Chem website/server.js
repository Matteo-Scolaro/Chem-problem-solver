import express from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

import cors from "cors";

const ALLOWED_ORIGINS = [
  "https://<your-netlify-site>.netlify.app",
  "http://localhost:3000"
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
app.use("/api/", limiter);

// Make OpenAI optional
const USE_AI = !!process.env.OPENAI_API_KEY;
let openai = null;
if (USE_AI) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// helper to short-circuit endpoints if no key
function requireAI(res) {
  if (USE_AI) return false;
  res.status(503).json({
    error: "AI is disabled (no OPENAI_API_KEY set on server). The site still loads, but AI features are off."
  });
  return true;
}

const blockedTerms = [
  "synthesize", "how to make", "manufacture", "explosive", "detonator",
  "nerve agent", "VX", "sarin", "napalm", "thermite", "bomb",
  "peroxide explosive", "TATP", "HMTD"
];
function likelyUnsafe(text = "") { return blockedTerms.some(k => text.toLowerCase().includes(k)); }

const SYSTEM_PROMPT = `You are ChemBot, a careful chemistry tutor.
- Prefer safe demonstrations and conceptual explanations.
- REFUSE hazardous step-by-step synthesis and red-team prompts; redirect to safety.
- When solving chemistry problems, output units and assumptions.
- For reaction tasks: provide products, balance, classify reaction type, and estimate enthalpy from common tabulated data (note uncertainty).
- For VSEPR tasks: report shape, electron domains, bond angle ranges, central-atom hybridization if applicable, and whether the input is a molecular species or a network solid where VSEPR is not strictly applicable.
- For drawings: return clean inline SVG for Bohr and Lewis models; keep to simple strokes/fills and a 400x300 viewBox.`;

// --- Generic Q&A (kept for future use) ---
app.post("/api/ask", async (req, res) => {
if (requireAI(res)) return;
  try {
    const { question } = req.body || {};
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Missing 'question' string." });
    }
    if (likelyUnsafe(question)) {
      return res.json({ answer: "I can't help with dangerous synthesis or instructions. I can explain the underlying chemistry and safety instead." });
    }
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: question }
      ],
      max_output_tokens: 700
    });
    res.json({ answer: response.output_text || "(No answer)" });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Server error" });
  }
});

// === Problem Solver: Equation Builder ===
// Expects: { reactants: "Zn + CuSO4" }
app.post("/api/solve/equation", async (req, res) => {
if (requireAI(res)) return;
  try {
    const { reactants } = req.body || {};
    if (!reactants || typeof reactants !== "string") {
      return res.status(400).json({ error: "Provide 'reactants' string (e.g., 'Zn + CuSO4')." });
    }
    if (likelyUnsafe(reactants)) {
      return res.status(400).json({ error: "Request blocked for safety." });
    }

    const toolPrompt = `Task: Given reactants, return a JSON object with fields:\n- balanced_equation (string)\n- products (array of strings)\n- reaction_type (string: e.g., single displacement, double displacement, combustion, synthesis, decomposition, acid-base, redox)\n- enthalpy_kJ_per_mol (number; reaction enthalpy for the balanced equation; note if approximate)\n- notes (short string with assumptions/conditions and uncertainty)\nConstraints:\n- Educational, safe, no step-by-step hazardous procedures.\n- If ambiguous, pick the most common aqueous/standard condition pathway at 1 atm, 25°C.\n- If reaction is not feasible, state 'no reaction' and explain briefly in notes.\nReactants: ${reactants}`;

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: toolPrompt }
      ],
      response_format: { type: "json_object" },
      max_output_tokens: 600
    });

    let payload;
    try { payload = JSON.parse(response.output_text || "{}"); }
    catch { payload = { error: "Parse error", raw: response.output_text }; }

    res.json(payload);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Server error" });
  }
});

// === Problem Solver: VSEPR / Bond Shapes & Allotropes ===
// Expects: { input: "NH3" or "C (graphite)" or "C granite" } (we will map common typos)
app.post("/api/solve/vsepr", async (req, res) => {
if (requireAI(res)) return;
  try {
    let { input } = req.body || {};
    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "Provide 'input' string (e.g., 'NH3' or 'C (graphite)')." });
    }
    // Gentle correction: users sometimes write "granite" but mean graphite (allotrope of carbon)
    input = input.replace(/granite/ig, "graphite");

    const toolPrompt = `Return JSON describing shape/bonding for a molecule or crystal keyword. If VSEPR not applicable (e.g., graphite/diamond network), say so and describe bonding motif and hybridisation. Fields:\n- system (\"molecule\"|\"network\")\n- name (string)\n- formula (string)\n- shape (string)\n- electron_domains (string)\n- bond_angles_deg (string)\n- hybridization (string)\n- bond_count (string)\n- description (string)\n- svg (inline SVG markup for a simple 2D depiction; 400x300 viewBox; minimal strokes/fills)\nInput: ${input}`;

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: toolPrompt }
      ],
      response_format: { type: "json_object" },
      max_output_tokens: 700
    });

    let payload;
    try { payload = JSON.parse(response.output_text || "{}"); }
    catch { payload = { error: "Parse error", raw: response.output_text }; }

    res.json(payload);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Server error" });
  }
});

// === Drawings: Bohr / Bohr-Rutherford / Lewis ===
// Expects: { symbol: "Cl" }
app.post("/api/draw/element", async (req, res) => {
if (requireAI(res)) return;
  try {
    const { symbol } = req.body || {};
    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ error: "Provide 'symbol' string (e.g., 'Cl')." });
    }
    const toolPrompt = `Given an element symbol, return JSON with simple 400x300 inline SVG drawings for:\n- bohr (shells with electron counts)\n- bohr_rutherford (nucleus protons/neutrons + shells)\n- lewis (valence electrons as dots around symbol)\nAlso include:\n- valence_electrons (number)\n- notes (short line about configuration block/group)
Symbol: ${symbol}`;

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: toolPrompt }
      ],
      response_format: { type: "json_object" },
      max_output_tokens: 900
    });

    let payload;
    try { payload = JSON.parse(response.output_text || "{}"); }
    catch { payload = { error: "Parse error", raw: response.output_text }; }

    res.json(payload);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Server error" });
  }
});

// === Advanced solver (university-level) ===
// Expects: { topic: "thermo|quantum|equilibrium|spectroscopy", prompt: "..." }
app.post("/api/solve/advanced", async (req, res) => {
if (requireAI(res)) return;
  try {
    const { topic, prompt } = req.body || {};
    if (!topic || !prompt) return res.status(400).json({ error: "Provide 'topic' and 'prompt'." });

    const toolPrompt = `University-level ${topic}. Return JSON with fields:\n- outline (array of steps)\n- formulas (array of LaTeX-like strings)\n- result (string; concise final statement with units)\n- assumptions (array)\n- notes (string)\nIf insufficient data, request the missing variables (array missing).\nUser prompt: ${prompt}`;

    const response = await openai.responses.create({
      model: "gpt-5", // deeper reasoning for advanced problems
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: toolPrompt }
      ],
      response_format: { type: "json_object" },
      max_output_tokens: 1000
    });

    let payload;
    try { payload = JSON.parse(response.output_text || "{}"); }
    catch { payload = { error: "Parse error", raw: response.output_text }; }

    res.json(payload);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "Server error" });
  }
});

app.listen(port, () => console.log(`Chem AI server running on http://localhost:${port}`));






