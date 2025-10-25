function $(s){return document.querySelector(s)}
function on(el,ev,cb){el&&el.addEventListener(ev,cb)}

// Equation
(function(){
  const input=$('#eq-react'), out=$('#eq-out'), btn=$('#eq-run')
  if(!btn) return
  on(btn,'click',async ()=>{
    const react=(input.value||'').trim()
    if(!react){ out.textContent='Enter reactants (e.g., H2 + O2 -> H2O)'; return }
    btn.disabled=true; out.textContent='Balancing…'
    try{
      const data = await LocalChem.localSolveEquation(react)
      const lines=[]
      if(data.balanced_equation) lines.push(`Balanced: ${data.balanced_equation}`)
      if(Array.isArray(data.products)) lines.push(`Products: ${data.products.join(', ')}`)
      if(data.reaction_type) lines.push(`Type: ${data.reaction_type}`)
      if(data.enthalpy_kJ_per_mol!=null) lines.push(`ΔH ≈ ${data.enthalpy_kJ_per_mol} kJ`)
      if(data.notes) lines.push(`Notes: ${data.notes}`)
      out.textContent = lines.join('\n') || 'No data.'
    }catch(err){ out.textContent=`Error: ${err?.message||err}` }
    finally{ btn.disabled=false }
  })
})();

// VSEPR
(function(){
  const input=$('#vs-input'), out=$('#vs-out'), svg=$('#vs-svg'), btn=$('#vs-run')
  if(!btn) return
  on(btn,'click',async ()=>{
    const v=(input.value||'').trim()
    if(!v){ out.textContent='Enter a molecule (e.g., NH3)'; return }
    btn.disabled=true; out.textContent='Analyzing…'; svg.innerHTML=''
    try{
      const data=await LocalChem.localSolveVSEPR(v)
      const lines=[]
      if(data.system) lines.push(`System: ${data.system}`)
      if(data.shape) lines.push(`Shape: ${data.shape}`)
      if(data.electron_domains) lines.push(`Electron domains: ${data.electron_domains}`)
      if(data.bond_angles_deg) lines.push(`Bond angles: ${data.bond_angles_deg}`)
      if(data.hybridization) lines.push(`Hybridization: ${data.hybridization}`)
      out.textContent = lines.join('\n') || 'No data.'
      if(data.svg) svg.innerHTML=data.svg
    }catch(err){ out.textContent=`Error: ${err?.message||err}` }
    finally{ btn.disabled=false }
  })
})();

// Drawings
(function(){
  const sel=$('#draw-symbol'), btn=$('#draw-run'), b=$('#svg-bohr'), br=$('#svg-br'), lew=$('#svg-lewis'), notes=$('#draw-notes')
  if(!btn) return
  // populate first 20
  const order=Object.keys(PERIODIC.Z); sel.innerHTML=order.map(s=>`<option value="${s}">${s}</option>`).join('')
  on(btn,'click',async ()=>{
    const s=sel.value; btn.disabled=true; notes.textContent='Drawing…'
    try{
      const d=await LocalChem.localDrawElement(s)
      if(d.error){ notes.textContent=d.error; return }
      b.innerHTML=d.bohr||''; br.innerHTML=d.bohr_rutherford||''; lew.innerHTML=d.lewis||''; notes.textContent=d.notes||''
    }catch(err){ notes.textContent=`Error: ${err?.message||err}` }
    finally{ btn.disabled=false }
  })
})();
