
export function el(tag, attrs={}, ...children){ 
 const e = document.createElement(tag); 
 for(const [k,v] of Object.entries(attrs||{})){ 
 if(k==='class') e.className=v; else if(k==='html') e.innerHTML=v; else if(k.startsWith('on')) e.addEventListener(k.substring(2), v); else e.setAttribute(k,v); 
 } 
 for(const c of children){ if(c==null) continue; if(typeof c==='string') e.appendChild(document.createTextNode(c)); else e.appendChild(c); } 
 return e; 
} 
export function inputRow(label, input){ 
 return el('div',{class:'card'}, el('label',{},label), input); 
} 
export function listChips(values, onRemove){ 
 const box=el('div',{}); 
 function render(){ 
 box.innerHTML=''; 
 values.forEach((v,i)=>{ 
 const t=el('span',{class:'tag'}, v.title||v, el('button',{onclick:()=>{ onRemove(i); render(); }},'×')); 
 box.appendChild(t); 
 }); 
 } 
 render(); 
 return box; 
} 
export function multiSelect(list, selected, onChange){ 
 const wrap=el('div',{class:'grid-3'}); 
 list.forEach(opt=>{ 
 const id = `ms_${opt.id}`; 
 const chk=el('input',{type:'checkbox',id}); 
 if(selected.some(s=>s.id===opt.id)) chk.checked=true; 
 chk.addEventListener('change',()=>{ 
 if(chk.checked) selected.push(opt); else selected.splice(selected.findIndex(s=>s.id===opt.id),1); 
 onChange(selected); 
 }); 
 wrap.appendChild(el('div',{class:'card'}, el('div',{class:'kv'}, chk, el('label',{for:id}, opt.title||opt)))); 
 }); 
 return wrap; 
} 
export function textField({type='text',value='',placeholder='',oninput}){ 
 const i=el('input',{type, value, placeholder}); 
 if(oninput) i.addEventListener('input', ev=>oninput(ev.target.value)); 
 return i; 
} 
export function urlNormalize(u){ 
 if(!u) return u; const t=u.trim(); if(!t) return t; if(!/^https?:\/\//i.test(t)) return `https://${t}`; return t; 
}
