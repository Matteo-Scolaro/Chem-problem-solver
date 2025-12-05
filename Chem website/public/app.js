// tiny helpers
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const on = (el, ev, cb) => el && el.addEventListener(ev, cb);

// show one view, hide others
function show(id){
  const isHome = (id === 'home');

  // Sections you want visible on Home only
  const ptable  = $('#ptable')?.closest('section');  // periodic table block (if present)
  const homeGrid = $('#home');

  // Toggle visibility
  if (ptable)   ptable.hidden   = !isHome;
  if (homeGrid) homeGrid.hidden = !isHome;

  // Show only the requested tool view (or none when home)
  $$('.view').forEach(v => v.hidden = (isHome || v.id !== id));

  // IMPORTANT: no global scroll-to-top anymore
  // If you want the tool to appear at the top of the viewport, use:
  if (!isHome) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
}

// --- Router: #/eq | #/vsepr | #/draw | (default home)
function renderRoute(){
  const h = (location.hash || '').toLowerCase();
  if (h.startsWith('#/eq'))   return show('eq');
  if (h.startsWith('#/vsepr'))return show('vsepr');
  if (h.startsWith('#/draw')) return show('draw');
  if (h.startsWith('#/aufbau')) return show('aufbau');
  if (h.startsWith('#/stoich')) return show('stoich');
  show('home');
}
window.addEventListener('hashchange', renderRoute);
window.addEventListener('DOMContentLoaded', renderRoute);

// also make the cards change the hash (works if someone middle-clicks too)
$$('.nav-card').forEach(a => on(a, 'click', e => {
  // let the browser set the hash; router will do the rest
}));

/* ================= EQUATION BUILDER ================= */
(function(){
  const input = $('#eq-react'), out = $('#eq-out'), btn = $('#eq-run');
  if(!btn) return;

  on(btn, 'click', async () => {
    const react = (input.value || '').trim();
    if(!react){ out.textContent = "Enter reactants (e.g., H2 + O2 -> H2O)"; return; }
    btn.disabled = true;
    out.textContent = "Balancing…";
    try{
      const d = await LocalChem.localSolveEquation(react);
      if(d.error){ out.textContent = `Error: ${d.error}`; return; }

      const lines = [];
      lines.push(`BALANCED:\n${d.balanced_equation}\n`);
      if (Array.isArray(d.products) && d.products.length){
        lines.push(`PRODUCTS:\n${d.products.join(', ')}\n`);
      }
      if (d.reaction_type) lines.push(`TYPE:\n${d.reaction_type}\n`);
      if (typeof d.enthalpy_kJ_per_mol === 'number')
        lines.push(`ΔH° (298 K):\n${d.enthalpy_kJ_per_mol} kJ/mol\n`);
      if (Array.isArray(d.mechanism) && d.mechanism.length){
        lines.push(`MECHANISM (OUTLINE):\n• ${d.mechanism.join('\n• ')}\n`);
      }
      if (d.notes) lines.push(`NOTES:\n${d.notes}`);

      out.textContent = lines.join('\n');
    }catch(err){
      console.error(err);
      out.textContent = "Serverless solver error.";
    }finally{
      btn.disabled = false;
    }
  });
})();

/* ================= VSEPR ================= */
(function(){
  const input = $('#vs-input'), out = $('#vs-out'), btn = $('#vs-run'), svgBox = $('#vs-svg');
  if(!btn) return;

  on(btn, 'click', async () => {
    const s = (input.value || '').trim();
    if(!s){ out.textContent = "Enter a formula (e.g., NH3)"; return; }
    btn.disabled = true; out.textContent = ""; svgBox.innerHTML = "";
    try{
      const d = await LocalChem.localSolveVSEPR(s);
      // white SVG provided by LocalChem
      svgBox.innerHTML = d.svg || '';
      const lines = [];
      lines.push(`ELECTRON GEOMETRY:\n${d.electron_geometry}\n`);
      lines.push(`MOLECULAR GEOMETRY:\n${d.molecular_geometry}\n`);
      lines.push(`ELECTRON DOMAINS:\n${d.electron_domains}\n`);
      if (d.bond_angles_deg) lines.push(`BOND ANGLES:\n${d.bond_angles_deg}\n`);
      if (d.hybridization)  lines.push(`HYBRIDIZATION:\n${d.hybridization}`);
      out.textContent = lines.join('\n');
    }catch(err){
      console.error(err);
      out.textContent = "VSEPR error.";
    }finally{
      btn.disabled = false;
    }
  });
})();

