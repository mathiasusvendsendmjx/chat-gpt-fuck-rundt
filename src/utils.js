export function el(html){ const d=document.createElement('div'); d.innerHTML=html.trim(); return d.firstChild; }
export function clampDt(getDelta, maxDt){ const dt=getDelta(); return Math.min(dt, maxDt); }
export function toNDC(event, renderer, out){ const rect=renderer.domElement.getBoundingClientRect(); const x=((event.clientX-rect.left)/rect.width)*2-1; const y=-((event.clientY-rect.top)/rect.height)*2+1; out.set(x,y); }
