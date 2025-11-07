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
    if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
}

// --- Router: #/eq | #/vsepr | #/draw | (default home)
function renderRoute(){
  const h = (location.hash || '').toLowerCase();
  if (h.startsWith('#/eq'))   return show('eq');
  if (h.startsWith('#/vsepr'))return show('vsepr');
  if (h.startsWith('#/draw')) return show('draw');
  if (h.startsWith('#/aufbau')) return show('aufbau');
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

// ===== Aufbau tool wiring =====
(function(){
  const form = document.getElementById('aufbau-form');
  if(!form) return; // defensive
  const inp  = document.getElementById('aufbau-input');
  const shCB = document.getElementById('aufbau-shorthand');
  const cfg  = document.getElementById('aufbau-config');
  const sh   = document.getElementById('aufbau-sh');
  const dia  = document.getElementById('aufbau-diagram');

  function run(e){
    e && e.preventDefault();
    try{
      const res = window.LocalChem.localAufbau(inp.value, shCB.checked);
      cfg.innerHTML = res.configFullHtml;
      sh.innerHTML  = res.shorthandHtml;
      dia.innerHTML = res.diagramHtml;
    }catch(err){
      cfg.innerHTML = '';
      sh.innerHTML  = '';
      dia.innerHTML = `<div class="error">${err.message}</div>`;
    }
  }

  form.addEventListener('submit', run);
  // default example
  if(!location.hash.startsWith('#/')) inp.value = 'K';
})();
