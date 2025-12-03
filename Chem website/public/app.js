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

// ===== Aufbau tool wiring (via Python backend) =====
(function () {
  const form = document.getElementById("aufbau-form"); // optional / can be null
  const btn  = document.getElementById("aufbau-run");
  const inp  = document.getElementById("aufbau-input");
  const shCB = document.getElementById("aufbau-shorthand");
  const cfg  = document.getElementById("aufbau-config");
  const sh   = document.getElementById("aufbau-sh");
  const dia  = document.getElementById("aufbau-diagram");
  const qnEl = document.getElementById("auf-qn");

  async function run(e) {
    if (e) e.preventDefault();

    const raw = (inp.value || "").trim();
    const useSh = !!(shCB && shCB.checked);

    if (!raw) {
      cfg.innerHTML = "";
      sh.innerHTML  = "";
      dia.innerHTML = `<div class="error">Enter an element symbol or atomic number.</div>`;
      if (qnEl) qnEl.innerHTML = "";
      return;
    }

    // loading state
    if (qnEl) qnEl.innerHTML = `<span class="mono muted">Building configuration…</span>`;
    cfg.innerHTML = "";
    sh.innerHTML  = "";
    dia.innerHTML = "";

    try {
      const res = await fetch("http://127.0.0.1:8000/api/aufbau", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: raw,
          shorthand: useSh
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data.detail || res.statusText || "Backend error.";
        throw new Error(msg);
      }

      // Python should return: qnHtml, configFullHtml, shorthandHtml, diagramHtml
      if (qnEl) qnEl.innerHTML = data.qnHtml || "";
      cfg.innerHTML = data.configFullHtml || "";
      sh.innerHTML  = data.shorthandHtml  || "";
      dia.innerHTML = data.diagramHtml    || "";

      // make rows stack like your current design (top = lowest energy)
      const wrap = dia.querySelector(".orb-diagram");
      if (wrap) {
        wrap.style.display = "flex";
        wrap.style.flexDirection = "column-reverse";
        wrap.style.gap = "1rem";
      }
    } catch (err) {
      console.error(err);
      cfg.innerHTML = "";
      sh.innerHTML  = "";
      dia.innerHTML = `<div class="error">${err.message}</div>`;
      if (qnEl) qnEl.innerHTML = "";
    }
  }

  if (btn)  btn.addEventListener("click", run);
  if (form) form.addEventListener("submit", run); // if you ever wrap it in a <form>, Enter will work
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