/* ================= DRAWINGS ================= */
(function(){
  const sel = $('#draw-symbol'), btn = $('#draw-run');
  const bohr = $('#svg-bohr'), br = $('#svg-br'), lew = $('#svg-lewis'), notes = $('#draw-notes');
  if(!btn) return;

  // populate first 20
  const order = ['H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar','K','Ca'];
  sel.innerHTML = order.map(s => `<option value="${s}">${s}</option>`).join('');

  on(btn,'click', async ()=>{
    const sym = sel.value;
    btn.disabled = true; bohr.innerHTML = br.innerHTML = lew.innerHTML = ''; notes.textContent = '';
    try{
      const d = await LocalChem.localDrawElement(sym);
      bohr.innerHTML = d.bohr || '';
      br.innerHTML   = d.bohr_rutherford || '';
      lew.innerHTML  = d.lewis || '';
      notes.textContent = d.notes || '';
    }catch(e){
      console.error(e);
      notes.textContent = 'Drawing error.';
    }finally{
      btn.disabled = false;
    }
  });
})();

// ===== Aufbau (Orbital Diagram) – Python backend version =====
(() => {
  const inputEl     = document.getElementById("aufbau-input");
  const shorthandEl = document.getElementById("aufbau-shorthand");
  const runBtn      = document.getElementById("aufbau-run");

  const qnEl        = document.getElementById("auf-qn");
  const cfgEl       = document.getElementById("aufbau-config");
  const shEl        = document.getElementById("aufbau-sh");
  const diagramEl   = document.getElementById("aufbau-diagram");

  if (!inputEl || !runBtn) return; // safety

  // --- minimal periodic table just to convert symbol -> Z ---
  const SYMBOL_TO_Z = {
    H:1, He:2,
    Li:3, Be:4, B:5, C:6, N:7, O:8, F:9, Ne:10,
    Na:11, Mg:12, Al:13, Si:14, P:15, S:16, Cl:17, Ar:18,
    K:19, Ca:20, Sc:21, Ti:22, V:23, Cr:24, Mn:25, Fe:26, Co:27, Ni:28,
    Cu:29, Zn:30, Ga:31, Ge:32, As:33, Se:34, Br:35, Kr:36,
    Rb:37, Sr:38, Y:39, Zr:40, Nb:41, Mo:42, Tc:43, Ru:44, Rh:45, Pd:46,
    Ag:47, Cd:48, In:49, Sn:50, Sb:51, Te:52, I:53, Xe:54,
    Cs:55, Ba:56, La:57, Ce:58, Pr:59, Nd:60, Pm:61, Sm:62, Eu:63, Gd:64,
    Tb:65, Dy:66, Ho:67, Er:68, Tm:69, Yb:70, Lu:71,
    Hf:72, Ta:73, W:74, Re:75, Os:76, Ir:77, Pt:78, Au:79, Hg:80,
    Tl:81, Pb:82, Bi:83, Po:84, At:85, Rn:86,
    Fr:87, Ra:88, Ac:89, Th:90, Pa:91, U:92, Np:93, Pu:94, Am:95, Cm:96,
    Bk:97, Cf:98, Es:99, Fm:100, Md:101, No:102, Lr:103,
    Rf:104, Db:105, Sg:106, Bh:107, Hs:108, Mt:109, Ds:110, Rg:111,
    Cn:112, Nh:113, Fl:114, Mc:115, Lv:116, Ts:117, Og:118,
  };

  const NOBLE_CORE = [
    { Z:2,  symbol:"He" },
    { Z:10, symbol:"Ne" },
    { Z:18, symbol:"Ar" },
    { Z:36, symbol:"Kr" },
    { Z:54, symbol:"Xe" },
    { Z:86, symbol:"Rn" },
    { Z:118,symbol:"Og" },
  ];

  function zFromInput(raw) {
    raw = raw.trim();
    if (!raw) throw new Error("Enter an element symbol or atomic number.");

    // numeric Z
    if (/^\d+$/.test(raw)) {
      const Z = parseInt(raw, 10);
      if (Z < 1 || Z > 118) throw new Error("Atomic number must be between 1 and 118.");
      return Z;
    }

    // symbol, normalize capitalization
    const sym = raw[0].toUpperCase() + raw.slice(1).toLowerCase();
    const Z = SYMBOL_TO_Z[sym];
    if (!Z) throw new Error(`Unknown element symbol: ${sym}`);
    return Z;
  }

  function nobleCoreSymbol(Z) {
    let core = null;
    for (const item of NOBLE_CORE) {
      if (item.Z < Z) core = item;
    }
    return core ? core.symbol : null;
  }

  function buildDiagramHtml(rows) {
    return `
      <div class="orb-diagram">
        ${rows.map(row => `
          <div class="orb-row">
            <div class="orb-label">${row.label}</div>
            <div class="orb-group">
              ${row.boxes.map(box => `
                <div class="orb-box">
                  <span class="orb-arrow up">${box.up ? "↑" : ""}</span>
                  <span class="orb-arrow down">${box.down ? "↓" : ""}</span>
                </div>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  async function runAufbau() {
    const raw   = inputEl.value;
    const useSh = shorthandEl.checked;

    // clear previous
    if (qnEl) qnEl.innerHTML = "";
    cfgEl.innerHTML     = "";
    shEl.innerHTML      = "";
    diagramEl.innerHTML = "";

    let Z;
    try {
      Z = zFromInput(raw);
    } catch (err) {
      diagramEl.innerHTML = `<div class="mono muted">${err.message}</div>`;
      return;
    }

    diagramEl.innerHTML = `<div class="mono muted">Contacting Python backend…</div>`;

    let res;
    try {
      res = await fetch("http://127.0.0.1:8000/api/aufbau", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Z, use_shorthand: useSh }),
      });
    } catch (err) {
      diagramEl.innerHTML = `<div class="mono muted">Cannot reach backend.</div>`;
      return;
    }

    const data = await res.json();
    if (!res.ok) {
      const msg = data.detail || res.statusText || "Backend error.";
      diagramEl.innerHTML = `<div class="mono muted">${msg}</div>`;
      return;
    }

    // ----- Quantum numbers -----
    if (qnEl) {
      qnEl.innerHTML =
        `Quantum numbers (last e⁻ in <span class="mono">${data.last_subshell}</span>): ` +
        `n = ${data.last_n}, ℓ = ${data.last_l}, ` +
        `m<sub>ℓ</sub> = ${data.last_ml}, m<sub>s</sub> = ${data.last_ms}`;
    }

    // ----- Full configuration -----
    const cfgStr = (data.config || [])
      .map(t => `${t.label}<sup>${t.electrons}</sup>`)
      .join(" ");
    cfgEl.innerHTML = `<strong>Configuration:</strong> ${cfgStr}`;

    // ----- Shorthand configuration -----
    if (useSh && data.shorthand && data.shorthand.length) {
      const core = nobleCoreSymbol(data.Z);
      const shStr = data.shorthand
        .map(t => `${t.label}<sup>${t.electrons}</sup>`)
        .join(" ");
      if (core) {
        shEl.innerHTML = `<strong>Shorthand:</strong> [${core}] ${shStr}`;
      } else {
        shEl.innerHTML = `<strong>Shorthand:</strong> ${shStr}`;
      }
    } else {
      shEl.innerHTML = `<strong>Shorthand:</strong> —`;
    }

    // ----- Orbital diagram -----
    diagramEl.innerHTML = buildDiagramHtml(data.orbitals || []);
  }

  runBtn.addEventListener("click", runAufbau);
})();

// ===== Stoichiometry wiring =====
(function(){
  const eq     = document.getElementById("st-eq");
  const knownS = document.getElementById("st-known");
  const targetS= document.getElementById("st-target");
  const parseB = document.getElementById("st-parse");
  const runB   = document.getElementById("st-run");

  const knownMode = document.getElementById("st-known-mode");
  const outMode   = document.getElementById("st-out-mode");
  const result    = document.getElementById("st-result");

  const knownFields = document.getElementById("st-known-fields");
  const outFields   = document.getElementById("st-out-fields");

  function showMode(container, mode, isOut){
    container.querySelectorAll(".mode").forEach(d => d.hidden = true);
    container.querySelectorAll(".mode-" + mode).forEach(d => d.hidden = false);

    // for outputs, hide the whole conditions box when not needed
    if (isOut){
      container.hidden = (mode === "mol" || mode === "mass");
    }
  }

  if (knownMode && knownFields){
    showMode(knownFields, knownMode.value, false);
    knownMode.addEventListener("change", () =>
      showMode(knownFields, knownMode.value, false)
    );
  }

  if (outMode && outFields){
    showMode(outFields, outMode.value, true);
    outMode.addEventListener("change", () =>
      showMode(outFields, outMode.value, true)
    );
  }

  function populateSpecies(list){
    knownS.innerHTML = "";
    targetS.innerHTML = "";
    list.forEach(s => {
      const o1 = document.createElement("option");
      o1.value = o1.textContent = s;
      const o2 = document.createElement("option");
      o2.value = o2.textContent = s;
      knownS.appendChild(o1);
      targetS.appendChild(o2);
    });
    if (list.length > 1) targetS.selectedIndex = 1;
  }

  function doParse(){
    try{
      const out = window.LocalChem.stoich.balanceReaction(eq.value);
      populateSpecies(out.species);
      result.innerHTML =
        `<div>Balanced species detected: <code>${out.species.join(" | ")}</code></div>`;
      if (runB) runB.disabled = false;
    }catch(err){
      console.error(err);
      result.innerHTML = `<div class="error">${err.message}</div>`;
      if (runB) runB.disabled = true;
    }
  }

  async function doRun() {
    try {
      const km = knownMode.value;
      const om = outMode.value;

      const knownVals = {
        n:  +document.getElementById("st-known-mol").value,
        g:  +document.getElementById("st-known-g").value,
        M:  +document.getElementById("st-known-M").value,
        VL: +document.getElementById("st-known-VL").value,
        P:  +document.getElementById("st-P").value,
        V:  +document.getElementById("st-V").value,
        T:  +document.getElementById("st-T").value,
      };

      const outVals = {
        M: +document.getElementById("st-out-M").value,
        P: +document.getElementById("st-out-P").value,
        T: +document.getElementById("st-out-T").value,
      };

      const payload = {
        eq: eq.value,              // Python will balance this
        knownSp: knownS.value,
        targetSp: targetS.value,
        knownMode: km,
        knownVals,
        outMode: om,
        outVals,
      };

      // Loading message
      result.innerHTML =
        `<div class="mono muted">Contacting Python backend…</div>`;

      const res = await fetch("http://127.0.0.1:8000/api/stoich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data.detail || res.statusText || "Backend error.";
        throw new Error(msg);
      }

      // ---------- nicer display ----------
      // 1) Main result line
      const mainLine =
        `<b>Result:</b> ${data.value.toFixed(4)} ${data.unit}`;

      // 2) Split backend "details" into pieces
      let nLine     = "";
      let convLine  = "";
      let eqLine    = "";
      let ratioLine = "";

      if (data.details) {
        const parts = data.details.split("|").map(p => p.trim());

        // backend now sends:
        // [0] = n_known step
        // [1] = stoich step (we'll get from ratio string)
        // [2] = conversion step (V = ... or m = ...)
        nLine    = parts[0] || "";
        convLine = parts[2] || "";

        for (const p of parts) {
          if (p.startsWith("balanced_eq=")) {
            eqLine = p.replace("balanced_eq=", "");
          } else if (p.startsWith("knownSp=")) {
            // e.g. "knownSp=O2 (coef=5) -> targetSp=CO2 (coef=3)"
            ratioLine = p
              .replace("knownSp=", "")
              .replace("targetSp=", "")
              .replace("->", " → ");
          }
        }
      }

      // 3) Build compact “work shown” block in chronological order
      let workHtml = "";
      if (nLine) {
        workHtml +=
          `<div>Moles of known: <span class="mono">${nLine}</span></div>`;
      }
      if (ratioLine) {
        workHtml +=
          `<div>Stoich ratio: <span class="mono">${ratioLine}</span></div>`;
      }
      if (convLine) {
        workHtml +=
          `<div>Conversion: <span class="mono">${convLine}</span></div>`;
      }
      if (eqLine) {
        workHtml +=
          `<div>Balanced eq: <span class="mono">${eqLine}</span></div>`;
      }

      result.innerHTML = `
        <div>${mainLine}</div>
        <div class="mono muted" style="margin-top:.35rem;">
          ${workHtml}
        </div>
      `;
    } catch (err) {
      console.error(err);
      result.innerHTML = `<div class="error">${err.message}</div>`;
    }
  }

  if (parseB) parseB.addEventListener("click", doParse);
  if (runB)   runB.addEventListener("click", doRun);

  // disable Compute until a successful Parse
  if (runB) runB.disabled = true;

  // when reaction text changes, force re-parse
  if (eq) {
    eq.addEventListener("input", () => {
      if (runB) runB.disabled = true;
      knownS.innerHTML = "";
      targetS.innerHTML = "";
    });
  }
})();
