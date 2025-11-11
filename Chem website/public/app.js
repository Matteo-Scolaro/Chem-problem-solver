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

// ===== Aufbau tool wiring =====
(function(){
  const form = document.getElementById('aufbau-form'); // optional now
  const btn  = document.getElementById('aufbau-run');
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
      const wrap = dia.querySelector('.orb-diagram');
if (wrap) wrap.style.display = 'flex', wrap.style.flexDirection = 'column-reverse', wrap.style.gap = '1rem';
    }catch(err){
      cfg.innerHTML = '';
      sh.innerHTML  = '';
      dia.innerHTML = `<div class="error">${err.message}</div>`;
    }
  }

  btn && btn.addEventListener('click', run);
  form && form.addEventListener('submit', run); // enter key still works
})();

// ===== Stoichiometry wiring =====
(function(){
  const eq     = document.getElementById('st-eq');
  const knownS = document.getElementById('st-known');
  const targetS= document.getElementById('st-target');
  const parseB = document.getElementById('st-parse');
  const runB   = document.getElementById('st-run');

  const knownMode = document.getElementById('st-known-mode');
  const outMode   = document.getElementById('st-out-mode');
  const result    = document.getElementById('st-result');

  // mode containers
  const knownFields = document.getElementById('st-known-fields');
  const outFields   = document.getElementById('st-out-fields');

  function showMode(container, mode){
    container.querySelectorAll('.mode').forEach(d=>d.hidden=true);
    container.querySelectorAll(`.mode-${mode}`).forEach(d=>d.hidden=false);
  }

  knownMode.addEventListener('change', ()=> showMode(knownFields, knownMode.value));
  outMode.addEventListener('change',   ()=> showMode(outFields,   outMode.value));
  showMode(knownFields, knownMode.value);
  showMode(outFields, outMode.value);

  function populateSpecies(list){
    knownS.innerHTML = ''; targetS.innerHTML = '';
    list.forEach(s=>{
      const o1 = document.createElement('option'); o1.value=o1.textContent=s;
      const o2 = document.createElement('option'); o2.value=o2.textContent=s;
      knownS.appendChild(o1); targetS.appendChild(o2);
    });
    if(list.length>1) targetS.selectedIndex = 1;
  }

function doParse(){
  try{
    const out = window.LocalChem.stoich.balanceReaction(eq.value);
    populateSpecies(out.species);
    result.innerHTML = `<div>Balanced species detected: <code>${out.species.join(' | ')}</code></div>`;
    runB.disabled = false;     // ← enable compute now
  }catch(err){
    result.innerHTML = `<div class="error">${err.message}</div>`;
    runB.disabled = true;
  }
}

  function doRun(){
    try{
      const km = knownMode.value, om = outMode.value;

      const knownVals = {
        n:  +document.getElementById('st-known-mol').value,
        g:  +document.getElementById('st-known-g').value,
        M:  +document.getElementById('st-known-M').value,
        VL: +document.getElementById('st-known-VL').value,
        P:  +document.getElementById('st-P').value,
        V:  +document.getElementById('st-V').value,
        T:  +document.getElementById('st-T').value
      };
      const outVals = {
        M: +document.getElementById('st-out-M').value,
        P: +document.getElementById('st-out-P').value,
        T: +document.getElementById('st-out-T').value
      };

      const res = window.LocalChem.stoich.stoichCompute({
        eq: eq.value,
        knownSp: knownS.value,
        targetSp: targetS.value,
        knownMode: km,
        knownVals,
        outMode: om,
        outVals
      });

      const ratio = `${res.nKnown.toFixed(6)} mol × (${res.coeffs[res.species.indexOf(targetS.value)]}/${res.coeffs[res.species.indexOf(knownS.value)]})`;
      result.innerHTML = `
        <div><b>Result:</b> ${res.value.toPrecision(6)} ${res.unit}</div>
        <div class="muted">Moles(target) = ${ratio}</div>
      `;
    }catch(err){
      result.innerHTML = `<div class="error">${err.message}</div>`;
    }
  }

  parseB && parseB.addEventListener('click', doParse);
  runB && runB.addEventListener('click', doRun);

  // at the top of the wiring block (after grabbing DOM refs)
const runB   = document.getElementById('st-run');
runB && (runB.disabled = true);

// when reaction changes, force re-parse
eq && eq.addEventListener('input', ()=> {
  runB.disabled = true;
  // clear dropdowns so it's obvious they need to parse
  document.getElementById('st-known').innerHTML = '';
  document.getElementById('st-target').innerHTML = '';
});

  
})();






