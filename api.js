
import { API_BASE } from './config.js';

function toJsonOrText(r){ return r.text().then(t=>{ try{return JSON.parse(t)}catch{ return t } }); }

export async function getReference(){
  const r = await fetch(`${API_BASE}/api/reference`);
  if(!r.ok) throw new Error(`reference ${r.status}`);
  return toJsonOrText(r);
}

export async function initDraft(vendorToken, inviterEmail){
  const r = await fetch(`${API_BASE}/api/drafts/init`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ vendorToken, inviterEmail }) });
  if(!r.ok) throw new Error(`drafts/init ${r.status}`);
  return toJsonOrText(r);
}

export async function savePage(draftId, pageNumber, payload){
  const r = await fetch(`${API_BASE}/api/drafts/${encodeURIComponent(draftId)}/page/${pageNumber}`,{ method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if(!r.ok) throw new Error(`save page ${pageNumber} ${r.status}`);
  return toJsonOrText(r);
}

export async function getSasForTax(fileName, contentType, fileSizeBytes, vendorToken){
  const r = await fetch(`${API_BASE}/api/uploads/taxdoc/sas`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fileName, contentType, fileSizeBytes, vendorToken }) });
  if(!r.ok) throw new Error(`tax sas ${r.status}`);
  return toJsonOrText(r);
}

export async function submitDraft(draftId){
  const r = await fetch(`${API_BASE}/api/drafts/${encodeURIComponent(draftId)}/submit`,{ method:'POST' });
  if(!r.ok) throw new Error(`submit ${r.status}`);
  return toJsonOrText(r);
}

export async function uploadWithSas(uploadUrl, file){
  const r = await fetch(uploadUrl,{ method:'PUT', headers:{ 'x-ms-blob-type':'BlockBlob','Content-Type': file.type }, body:file });
  if(!r.ok) throw new Error(`sas upload ${r.status}`);
  return true;
}
