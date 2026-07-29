/*
 * GENERATED FILE — DO NOT EDIT.
 *
 * Built by tools/build-transform-lab.js from Transform Lab v3.0's src/js/ ES modules,
 * concatenated into one classic script so the app loads from file:// as well as http.
 * Edit the upstream source and re-run the script instead.
 */
(function () {
'use strict';

/* ── src/js/utils.js ───────────────────────────────────────────── */
// ══════════════════════════════════════════════════
// SHARED UTILITIES & GEOMETRY ENGINE
// ══════════════════════════════════════════════════

const STEP = 40;

// Snapping and Grid Math
const snap = v => Math.round(v / STEP) * STEP;
const toGrid = (px, c) => Math.round((px - c) / STEP);
const gc = (px, py, cx, cy) => [toGrid(px,cx), -toGrid(py,cy)];
const gf = (x,y) => `(${x}, ${y})`;

// Color helper
const rgba = (hex, a) => {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
};

// DOM helper
const el = id => document.getElementById(id);
const set = (id, v) => { const e=el(id); if(e) e.textContent=v; };

// Math Utility: Point Rotation
const rotatePt = (px, py, cxr, cyr, deg) => {
  const rad = deg * Math.PI / 180, dx = px - cxr, dy = py - cyr;
  return [cxr + dx * Math.cos(rad) - dy * Math.sin(rad), cyr + dx * Math.sin(rad) + dy * Math.cos(rad)];
};

// Shape Definitions
const SH = {
  triangle: () => [ [0, -2*STEP], [-2*STEP, 2*STEP], [2*STEP, 2*STEP] ],
  square: () => [ [-2*STEP, -2*STEP], [2*STEP, -2*STEP], [2*STEP, 2*STEP], [-2*STEP, 2*STEP] ],
  pentagon: () => [ [0, -2*STEP], [-2*STEP, 0], [-STEP, 2*STEP], [STEP, 2*STEP], [2*STEP, 0] ]
};
const getShape = (k) => SH[k]?SH[k]():SH.triangle();

// Reconstructs the namespace that `import * as Utils` provided upstream.
const Utils = { STEP, snap, toGrid, gc, gf, rgba, el, set, rotatePt, getShape };

/* ── src/js/canvas.js ──────────────────────────────────────────── */
// ══════════════════════════════════════════════════
// SHARED CANVAS & DRAWING UTILITIES
// ══════════════════════════════════════════════════



let APP_ZOOM = 1;
function setAppZoom(z) { APP_ZOOM = z; }

function applyZoom(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(APP_ZOOM, APP_ZOOM);
  ctx.translate(-cx, -cy);
}

function resetZoom(ctx) {
  ctx.restore();
}

function updateTransBox(lvlId, text) {
  const lbl = el(lvlId.replace('Box', 'Lbl'));
  const box = el(lvlId);
  if(!lbl || !box) return;
  if(text) {
     box.textContent = text;
     lbl.classList.add('active');
     box.classList.add('active');
  } else {
     lbl.classList.remove('active');
     box.classList.remove('active');
  }
}

const formatSideBySide = (absPre, absImg, cx, cy) => {
  let html = `<div class="coord-grid">
    <div class="coord-col"><div class="ck cpre" style="margin-bottom:2px">Pre-image</div>`;
  if(absPre){
    absPre.forEach((p,i) => {
      const [gx, gy] = gc(p[0], p[1], cx, cy);
      html += `<div class="cpre">${String.fromCharCode(65+i)}(${gx}, ${gy})</div>`;
    });
  }
  html += `</div><div class="coord-col"><div class="ck cimg" style="margin-bottom:2px">Image</div>`;
  if(absImg){
    absImg.forEach((p,i) => {
      const [gx, gy] = gc(p[0], p[1], cx, cy);
      html += `<div class="cimg">${String.fromCharCode(65+i)}'(${gx}, ${gy})</div>`;
    });
  }
  html += `</div></div>`;
  return html;
};

function initCanvas(id) {
  const c = el(id), dpr = window.devicePixelRatio || 1;
  const card = c.parentElement;

  const cw = card.clientWidth - 28;
  let w = Math.max(cw, 240);
  let h = w * 0.55;

  const maxH = window.innerHeight - 240;
  if (h > maxH && maxH > 200) {
    h = maxH;
    w = h / 0.55;
  }

  c.width = w*dpr; c.height = h*dpr;
  c.style.width = w+'px'; c.style.height = h+'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);

  // Inject Zoom Buttons if they don't exist
  if (!card.querySelector('.zoom-controls')) {
    const vc = document.createElement('div');
    vc.className = 'zoom-controls';
    vc.innerHTML = `
      <button class="zbtn" id="zIn_`+id+`">+</button>
      <button class="zbtn" id="zHome_`+id+`" title="Reset zoom" style="font-size:14px">🏠</button>
      <button class="zbtn" id="zOut_`+id+`">−</button>
    `;
    vc.style = 'position:absolute;bottom:78px;right:18px;display:flex;flex-direction:column;gap:5px;z-index:50';
    const s = document.createElement('style');
    if(!document.head.querySelector('#zoomStyles')) {
      s.id = 'zoomStyles';
      s.textContent = `.zbtn{background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.2);color:#fff;width:30px;height:30px;border-radius:6px;cursor:pointer;font-size:16px;line-height:28px;} .zbtn:hover{background:rgba(255,255,255,0.1)}`;
      document.head.appendChild(s);
    }
    card.style.position = 'relative';
    card.appendChild(vc);

    const onZoom = () => {
      window.dispatchEvent(new CustomEvent('zoomChange'));
    };

    vc.querySelector('#zIn_'+id).onclick = () => { setAppZoom(Math.min(3, APP_ZOOM + 0.2)); onZoom(); };
    vc.querySelector('#zHome_'+id).onclick = () => { setAppZoom(1); onZoom(); };
    vc.querySelector('#zOut_'+id).onclick = () => { setAppZoom(Math.max(0.4, APP_ZOOM - 0.2)); onZoom(); };
    
    let zoomTimeout;
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      if(!zoomTimeout) {
        zoomTimeout = requestAnimationFrame(() => {
          const factor = e.deltaY < 0 ? 0.05 : -0.05;
          setAppZoom(Math.min(3, Math.max(0.4, APP_ZOOM + factor)));
          onZoom();
          zoomTimeout = null;
        });
      }
    });
  }

  return { canvas:c, ctx, w, h, cx:snap(Math.round(w/2)), cy:snap(Math.round(h/2)) };
}

function attachResize(id, onResize) {
  const elC = el(id);
  if(!elC) return;
  new ResizeObserver(() => {
    const rect = elC.parentElement.getBoundingClientRect();
    if (rect.width === 0) return;
    onResize();
  }).observe(elC.parentElement);
  window.addEventListener('zoomChange', () => {
    const rect = elC.parentElement.getBoundingClientRect();
    if (rect.width === 0) return;   // panel is hidden — don't corrupt model state
    onResize();
  });
}

const getBounds = (pts, ox, oy) => {
  let l=Infinity, r=-Infinity, t=Infinity, b=-Infinity;
  pts.forEach(([px,py]) => {
     l=Math.min(l, ox+px); r=Math.max(r, ox+px);
     t=Math.min(t, oy+py); b=Math.max(b, oy+py);
  });
  return {l, r, t, b};
};

const clampPos = (ox, oy, pts, w, h) => {
  let nx = ox, ny = oy;
  let b = getBounds(pts, 0, 0);
  if(nx + b.l < 0) nx = -b.l;
  if(nx + b.r > w) nx = w - b.r;
  if(ny + b.t < 0) ny = -b.t;
  if(ny + b.b > h) ny = h - b.b;
  return [nx, ny];
};

function drawGrid(ctx, w, h, cx, cy) {
  // We clear the canvas assuming transform is un-scaled
  ctx.clearRect(0,0,w*10,h*10); // arbitrary large clear to handle all displays

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(APP_ZOOM, APP_ZOOM);
  ctx.translate(-cx, -cy);

  const viewW = w / APP_ZOOM;
  const viewH = h / APP_ZOOM;
  const minX = cx - viewW;
  const maxX = cx + viewW;
  const minY = cy - viewH;
  const maxY = cy + viewH;

  const startX_grid = Math.floor(minX / STEP) * STEP;
  const startY_grid = Math.floor(minY / STEP) * STEP;

  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1/APP_ZOOM;
  for(let x=startX_grid; x<=maxX; x+=STEP){ctx.beginPath();ctx.moveTo(x,minY);ctx.lineTo(x,maxY);ctx.stroke();}
  for(let y=startY_grid; y<=maxY; y+=STEP){ctx.beginPath();ctx.moveTo(minX,y);ctx.lineTo(maxX,y);ctx.stroke();}
  
  ctx.fillStyle='rgba(255,255,255,.15)';
  for(let x=startX_grid; x<=maxX; x+=STEP)
    for(let y=startY_grid; y<=maxY; y+=STEP)
      {ctx.beginPath();ctx.arc(x,y,1.5/APP_ZOOM,0,Math.PI*2);ctx.fill();}
  
  ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=1.5/APP_ZOOM;
  ctx.beginPath();ctx.moveTo(minX,cy);ctx.lineTo(maxX,cy);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx,minY);ctx.lineTo(cx,maxY);ctx.stroke();
  
  ctx.fillStyle='rgba(255,255,255,.5)'; ctx.font=`bold ${11/APP_ZOOM}px "Space Mono",monospace`;
  ctx.textAlign='center';
  for(let x=startX_grid; x<=maxX; x+=STEP){const v=Math.round((x-cx)/STEP);if(v&&v%2===0)ctx.fillText(v,x,cy+14/APP_ZOOM);}
  ctx.textAlign='right';
  for(let y=startY_grid; y<=maxY; y+=STEP){const v=-Math.round((y-cy)/STEP);if(v&&v%2===0)ctx.fillText(v,cx-4/APP_ZOOM,y+4/APP_ZOOM);}
  ctx.restore();
}

function gShape(ctx, pts, ox, oy, color, fA=.16) {
  ctx.save();
  ctx.beginPath();
  pts.forEach(([x,y],i)=>i===0?ctx.moveTo(ox+x,oy+y):ctx.lineTo(ox+x,oy+y));
  ctx.closePath();
  ctx.fillStyle=rgba(color,fA); ctx.fill();
  ctx.shadowColor=color; ctx.shadowBlur=26;
  ctx.strokeStyle=color; ctx.lineWidth=2.2; ctx.stroke();
  ctx.shadowBlur=8; ctx.lineWidth=1.5; ctx.stroke();
  ctx.restore();
}

function gLabels(ctx, pts, ox, oy, color, suffix='') {
  ctx.save();
  ctx.fillStyle=color;
  ctx.font=`bold ${13.2/APP_ZOOM}px "Space Mono",monospace`;
  
  let scx = 0, scy = 0;
  pts.forEach(([x,y]) => { scx += x; scy += y; });
  if (pts.length) { scx /= pts.length; scy /= pts.length; }

  pts.forEach(([x,y],i)=>{
    ctx.beginPath();ctx.arc(ox+x,oy+y,3.5,0,Math.PI*2);ctx.fill();
    const ang = Math.atan2(y - scy, x - scx);
    const dist = 15;
    const tx = ox + x + Math.cos(ang) * dist;
    const ty = oy + y + Math.sin(ang) * dist;
    ctx.textAlign = Math.cos(ang) > 0.1 ? 'left' : (Math.cos(ang) < -0.1 ? 'right' : 'center');
    ctx.textBaseline = Math.sin(ang) > 0.1 ? 'top' : (Math.sin(ang) < -0.1 ? 'bottom' : 'middle');
    ctx.fillText(String.fromCharCode(65+i)+suffix, tx + Math.cos(ang)*2, ty + Math.sin(ang)*2);
  });
  ctx.restore();
}

function gLine(ctx,x1,y1,x2,y2,color,dash=false,lw=1.5){
  ctx.save();
  ctx.shadowColor=color;ctx.shadowBlur=10;
  ctx.strokeStyle=color;ctx.lineWidth=lw;
  if(dash)ctx.setLineDash([6,4]);
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  ctx.restore();
}

function gArrow(ctx,x1,y1,x2,y2,color){
  gLine(ctx,x1,y1,x2,y2,color,true);
  const a=Math.atan2(y2-y1,x2-x1);
  ctx.save();
  ctx.shadowColor=color;ctx.shadowBlur=10;ctx.fillStyle=color;
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2-11*Math.cos(a-.4),y2-11*Math.sin(a-.4));
  ctx.lineTo(x2-11*Math.cos(a+.4),y2-11*Math.sin(a+.4));
  ctx.closePath();ctx.fill();
  ctx.restore();
}

function gDot(ctx,x,y,color,label=''){
  ctx.save();
  ctx.shadowColor=color;ctx.shadowBlur=16;ctx.fillStyle=color;
  ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.shadowBlur=0;ctx.stroke();
  if(label){
    ctx.fillStyle='rgba(255,255,255,.85)';
    ctx.font=`bold ${11.5/APP_ZOOM}px "Space Mono",monospace`;ctx.textAlign='center';
    ctx.fillText(label,x,y-12/APP_ZOOM);
  }
  ctx.restore();
}

function multiDrag(canvas, targets, onDrag) {
  let active=null, sm, sp, ccx=0, ccy=0;
  const pt=e=>{
    const r=canvas.getBoundingClientRect(),t=e.touches?e.touches[0]:e;
    // Map screen mx, my to unscaled coord space!
    const mx=t.clientX-r.left, my=t.clientY-r.top;
    return [(mx - ccx)/APP_ZOOM + ccx, (my - ccy)/APP_ZOOM + ccy];
  };
  const dn=e=>{
    ccx = canvas.width/2/(window.devicePixelRatio||1);
    ccy = canvas.height/2/(window.devicePixelRatio||1);
    // actually, cx and cy can be derived or passed. To be accurate, we use the middle of canvas
    
    const[mx,my]=pt(e);
    active=targets.find(t=>{const[tx,ty]=t.pos();return Math.hypot(mx-tx,my-ty)<((t.r||24)/APP_ZOOM);})||null;
    if(active){sm=[mx,my];sp=active.pos();if(e.type!=='mousedown') e.preventDefault();}
  };
  const mv=e=>{
    if(!active)return;
    const[mx,my]=pt(e);
    let nx=sp[0]+(mx-sm[0]), ny=sp[1]+(my-sm[1]);
    if(active.bounds) [nx, ny] = active.bounds(nx, ny);
    if(active.snp!==false){nx=snap(nx);ny=snap(ny);}
    if(active.bounds) [nx, ny] = active.bounds(nx, ny);
    active.set([nx,ny]);onDrag();e.preventDefault();
  };
  const up=()=>active=null;
  canvas.addEventListener('mousedown',dn);
  canvas.addEventListener('mousemove',mv);
  canvas.addEventListener('mouseup',up);
  canvas.addEventListener('touchstart',dn,{passive:false});
  canvas.addEventListener('touchmove',mv,{passive:false});
  canvas.addEventListener('touchend',up);
}

function playAnimation(duration, renderFrame, onDone) {
  let t_start = null;
  function eio(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
  function frame(ts) {
    if(!t_start) t_start = ts;
    const frac = Math.min((ts - t_start) / duration, 1);
    renderFrame(eio(frac));
    if(frac < 1) requestAnimationFrame(frame);
    else if(onDone) setTimeout(onDone, 100);
  }
  requestAnimationFrame(frame);
}

function screenToCanvas(sx, sy, cx, cy) {
  return [cx + (sx - cx) / APP_ZOOM, cy + (sy - cy) / APP_ZOOM];
}

function zoomedClampPos(ox, oy, pts, cx, cy, w, h) {
  const x0 = cx - cx / APP_ZOOM;
  const y0 = cy - cy / APP_ZOOM;
  const zw = w / APP_ZOOM;
  const zh = h / APP_ZOOM;
  const b = getBounds(pts, 0, 0);
  const nx = Math.max(x0 - b.l, Math.min(ox, x0 + zw - b.r));
  const ny = Math.max(y0 - b.t, Math.min(oy, y0 + zh - b.b));
  return [nx, ny];
}

function autoFitZoom(allPoints, cx, cy) {
  if(!allPoints || !allPoints.length) return;
  let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
  for(const [px,py] of allPoints) {
    if(px < minX) minX=px; if(px > maxX) maxX=px;
    if(py < minY) minY=py; if(py > maxY) maxY=py;
  }
  const halfW = Math.max(cx - minX, maxX - cx);
  const halfH = Math.max(cy - minY, maxY - cy);
  if(halfW < 1 && halfH < 1) return;
  const z = Math.min(
    halfW > 0 ? cx * 0.85 / halfW : 3,
    halfH > 0 ? cy * 0.85 / halfH : 3
  );
  setAppZoom(Math.min(1.0, Math.max(0.3, z)));
  // No event dispatch — caller's draw() will pick up the new zoom
}

function getTransText(dx, dy) {
   let arr = [];
   if(dx>0) arr.push(`Right ${dx}`); else if(dx<0) arr.push(`Left ${Math.abs(dx)}`);
   if(dy>0) arr.push(`Up ${dy}`); else if(dy<0) arr.push(`Down ${Math.abs(dy)}`);
   return arr.length ? `Translation: ${arr.join(', ')}` : '';
}

/* ── src/js/modules/translation.js ─────────────────────────────── */
function initTranslation() {
  let cData = initCanvas('tCanvas');
  let {canvas,ctx,w,h,cx,cy} = cData;
  let sk='triangle', level=1;
  let preRot = 0;
  let PRE_X=cx, PRE_Y=cy;
  let imgX=Utils.snap(cx+2*Utils.STEP), imgY=Utils.snap(cy-Utils.STEP);
  let tx=0, ty=0;
  let chalL3=null, revealedL3=false;
  let chalL4=null, revealedL4=false;
  let isAnimating = false, animE = 0;
  const COLOR='#00d4ff';
  const LEVEL_NAMES={1:'Explore',2:'Explore',3:'Apply',4:'Challenge'};
  const VEC_COLOR = Utils.rgba(COLOR, 0.3);

  const shape = () => {
    let base = Utils.getShape(sk);
    if (preRot) return base.map(([px,py]) => Utils.rotatePt(px,py, 0,0, preRot));
    return base;
  };

  function draw(){
    drawGrid(ctx,w,h,cx,cy);
    applyZoom(ctx, cx, cy);
    const pts=shape();
    if(level===4){
      gShape(ctx,pts,PRE_X,PRE_Y,'#ffffff');
      gLabels(ctx,pts,PRE_X,PRE_Y,'#ffffff');
      const absPre = pts.map(([px,py])=>[PRE_X+px, PRE_Y+py]);
      if(Utils.el('tCoords4')) Utils.el('tCoords4').innerHTML = formatSideBySide(absPre, revealedL4 ? pts.map(([px,py])=>[PRE_X+chalL4.tx*Utils.STEP+px, PRE_Y-chalL4.ty*Utils.STEP+py]) : null, cx, cy);
      if(isAnimating) {
        const ix=PRE_X+chalL4.tx*Utils.STEP*animE, iy=PRE_Y-chalL4.ty*Utils.STEP*animE;
        gShape(ctx,pts,ix,iy,COLOR);
        gLabels(ctx,pts,ix,iy,COLOR,"'");
      } else if(revealedL4){
        const ix=PRE_X+chalL4.tx*Utils.STEP, iy=PRE_Y-chalL4.ty*Utils.STEP;
        pts.forEach(([px,py])=>{ gArrow(ctx,PRE_X+px,PRE_Y+py,ix+px,iy+py,VEC_COLOR); });
        gShape(ctx,pts,ix,iy,COLOR);
        gLabels(ctx,pts,ix,iy,COLOR,"'");
      }
      resetZoom(ctx);
      return;
    }
    if(level===3){
      const current_tx = Math.round((imgX - PRE_X)/Utils.STEP);
      const current_ty = -Math.round((imgY - PRE_Y)/Utils.STEP);
      if(current_tx || current_ty){
        pts.forEach(([px,py])=>{ gArrow(ctx,PRE_X+px,PRE_Y+py,imgX+px,imgY+py,VEC_COLOR); });
      }
      gShape(ctx,pts,PRE_X,PRE_Y,'#ffffff');
      gLabels(ctx,pts,PRE_X,PRE_Y,'#ffffff');
      gShape(ctx,pts,imgX,imgY,COLOR);
      gLabels(ctx,pts,imgX,imgY,COLOR,"'");
      const absPre = pts.map(([px,py])=>[PRE_X+px, PRE_Y+py]);
      const absImg = pts.map(([px,py])=>[imgX+px, imgY+py]);
      if(Utils.el('tCoords3')) Utils.el('tCoords3').innerHTML = formatSideBySide(absPre, absImg, cx, cy);
      updateTransBox('tTransBox3', getTransText(current_tx, current_ty));
      resetZoom(ctx);
      return;
    }
    if(level===2){
      const ix=PRE_X+tx*Utils.STEP, iy=PRE_Y-ty*Utils.STEP;
      if(tx||ty){
         pts.forEach(([px,py])=>{ gArrow(ctx,PRE_X+px,PRE_Y+py,ix+px,iy+py,VEC_COLOR); });
      }
      gShape(ctx,pts,PRE_X,PRE_Y,'#ffffff');
      gLabels(ctx,pts,PRE_X,PRE_Y,'#ffffff');
      gShape(ctx,pts,ix,iy,COLOR);
      gLabels(ctx,pts,ix,iy,COLOR,"'");
      const absPre = pts.map(([px,py])=>[PRE_X+px, PRE_Y+py]);
      const absImg = pts.map(([px,py])=>[ix+px, iy+py]);
      if(Utils.el('tCoords2')) Utils.el('tCoords2').innerHTML = formatSideBySide(absPre, absImg, cx, cy);
      Utils.set('txV',tx);Utils.set('tyV',ty);
      updateTransBox('tTransBox2', getTransText(tx, ty));
      resetZoom(ctx);
      return;
    }
    const current_tx = Math.round((imgX - PRE_X)/Utils.STEP);
    const current_ty = -Math.round((imgY - PRE_Y)/Utils.STEP);
    if(current_tx||current_ty){
      pts.forEach(([px,py])=>{ gArrow(ctx,PRE_X+px,PRE_Y+py,imgX+px,imgY+py,VEC_COLOR); });
    }
    gShape(ctx,pts,PRE_X,PRE_Y,'#ffffff');
    gLabels(ctx,pts,PRE_X,PRE_Y,'#ffffff');
    gShape(ctx,pts,imgX,imgY,COLOR);
    gLabels(ctx,pts,imgX,imgY,COLOR,"'");
    const absPre = pts.map(([px,py])=>[PRE_X+px, PRE_Y+py]);
    const absImg = pts.map(([px,py])=>[imgX+px, imgY+py]);
    if(Utils.el('tCoords1')) Utils.el('tCoords1').innerHTML = formatSideBySide(absPre, absImg, cx, cy);
    updateTransBox('tTransBox1', getTransText(current_tx, current_ty));
    resetZoom(ctx);
  }

  multiDrag(canvas,[{
    pos:()=>[imgX,imgY],
    set:([x,y])=>{
       if(level===1 || level===3) {
         imgX=Utils.snap(x); imgY=Utils.snap(y);
         if(level < 3) [imgX, imgY] = zoomedClampPos(imgX, imgY, shape(), cx, cy, w, h);
       }
    },
    r:80
  }],draw);

  Utils.el('txS').addEventListener('input',function(){ tx=+this.value; draw();});
  Utils.el('tyS').addEventListener('input',function(){ ty=+this.value; draw();});
  Utils.el('tRst').addEventListener('click',()=>{tx=0;ty=0;Utils.el('txS').value=0;Utils.el('tyS').value=0;draw();});

  function newChallengeL3(){
    preRot = [0, 90, 180, 270][Math.floor(Math.random()*4)];
    PRE_X = cx + (Math.floor(Math.random()*7)-3)*Utils.STEP;
    PRE_Y = cy + (Math.floor(Math.random()*5)-2)*Utils.STEP;
    [PRE_X, PRE_Y] = clampPos(PRE_X, PRE_Y, shape(), w, h);
    imgX = PRE_X; imgY = PRE_Y;
    const s=[-1,1];
    const dx=(Math.floor(Math.random()*4)+1)*s[~~(Math.random()*2)];
    const dy=(Math.floor(Math.random()*3)+1)*s[~~(Math.random()*2)];
    chalL3={tx:dx, ty:dy}; revealedL3=false;
    let dxStr = dx>0 ? `Right ${dx}` : (dx<0 ? `Left ${Math.abs(dx)}` : '');
    let dyStr = dy>0 ? `Up ${dy}` : (dy<0 ? `Down ${Math.abs(dy)}` : '');
    let rText = [dxStr, dyStr].filter(Boolean).join(', ');
    Utils.set('tRule3',`Rule: ${rText}`);
    const r=Utils.el('tRes3'); r.textContent=''; r.className='pres';
    const sb=Utils.el('tShow3'); if(sb) sb.style.display='none';
    const _absPre3 = shape().map(([px,py])=>[PRE_X+px, PRE_Y+py]);
    const _endX3 = PRE_X + chalL3.tx * Utils.STEP, _endY3 = PRE_Y - chalL3.ty * Utils.STEP;
    autoFitZoom([..._absPre3, ..._absPre3.map(([px,py])=>[px-PRE_X+_endX3, py-PRE_Y+_endY3])], cx, cy);
    draw();
  }

  Utils.el('tChk3').addEventListener('click',()=>{
    if(!chalL3)return;
    const current_tx = Math.round((imgX - PRE_X)/Utils.STEP);
    const current_ty = -Math.round((imgY - PRE_Y)/Utils.STEP);
    const r=Utils.el('tRes3');
    const sb=Utils.el('tShow3');
    if(current_tx === chalL3.tx && current_ty === chalL3.ty){
      r.textContent=`🎉 Great job! That's exactly right — try a new one!`; r.className='pres ok';
      if(sb) sb.style.display='none';
    }else{
      r.textContent=`Keep trying — you've got this!`; r.className='pres no';
      if(sb) sb.style.display='inline-flex';
    }
  });

  Utils.el('tShow3').addEventListener('click',()=>{
    if(!chalL3 || revealedL3 || isAnimating) return;
    const startX = imgX, startY = imgY;
    const endX = PRE_X + chalL3.tx * Utils.STEP;
    const endY = PRE_Y - chalL3.ty * Utils.STEP;
    isAnimating = true;

    playAnimation(600, (ease) => {
       imgX = startX + (endX - startX) * ease;
       imgY = startY + (endY - startY) * ease;
       draw();
    }, () => {
       imgX = endX; imgY = endY;
       revealedL3 = true;
       isAnimating = false;
       const r=Utils.el('tRes3');
       r.textContent=`Here's the solution! Try a new one when you're ready.`; r.className='pres ok';
       draw();
    });
  });

  Utils.el('tNew3').addEventListener('click',newChallengeL3);

  function newChallengeL4(){
    preRot = [0, 90, 180, 270][Math.floor(Math.random()*4)];
    PRE_X = cx + (Math.floor(Math.random()*7)-3)*Utils.STEP;
    PRE_Y = cy + (Math.floor(Math.random()*5)-2)*Utils.STEP;
    [PRE_X, PRE_Y] = clampPos(PRE_X, PRE_Y, shape(), w, h);
    imgX = PRE_X; imgY = PRE_Y;
    const pts = shape();
    const s=[-1,1];
    const dx=(Math.floor(Math.random()*4)+1)*s[~~(Math.random()*2)];
    const dy=(Math.floor(Math.random()*3)+1)*s[~~(Math.random()*2)];
    const vIdx = Math.floor(Math.random() * pts.length);
    chalL4={tx:dx, ty:dy, vIdx:vIdx}; revealedL4=false;
    let dxStr = dx>0 ? `Right ${dx}` : (dx<0 ? `Left ${Math.abs(dx)}` : '');
    let dyStr = dy>0 ? `Up ${dy}` : (dy<0 ? `Down ${Math.abs(dy)}` : '');
    let rText = [dxStr, dyStr].filter(Boolean).join(', ');
    Utils.set('tRule4',`Rule: ${rText}`);
    Utils.el('tPX4').value=''; Utils.el('tPY4').value='';
    const vLetter = String.fromCharCode(65 + vIdx);
    Utils.set('tChalQ4', `Where will vertex ${vLetter}' land?`);
    const r=Utils.el('tRes4'); r.textContent=''; r.className='pres';
    const sb=Utils.el('tShow4'); if(sb) sb.style.display='none';
    const _absPre4 = pts.map(([px,py])=>[PRE_X+px, PRE_Y+py]);
    const _endX4 = PRE_X + chalL4.tx * Utils.STEP, _endY4 = PRE_Y - chalL4.ty * Utils.STEP;
    autoFitZoom([..._absPre4, ..._absPre4.map(([px,py])=>[px-PRE_X+_endX4, py-PRE_Y+_endY4])], cx, cy);
    draw();
  }

  Utils.el('tChk4').addEventListener('click',()=>{
    if(!chalL4)return;
    const px=parseInt(Utils.el('tPX4').value),py=parseInt(Utils.el('tPY4').value);
    if(isNaN(px)||isNaN(py))return;
    const pts = shape();
    const [gpx, gpy] = Utils.gc(PRE_X+pts[chalL4.vIdx][0], PRE_Y+pts[chalL4.vIdx][1], cx, cy);
    const ansX = gpx + chalL4.tx, ansY = gpy + chalL4.ty;
    const r=Utils.el('tRes4');
    const sb=Utils.el('tShow4');
    const vLetter = String.fromCharCode(65 + chalL4.vIdx);
    if(px===ansX&&py===ansY){
      revealedL4=true;
      r.textContent=`🎉 Great job! ${vLetter}' is at (${ansX}, ${ansY}) — try a new one!`; r.className='pres ok';
      if(sb) sb.style.display='none';
      draw();
    }else{
      r.textContent=`Keep trying — you've got this!`; r.className='pres no';
      if(sb) sb.style.display='inline-flex';
    }
  });

  Utils.el('tShow4').addEventListener('click',()=>{
    if(!chalL4 || revealedL4 || isAnimating) return;
    isAnimating = true;
    playAnimation(600, (ease) => {
       animE = ease;
       draw();
    }, () => {
       isAnimating = false;
       const pts = shape();
       const [gpx, gpy] = Utils.gc(PRE_X+pts[chalL4.vIdx][0], PRE_Y+pts[chalL4.vIdx][1], cx, cy);
       const ansX = gpx + chalL4.tx, ansY = gpy + chalL4.ty;
       const vLetter = String.fromCharCode(65 + chalL4.vIdx);
       Utils.el('tPX4').value = ansX; Utils.el('tPY4').value = ansY;
       revealedL4 = true;
       const r=Utils.el('tRes4');
       r.textContent=`${vLetter}' lands at (${ansX}, ${ansY}). Try a new one when you're ready!`; r.className='pres ok';
       draw();
    });
  });

  Utils.el('tNew4').addEventListener('click',newChallengeL4);

  document.querySelectorAll('#tSB .sbtn').forEach(b=>b.addEventListener('click',function(){
    document.querySelectorAll('#tSB .sbtn').forEach(x=>x.classList.remove('active'));
    this.classList.add('active');sk=this.dataset.shape;
    if(level===1 || level===2){ [PRE_X, PRE_Y] = clampPos(PRE_X, PRE_Y, shape(), w, h); }
    if(level===3) newChallengeL3();
    if(level===4) newChallengeL4();
    draw();
  }));

  document.querySelectorAll('[data-panel=translation] .lbtn').forEach(b=>b.addEventListener('click',function(){
    document.querySelectorAll('[data-panel=translation] .lbtn').forEach(x=>x.classList.remove('active'));
    this.classList.add('active');
    level=+this.dataset.level;
    document.querySelector('[data-panel=translation]').setAttribute('data-level',level);
    Utils.set('tLN', LEVEL_NAMES[level]||'Explore');
    if(level===1 || level===2){
       preRot = 0; PRE_X = cx; PRE_Y = cy; tx=0; ty=0;
       imgX=Utils.snap(cx+2*Utils.STEP); imgY=Utils.snap(cy-Utils.STEP);
       Utils.el('txS').value=0; Utils.el('tyS').value=0;
    }
    if(level===3) newChallengeL3();
    if(level===4) newChallengeL4();
    draw();
  }));

  attachResize('tCanvas', () => {
    const fresh = initCanvas('tCanvas');
    const dx = fresh.cx - cx, dy = fresh.cy - cy;
    w = fresh.w; h = fresh.h; cx = fresh.cx; cy = fresh.cy;
    PRE_X += dx; PRE_Y += dy;
    imgX += dx; imgY += dy;
    draw();
  });
  draw();
}

/* ── src/js/modules/reflection.js ──────────────────────────────── */
function initReflection() {
  let cData = initCanvas('rfCanvas');
  let {canvas,ctx,w,h,cx,cy} = cData;
  let sk='triangle', level=1;
  let ox=Utils.snap(cx-2*Utils.STEP), oy=Utils.snap(cy-Utils.STEP);
  let ax1={x:cx, y:Utils.snap(cy-3*Utils.STEP)};
  let ax2={x:cx, y:Utils.snap(cy+3*Utils.STEP)};
  const COLOR='#00ff7f';
  const LEVEL_NAMES={1:'Explore',2:'Explore',3:'Apply',4:'Challenge',5:'Rules'};
  let chalRf=null, plotted=[], checkedRf=false;
  let chalRf5=null, checkedRf5=false;
  let isAnimating = false, animE = 0;
  const shape=()=>Utils.getShape(sk);
  const MAPPING_RULES={'y':'(x, y) \u2192 (\u2212x, y)','x':'(x, y) \u2192 (x, \u2212y)','yx':'(x, y) \u2192 (y, x)','ynx':'(x, y) \u2192 (\u2212y, \u2212x)'};

  function reflectPt(px,py){
    const dx=ax2.x-ax1.x,dy=ax2.y-ax1.y,len2=dx*dx+dy*dy;
    if(len2<.01)return[px,py];
    const t=((px-ax1.x)*dx+(py-ax1.y)*dy)/len2;
    return[2*(ax1.x+t*dx)-px, 2*(ax1.y+t*dy)-py];
  }
  function axisEnds(){
    const dx=ax2.x-ax1.x,dy=ax2.y-ax1.y,L=Math.hypot(dx,dy)||1,T=Math.max(w,h)*2;
    return[ax1.x-(dx/L)*T,ax1.y-(dy/L)*T,ax1.x+(dx/L)*T,ax1.y+(dy/L)*T];
  }
  function perpDir(){const dx=ax2.x-ax1.x,dy=ax2.y-ax1.y,L=Math.hypot(dx,dy)||1;return[-dy/L,dx/L];}
  function getAxisLabel(){
    const gx1=Math.round((ax1.x-cx)/Utils.STEP), gy1=-Math.round((ax1.y-cy)/Utils.STEP);
    const gx2=Math.round((ax2.x-cx)/Utils.STEP), gy2=-Math.round((ax2.y-cy)/Utils.STEP);
    if(gx1===gx2) return (gx1===0)?'Across y-axis':`Across x = ${gx1}`;
    if(gy1===gy2) return (gy1===0)?'Across x-axis':`Across y = ${gy1}`;
    const m=(gy2-gy1)/(gx2-gx1), b=gy1-m*gx1;
    if(m===1&&b===0) return 'Across y = x';
    if(m===-1&&b===0) return 'Across y = \u2212x';
    const mStr=Number.isInteger(m)?m.toString():m.toFixed(2);
    const bAbs=Math.abs(b);
    const bStr=Number.isInteger(bAbs)?bAbs.toString():bAbs.toFixed(2);
    if(b===0) return `Across y = ${mStr}x`;
    return `Across y = ${mStr}x ${b>0?'+':'\u2212'} ${bStr}`;
  }
  function drawConnectors(pts,imgAbs){
    ctx.save();
    pts.forEach(([px,py],i)=>{
      const vx=ox+px,vy=oy+py,rx=imgAbs[i][0],ry=imgAbs[i][1];
      const mx=(vx+rx)/2,my=(vy+ry)/2;
      ctx.shadowColor=COLOR;ctx.shadowBlur=7;
      ctx.strokeStyle=Utils.rgba(COLOR,.55);ctx.lineWidth=1;ctx.setLineDash([4,4]);
      ctx.beginPath();ctx.moveTo(vx,vy);ctx.lineTo(mx,my);ctx.stroke();
      ctx.strokeStyle=Utils.rgba('#ffffff',.55);
      ctx.beginPath();ctx.moveTo(mx,my);ctx.lineTo(rx,ry);ctx.stroke();
      const[pd,pk]=perpDir();const TL=5;
      ctx.setLineDash([]);ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=1.5;ctx.shadowBlur=0;
      ctx.beginPath();ctx.moveTo(mx+pd*TL,my+pk*TL);ctx.lineTo(mx-pd*TL,my-pk*TL);ctx.stroke();
    });
    ctx.restore();
  }

  function draw(){
    drawGrid(ctx,w,h,cx,cy);
    applyZoom(ctx, cx, cy);
    const pts=shape();
    const[lx1,ly1,lx2,ly2]=axisEnds();
    ctx.save();
    ctx.shadowColor='#bb55ff';ctx.shadowBlur=14;
    ctx.strokeStyle='#bb55ff';ctx.lineWidth=1.5;ctx.setLineDash([8,5]);
    ctx.beginPath();ctx.moveTo(lx1,ly1);ctx.lineTo(lx2,ly2);ctx.stroke();
    ctx.restore();
    const absPre=pts.map(([px,py])=>[ox+px,oy+py]);
    const imgAbs=absPre.map(([px,py])=>reflectPt(px,py));
    const[rcx,rcy]=reflectPt(ox,oy);
    const imgRel=imgAbs.map(([ix,iy])=>[ix-rcx,iy-rcy]);
    if(level===1){
      drawConnectors(pts,imgAbs);
      gShape(ctx,pts,ox,oy,'#ffffff'); gLabels(ctx,pts,ox,oy,'#ffffff');
      gShape(ctx,imgRel,rcx,rcy,COLOR); gLabels(ctx,imgRel,rcx,rcy,COLOR,"'");
      if(Utils.el('rfCoords1')) Utils.el('rfCoords1').innerHTML=formatSideBySide(absPre,imgAbs,cx,cy);
      updateTransBox('rfTransBox1',`Reflection: ${getAxisLabel()}`);
      resetZoom(ctx);
      return;
    }
    if(level===2){
      gDot(ctx,ax1.x,ax1.y,'#bb55ff'); gDot(ctx,ax2.x,ax2.y,'#bb55ff');
      drawConnectors(pts,imgAbs);
      gShape(ctx,pts,ox,oy,'#ffffff'); gLabels(ctx,pts,ox,oy,'#ffffff');
      gShape(ctx,imgRel,rcx,rcy,COLOR); gLabels(ctx,imgRel,rcx,rcy,COLOR,"'");
      if(Utils.el('rfCoords2')) Utils.el('rfCoords2').innerHTML=formatSideBySide(absPre,imgAbs,cx,cy);
      updateTransBox('rfTransBox2',`Reflection: ${getAxisLabel()}`);
      resetZoom(ctx);
      return;
    }
    if(level===3||level===4){
      const coordsId=`rfCoords${level}`, transBoxId=`rfTransBox${level}`;
      gShape(ctx,pts,ox,oy,'#ffffff'); gLabels(ctx,pts,ox,oy,'#ffffff');
      plotted.forEach(([px,py],i)=>{
        ctx.save();
        ctx.shadowColor=COLOR;ctx.shadowBlur=14;ctx.fillStyle=COLOR;
        ctx.beginPath();ctx.arc(px,py,6,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.shadowBlur=0;ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,.85)';
        ctx.font='bold 10px "Space Mono",monospace';ctx.textAlign='center';
        ctx.fillText(String.fromCharCode(65+i)+"'",px,py-12);
        ctx.restore();
      });
      if(isAnimating) {
        const interpAbs = absPre.map((pt, i) => [pt[0] + (imgAbs[i][0] - pt[0]) * animE, pt[1] + (imgAbs[i][1] - pt[1]) * animE]);
        const rcx = ox + (reflectPt(ox, oy)[0] - ox)*animE, rcy = oy + (reflectPt(ox,oy)[1] - oy)*animE;
        const imgRel = interpAbs.map(([ix,iy])=>[ix-rcx,iy-rcy]);
        gShape(ctx,imgRel,rcx,rcy,COLOR); gLabels(ctx,imgRel,rcx,rcy,COLOR,"'");
      } else if(checkedRf){
        gShape(ctx,imgRel,rcx,rcy,COLOR); gLabels(ctx,imgRel,rcx,rcy,COLOR,"'");
        if(Utils.el(coordsId)) Utils.el(coordsId).innerHTML=formatSideBySide(absPre,imgAbs,cx,cy);
        updateTransBox(transBoxId,`Reflection: ${getAxisLabel()}`);
      } else {
        if(Utils.el(coordsId)) Utils.el(coordsId).innerHTML=formatSideBySide(absPre,null,cx,cy);
        updateTransBox(transBoxId,'');
      }
      resetZoom(ctx);
      return;
    }
    if(level===5){
      gShape(ctx,pts,ox,oy,'#ffffff'); gLabels(ctx,pts,ox,oy,'#ffffff');
      if(isAnimating) {
        const interpAbs = absPre.map((pt, i) => [pt[0] + (imgAbs[i][0] - pt[0]) * animE, pt[1] + (imgAbs[i][1] - pt[1]) * animE]);
        const rcx = ox + (reflectPt(ox, oy)[0] - ox)*animE, rcy = oy + (reflectPt(ox,oy)[1] - oy)*animE;
        const imgRel = interpAbs.map(([ix,iy])=>[ix-rcx,iy-rcy]);
        gShape(ctx,imgRel,rcx,rcy,COLOR); gLabels(ctx,imgRel,rcx,rcy,COLOR,"'");
      } else if(checkedRf5){
        gShape(ctx,imgRel,rcx,rcy,COLOR); gLabels(ctx,imgRel,rcx,rcy,COLOR,"'");
        if(Utils.el('rfCoords5')) Utils.el('rfCoords5').innerHTML=formatSideBySide(absPre,imgAbs,cx,cy);
        updateTransBox('rfTransBox5',`Reflection: ${getAxisLabel()}`);
      } else {
        if(Utils.el('rfCoords5')) Utils.el('rfCoords5').innerHTML=formatSideBySide(absPre,null,cx,cy);
        updateTransBox('rfTransBox5','');
      }
    }
    resetZoom(ctx);
  }

  multiDrag(canvas,[
    {pos:()=>[ax1.x,ax1.y],set:([x,y])=>{if(level===2){ax1.x=Utils.snap(x);ax1.y=Utils.snap(y);}},r:18,snp:true},
    {pos:()=>[ax2.x,ax2.y],set:([x,y])=>{if(level===2){ax2.x=Utils.snap(x);ax2.y=Utils.snap(y);}},r:18,snp:true},
    {pos:()=>[ox,oy],set:([x,y])=>{if(level===1||level===2){ox=Utils.snap(x);oy=Utils.snap(y);}},bounds:(x,y)=>zoomedClampPos(x,y,shape(),cx,cy,w,h),r:75},
  ],draw);

  canvas.addEventListener('click',function(e){
    if(level!==3&&level!==4) return;
    if(checkedRf) return;
    const pts=shape();
    if(plotted.length>=pts.length) return;
    const r=canvas.getBoundingClientRect();
    const [_sx, _sy] = screenToCanvas(e.clientX-r.left, e.clientY-r.top, cx, cy);
    const sx=Utils.snap(_sx), sy=Utils.snap(_sy);
    plotted.push([sx,sy]);
    draw(); updatePlotStatus();
  });
  canvas.addEventListener('contextmenu',function(e){if((level===3||level===4)&&!checkedRf&&plotted.length>0){e.preventDefault(); plotted.pop(); draw(); updatePlotStatus();}});

  function updatePlotStatus(){
    const needed=shape().length;
    const resEl=Utils.el(`rfRes${level}`);
    if(!resEl) return;
    if(plotted.length<needed){resEl.textContent=`${plotted.length} of ${needed} vertices placed. Right-click to undo.`;resEl.className='pres no'; resEl.style.display='block';}
    else {resEl.textContent=`All ${needed} vertices placed — hit Check when ready!`;resEl.className='pres warn'; resEl.style.display='block';}
  }

  document.querySelectorAll('#rfAP .axbtn').forEach(b=>b.addEventListener('click',function(){
    document.querySelectorAll('#rfAP .axbtn').forEach(x=>x.classList.remove('active'));
    this.classList.add('active'); _applyAxisPreset(this.dataset.ax); draw();
  }));
  document.querySelectorAll('#rfAP2 .axbtn').forEach(b=>b.addEventListener('click',function(){
    document.querySelectorAll('#rfAP2 .axbtn').forEach(x=>x.classList.remove('active'));
    this.classList.add('active'); _applyAxisPreset(this.dataset.ax); draw();
  }));

  const resetRf=()=>{
    ox=Utils.snap(cx-2*Utils.STEP); oy=Utils.snap(cy-Utils.STEP);
    ax1={x:cx,y:Utils.snap(cy-3*Utils.STEP)}; ax2={x:cx,y:Utils.snap(cy+3*Utils.STEP)};
    [ox,oy]=clampPos(ox,oy,shape(),w,h);
    ['#rfAP','#rfAP2'].forEach(sel=>{
      document.querySelectorAll(`${sel} .axbtn`).forEach(x=>x.classList.remove('active'));
      const yBtn=document.querySelector(`${sel} .axbtn[data-ax="y"]`);
      if(yBtn) yBtn.classList.add('active');
    });
    draw();
  };
  Utils.el('rfRst').addEventListener('click',resetRf);
  Utils.el('rfRst2').addEventListener('click',resetRf);

  function _applyAxisPreset(axKey){
    const D=3*Utils.STEP;
    switch(axKey){
      case'x':ax1={x:cx-D,y:cy};ax2={x:cx+D,y:cy};break;
      case'yx':ax1={x:cx-D,y:cy+D};ax2={x:cx+D,y:cy-D};break;
      case'ynx':ax1={x:cx-D,y:cy-D};ax2={x:cx+D,y:cy+D};break;
      default:ax1={x:cx,y:cy-D};ax2={x:cx,y:cy+D};break;
    }
  }
  function _applyCandidateAxis(cand){
    const D=3*Utils.STEP;
    if(cand.type==='vert'){const kx=cx+cand.k*Utils.STEP; ax1={x:kx,y:cy-D}; ax2={x:kx,y:cy+D};}
    else if(cand.type==='horiz'){const ky=cy-cand.k*Utils.STEP; ax1={x:cx-D,y:ky}; ax2={x:cx+D,y:ky};}
    else {const x1c=cx-D,x2c=cx+D; ax1={x:x1c,y:cy-(cand.m*(x1c-cx)/Utils.STEP+cand.b)*Utils.STEP}; ax2={x:x2c,y:cy-(cand.m*(x2c-cx)/Utils.STEP+cand.b)*Utils.STEP};}
  }
  function _chalAxisLabel(){
    if(!chalRf) return 'Axis: y-axis';
    if(chalRf.type==='vert') return chalRf.k===0?'Axis: y-axis':`Axis: x = ${chalRf.k}`;
    if(chalRf.type==='horiz') return chalRf.k===0?'Axis: x-axis':`Axis: y = ${chalRf.k}`;
    const m=chalRf.m,b=chalRf.b, mStr=m===1?'':(m===-1?'\u2212':''+m);
    if(b===0) return `Axis: y = ${mStr}x`;
    return `Axis: y = ${mStr}x ${b>0?'+':'\u2212'} ${Math.abs(b)}`;
  }
  function _placePreImage(){
    for(let i=0;i<30;i++){
      let tx=cx+(Math.floor(Math.random()*9)-4)*Utils.STEP;
      let ty=cy+(Math.floor(Math.random()*7)-3)*Utils.STEP;
      const[nx,ny]=clampPos(tx,ty,shape(),w,h); ox=nx; oy=ny;
      const imgAbs=shape().map(([px,py])=>reflectPt(ox+px,oy+py));
      if(imgAbs.every(([px,py])=>px>=0&&px<=w&&py>=0&&py<=h)) return;
    }
    [ox,oy]=clampPos(cx,cy,shape(),w,h);
  }
  function newChallengeL3(){const axKey=['y','x'][Math.floor(Math.random()*2)]; _applyAxisPreset(axKey); _placePreImage(); plotted=[]; checkedRf=false; const r=Utils.el('rfRes3'); r.textContent=''; r.className='pres'; r.style.display='none'; Utils.el('rfShow3').style.display='none'; Utils.set('rfRule3',axKey==='y'?'Axis: y-axis':'Axis: x-axis');
  const _rfPre3=shape().map(([px,py])=>[ox+px,oy+py]); autoFitZoom([..._rfPre3,..._rfPre3.map(([px,py])=>reflectPt(px,py))], cx, cy); draw();}
  function newChallengeL4(){
    const candidates=[];
    for(let k=-4;k<=4;k++) candidates.push({type:'vert',k});
    for(let k=-4;k<=4;k++) candidates.push({type:'horiz',k});
    for(const m of [1,-1]) for(let b=-3;b<=3;b++) candidates.push({type:'slant',m,b});
    for(let i=candidates.length-1;i>0;i--){const j=~~(Math.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
    _placePreImage(); chalRf=null;
    for(const cand of candidates){_applyCandidateAxis(cand); const imgCoords=shape().map(([px,py])=>{const abs=reflectPt(ox+px,oy+py);return Utils.gc(abs[0],abs[1],cx,cy);}); if(imgCoords.every(([x,y])=>Number.isInteger(x)&&Number.isInteger(y))){const[nx,ny]=clampPos(ox,oy,shape(),w,h); if(nx===ox&&ny===oy){chalRf=cand;break;}}}
    if(!chalRf){chalRf={type:'vert',k:0};_applyCandidateAxis(chalRf);}
    plotted=[]; checkedRf=false; const r=Utils.el('rfRes4'); r.textContent=''; r.className='pres'; r.style.display='none'; Utils.el('rfShow4').style.display='none'; Utils.set('rfRule4',_chalAxisLabel());
  const _rfPre4=shape().map(([px,py])=>[ox+px,oy+py]); autoFitZoom([..._rfPre4,..._rfPre4.map(([px,py])=>reflectPt(px,py))], cx, cy); draw();
  }
  function newChallengeL5(){
    const axKeys=['y','x','yx','ynx']; const axKey=axKeys[Math.floor(Math.random()*axKeys.length)]; _applyAxisPreset(axKey); _placePreImage();
    const pts=shape(); const vIdx=Math.floor(Math.random()*pts.length); chalRf5={axKey,vIdx}; checkedRf5=false;
    Utils.el('rfPX5').value=''; Utils.el('rfPY5').value=''; const r=Utils.el('rfRes5'); r.textContent=''; r.className='pres'; r.style.display='none'; Utils.el('rfShow5').style.display='none';
    const axLabel={y:'y-axis',x:'x-axis',yx:'y = x',ynx:'y = \u2212x'}[axKey]; Utils.set('rfRule5',`Axis: ${axLabel}`); Utils.set('rfChalQ5',`Where will vertex ${String.fromCharCode(65+vIdx)}' land?`);
    const absPre=pts.map(([px,py])=>[ox+px,oy+py]); if(Utils.el('rfCoords5')) Utils.el('rfCoords5').innerHTML=formatSideBySide(absPre,null,cx,cy); updateTransBox('rfTransBox5','');
  autoFitZoom([...absPre,...absPre.map(([px,py])=>reflectPt(px,py))], cx, cy); draw();
  }
  function checkReflection(lvl){
    const pts=shape(); const correct=pts.map(([px,py])=>[ox+px,oy+py]).map(([px,py])=>reflectPt(px,py)).map(([px,py])=>[Utils.snap(px),Utils.snap(py)]);
    const r=Utils.el(`rfRes${lvl}`), sb=Utils.el(`rfShow${lvl}`); if(plotted.length<pts.length){r.textContent=`Place all ${pts.length} vertices first.`; r.className='pres no'; r.style.display='block'; return;}
    let allCorrect=true; const used=new Set();
    for(const[px,py] of plotted){let matched=false; for(let i=0;i<correct.length;i++){if(used.has(i)) continue; if(Math.abs(px-correct[i][0])<Utils.STEP*0.5&&Math.abs(py-correct[i][1])<Utils.STEP*0.5){used.add(i);matched=true;break;}} if(!matched){allCorrect=false;break;}}
    if(allCorrect){checkedRf=true; r.textContent='\ud83c\udf89 Great job! That\u2019s the correct reflection \u2014 try a new one!'; r.className='pres ok'; r.style.display='block'; if(sb) sb.style.display='none';}
    else {r.textContent='Keep trying \u2014 you\u2019ve got this!'; r.className='pres no'; r.style.display='block'; if(sb) sb.style.display='inline-flex';}
    draw();
  }
  function showSolution(lvl){
    if (isAnimating || checkedRf) return;
    isAnimating = true;
    playAnimation(600, (ease) => {
       animE = ease;
       draw();
    }, () => {
       isAnimating = false;
       const imgAbs=shape().map(([px,py])=>[ox+px,oy+py]).map(([px,py])=>reflectPt(px,py)); plotted=imgAbs.map(([px,py])=>[Utils.snap(px),Utils.snap(py)]); checkedRf=true; const r=Utils.el(`rfRes${lvl}`); r.textContent='Here\u2019s the solution! Try a new one when you\u2019re ready.'; r.className='pres ok'; r.style.display='block'; Utils.el(`rfShow${lvl}`).style.display='none'; draw();
    });
  }

  Utils.el('rfChk3').addEventListener('click',()=>checkReflection(3)); Utils.el('rfShow3').addEventListener('click',()=>showSolution(3)); Utils.el('rfNew3').addEventListener('click',newChallengeL3);
  Utils.el('rfChk4').addEventListener('click',()=>checkReflection(4)); Utils.el('rfShow4').addEventListener('click',()=>showSolution(4)); Utils.el('rfNew4').addEventListener('click',newChallengeL4);
  Utils.el('rfChk5').addEventListener('click',()=>{
    if(!chalRf5) return; const px=parseInt(Utils.el('rfPX5').value), py=parseInt(Utils.el('rfPY5').value); if(isNaN(px)||isNaN(py)) return;
    const imgAbs=shape().map(([x,y])=>[ox+x,oy+y]).map(([x,y])=>reflectPt(x,y)); const[ansX,ansY]=Utils.gc(imgAbs[chalRf5.vIdx][0],imgAbs[chalRf5.vIdx][1],cx,cy);
    const vLetter=String.fromCharCode(65+chalRf5.vIdx), r=Utils.el('rfRes5'), sb=Utils.el('rfShow5');
    if(px===ansX&&py===ansY){checkedRf5=true; const rule=MAPPING_RULES[chalRf5.axKey]||''; r.innerHTML=`\ud83c\udf89 Great job! ${vLetter}' is at (${ansX}, ${ansY})<br><span style="font-size:.75rem;opacity:.85">Mapping rule: ${rule}</span>`; r.className='pres ok'; r.style.display='block'; if(sb) sb.style.display='none'; draw();}
    else {r.textContent='Keep trying \u2014 you\u2019ve got this!'; r.className='pres no'; r.style.display='block'; if(sb) sb.style.display='inline-flex';}
  });
  Utils.el('rfShow5').addEventListener('click',()=>{
    if(!chalRf5 || isAnimating || checkedRf5) return;
    isAnimating = true;
    playAnimation(600, (ease) => {
      animE = ease; draw();
    }, () => {
      isAnimating = false;
      const imgAbs=shape().map(([x,y])=>[ox+x,oy+y]).map(([x,y])=>reflectPt(x,y)); const[ansX,ansY]=Utils.gc(imgAbs[chalRf5.vIdx][0],imgAbs[chalRf5.vIdx][1],cx,cy);
      const vLetter=String.fromCharCode(65+chalRf5.vIdx); Utils.el('rfPX5').value=ansX; Utils.el('rfPY5').value=ansY; checkedRf5=true; const rule=MAPPING_RULES[chalRf5.axKey]||'';
      const r=Utils.el('rfRes5'); r.innerHTML=`${vLetter}' is at (${ansX}, ${ansY}). Try a new one!<br><span style="font-size:.75rem;opacity:.85">Mapping rule: ${rule}</span>`; r.className='pres ok'; r.style.display='block'; Utils.el('rfShow5').style.display='none'; draw();
    });
  });
  Utils.el('rfNew5').addEventListener('click',newChallengeL5);

  document.querySelectorAll('#rfSB .sbtn').forEach(b=>b.addEventListener('click',function(){document.querySelectorAll('#rfSB .sbtn').forEach(x=>x.classList.remove('active')); this.classList.add('active'); sk=this.dataset.shape; if(level===1||level===2)[ox,oy]=clampPos(ox,oy,shape(),w,h); if(level===3) newChallengeL3(); if(level===4) newChallengeL4(); if(level===5) newChallengeL5(); draw();}));
  document.querySelectorAll('[data-panel=reflection] .lbtn').forEach(b=>b.addEventListener('click',function(){document.querySelectorAll('[data-panel=reflection] .lbtn').forEach(x=>x.classList.remove('active')); this.classList.add('active'); level=+this.dataset.level; document.querySelector('[data-panel=reflection]').setAttribute('data-level',level); Utils.set('rfLN',LEVEL_NAMES[level]||'Explore'); plotted=[]; checkedRf=false; checkedRf5=false; if(level===1||level===2) resetRf(); if(level===3) newChallengeL3(); if(level===4) newChallengeL4(); if(level===5) newChallengeL5(); draw();}));

  attachResize('rfCanvas',()=>{const fresh=initCanvas('rfCanvas'); const dx=fresh.cx-cx, dy=fresh.cy-cy; w=fresh.w; h=fresh.h; cx=fresh.cx; cy=fresh.cy; ox+=dx; oy+=dy; ax1.x+=dx; ax1.y+=dy; ax2.x+=dx; ax2.y+=dy; plotted=plotted.map(([px,py])=>[px+dx,py+dy]); [ox,oy]=clampPos(ox,oy,shape(),w,h); draw();});
  [ox,oy]=clampPos(ox,oy,shape(),w,h); draw();
}

/* ── src/js/modules/rotation.js ────────────────────────────────── */
function initRotation() {
  let cData = initCanvas('roCanvas');
  let {canvas,ctx,w,h,cx,cy} = cData;
  let sk='triangle', level=1;
  let ox=Utils.snap(cx-2*Utils.STEP), oy=Utils.snap(cy+2*Utils.STEP);
  let cxR=cx, cyR=cy;
  let angle=0, arcVtx=0, preRot=0;
  let chalRo3=null, revealedRo3=false, centerPlaced3=false, userAngle3=0;
  let chalRo4=null, revealedRo4=false, centerPlaced4=false, userAngle4=0;
  let chalRo5=null, revealedRo5=false, userAngle5=0, selectedRule5=null;
  let isAnimating = false;
  const COLOR='#ffcc00';
  const LEVEL_NAMES = {1:'Explore',2:'Explore',3:'Apply',4:'Challenge',5:'Rules'};

  // Floating tooltip for blocked slider interactions
  let tipTimer=null;
  const floatTip=document.createElement('div');
  floatTip.style.cssText='position:fixed;background:rgba(10,5,25,.95);border:1px solid rgba(255,100,100,.5);color:#ff8899;padding:5px 12px;border-radius:8px;font-size:.78rem;font-family:"Space Mono",monospace;pointer-events:none;z-index:1000;display:none;white-space:nowrap;box-shadow:0 2px 12px rgba(0,0,0,.5);';
  document.body.appendChild(floatTip);
  function showTip(mx,my,txt){
    floatTip.textContent=txt;
    floatTip.style.left='0px'; floatTip.style.top='0px'; floatTip.style.display='block';
    const tw=floatTip.offsetWidth, th=floatTip.offsetHeight;
    const vw=window.innerWidth, vh=window.innerHeight;
    const x=Math.min(mx+14, vw-tw-8);
    const y=Math.max(8, Math.min(my-32, vh-th-8));
    floatTip.style.left=x+'px'; floatTip.style.top=y+'px';
    clearTimeout(tipTimer); tipTimer=setTimeout(()=>{floatTip.style.display='none';},2000);
  }

  function correctRuleFor(a){const n=((a%360)+360)%360; if(n===90) return '90'; if(n===180) return '180'; if(n===270) return '270'; return '360';}
  const shape=()=>{let base=Utils.getShape(sk); if(preRot) return base.map(([px,py])=>Utils.rotatePt(px,py,0,0,preRot)); return base;};

  function buildVtxBtns(containerId){
    const c=Utils.el(containerId); if(!c) return; c.innerHTML='';
    shape().forEach((_,i)=>{const b=document.createElement('button'); b.className='axbtn'+(i===arcVtx?' active':''); b.textContent=String.fromCharCode(65+i); b.addEventListener('click',()=>{arcVtx=i; rebuildAllVtxBtns(); draw();}); c.appendChild(b);});
  }
  function rebuildAllVtxBtns(){['roVtxBtns1','roVtxBtns2','roVtxBtns3','roVtxBtns4','roVtxBtns5'].forEach(id=>buildVtxBtns(id));}

  // Build the four concrete-coordinate answer buttons for L5
  function buildOptions5(){
    const container=Utils.el('roRuleBtns5');
    if(!container||!chalRo5) return;
    // Use the fixed vertex stored in the challenge (not the arc-display vertex)
    const pts=shape(), vi=Math.min(chalRo5.vIdx, pts.length-1);
    const vLbl=String.fromCharCode(65+vi)+"'";
    const [gx,gy]=Utils.gc(ox+pts[vi][0], oy+pts[vi][1], cx, cy);
    // Correct coordinate formulas matching rotatePt (screen y-down: 90° CW visually)
    // 90°:  (gx,gy)→( gy,−gx)   270°: (gx,gy)→(−gy, gx)
    // 180°: (gx,gy)→(−gx,−gy)   360°: (gx,gy)→( gx, gy)
    const coordsFor={'90':[gy,-gx],'270':[-gy,gx],'180':[-gx,-gy],'360':[gx,gy]};
    const base=[{rule:'90',type:'switch'},{rule:'270',type:'switch'},{rule:'180',type:'keep'},{rule:'360',type:'keep'}];
    // Apply stored shuffle order (set at challenge generation)
    const opts=chalRo5.optOrder.map(i=>{const b=base[i];const[x,y]=coordsFor[b.rule];return{...b,x,y};});
    const correct=correctRuleFor(chalRo5.angle);
    container.innerHTML='';
    opts.forEach(opt=>{
      const b=document.createElement('button');
      let cls='rule-btn';
      if(revealedRo5){if(opt.rule===correct) cls+=' correct';}
      else if(selectedRule5===opt.rule) cls+=' selected';
      b.className=cls; b.dataset.rule=opt.rule;
      const lbl=opt.type==='switch'?'Switch x \u0026 y:':'Keep x \u0026 y:';
      b.innerHTML=`${lbl} <span style="white-space:nowrap">${vLbl}(${opt.x},\u00a0${opt.y})</span>`;
      if(!revealedRo5){b.addEventListener('click',function(){document.querySelectorAll('#roRuleBtns5 .rule-btn').forEach(x=>x.className='rule-btn');this.classList.add('selected');selectedRule5=this.dataset.rule;});}
      container.appendChild(b);
    });
  }

  function drawArc(CC,CR,vx,vy,ang){
    const r=Math.hypot(vx-CC,vy-CR); if(r<1) return;
    const startA=Math.atan2(vy-CR,vx-CC), endA=startA+(ang*Math.PI/180);
    ctx.save(); ctx.shadowColor=Utils.rgba(COLOR,.6); ctx.shadowBlur=10; ctx.strokeStyle=Utils.rgba(COLOR,.55); ctx.lineWidth=2; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.arc(CC,CR,r,startA,endA,ang<0); ctx.stroke();
    const tipA=endA, tipX=CC+r*Math.cos(tipA), tipY=CR+r*Math.sin(tipA), tangentA=ang>=0?tipA+Math.PI/2:tipA-Math.PI/2;
    ctx.setLineDash([]); ctx.fillStyle=Utils.rgba(COLOR,.7); ctx.beginPath(); ctx.moveTo(tipX,tipY); ctx.lineTo(tipX-9*Math.cos(tangentA-.45),tipY-9*Math.sin(tangentA-.45)); ctx.lineTo(tipX-9*Math.cos(tangentA+.45),tipY-9*Math.sin(tangentA+.45)); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function drawArcAndRays(CC,CR,absPre,imgAbs,ang,vi){if(Math.abs(ang)>1) drawArc(CC,CR,absPre[vi][0],absPre[vi][1],ang); gLine(ctx,CC,CR,absPre[vi][0],absPre[vi][1],Utils.rgba('#ffffff',.4),true); gLine(ctx,CC,CR,imgAbs[vi][0],imgAbs[vi][1],Utils.rgba(COLOR,.4),true);}
  function getRotTransText(ang,gcc,gcr){if(ang===0) return ''; return `Rotation: ${ang}° around P(${gcc}, ${gcr})`;}

  function draw(){
    drawGrid(ctx,w,h,cx,cy); const pts=shape();
    applyZoom(ctx, cx, cy);
    if(level===5){
      gDot(ctx,cx,cy,'#bb55ff','P');
      const absPre=pts.map(([px,py])=>[ox+px,oy+py]);
      const imgAbsSlider=absPre.map(([px,py])=>Utils.rotatePt(px,py,cx,cy,userAngle5));
      const vi=Math.min(arcVtx,pts.length-1);
      // Arc + rays based on current slider angle (always visible)
      if(Math.abs(userAngle5)>1) drawArcAndRays(cx,cy,absPre,imgAbsSlider,userAngle5,vi);
      else {gLine(ctx,cx,cy,absPre[vi][0],absPre[vi][1],Utils.rgba('#ffffff',.4),true); gLine(ctx,cx,cy,imgAbsSlider[vi][0],imgAbsSlider[vi][1],Utils.rgba(COLOR,.4),true);}
      // Pre-image always visible
      gShape(ctx,pts,ox,oy,'#ffffff'); gLabels(ctx,pts,ox,oy,'#ffffff');
      // Image hidden until correct answer or Show Me
      if(revealedRo5&&chalRo5){
        const imgAbsRev=absPre.map(([px,py])=>Utils.rotatePt(px,py,cx,cy,chalRo5.angle));
        const[rcx5,rcy5]=Utils.rotatePt(ox,oy,cx,cy,chalRo5.angle);
        const imgRel5=imgAbsRev.map(([px,py])=>[px-rcx5,py-rcy5]);
        gShape(ctx,imgRel5,rcx5,rcy5,COLOR); gLabels(ctx,imgRel5,rcx5,rcy5,COLOR,"'");
        if(Utils.el('roCoords5')) Utils.el('roCoords5').innerHTML=formatSideBySide(absPre,imgAbsRev,cx,cy);
      } else {
        if(Utils.el('roCoords5')) Utils.el('roCoords5').innerHTML=formatSideBySide(absPre,null,cx,cy);
      }
      updateTransBox('roTransBox5',getRotTransText(userAngle5,0,0));
      resetZoom(ctx);
      return;
    }
    if(level===4){
      gShape(ctx,pts,ox,oy,'#ffffff'); gLabels(ctx,pts,ox,oy,'#ffffff');
      if(centerPlaced4){
        gDot(ctx,cxR,cyR,'#bb55ff','P'); const absPre=pts.map(([px,py])=>[ox+px,oy+py]);
        if(revealedRo4&&chalRo4){
          const tCC=cx+chalRo4.cx*Utils.STEP, tCR=cy-chalRo4.cy*Utils.STEP, imgAbsCorrect=absPre.map(([px,py])=>Utils.rotatePt(px,py,tCC,tCR,chalRo4.angle)), [rcxC,rcyC]=Utils.rotatePt(ox,oy,tCC,tCR,chalRo4.angle), imgRelC=imgAbsCorrect.map(([px,py])=>[px-rcxC,py-rcyC]), [ugcx,ugcy]=Utils.gc(cxR,cyR,cx,cy), vi=Math.min(arcVtx,pts.length-1);
          if(ugcx!==chalRo4.cx||ugcy!==chalRo4.cy) gDot(ctx,tCC,tCR,'#00ff7f','P\u2713');
          drawArcAndRays(tCC,tCR,absPre,imgAbsCorrect,chalRo4.angle,vi); gShape(ctx,imgRelC,rcxC,rcyC,COLOR); gLabels(ctx,imgRelC,rcxC,rcyC,COLOR,"'");
          if(Utils.el('roCoords4')) Utils.el('roCoords4').innerHTML=formatSideBySide(absPre,imgAbsCorrect,cx,cy); updateTransBox('roTransBox4',getRotTransText(chalRo4.angle,chalRo4.cx,chalRo4.cy));
        } else if(Math.abs(userAngle4)>0){const imgAbsUser=absPre.map(([px,py])=>Utils.rotatePt(px,py,cxR,cyR,userAngle4)), vi=Math.min(arcVtx,pts.length-1); drawArcAndRays(cxR,cyR,absPre,imgAbsUser,userAngle4,vi); if(Utils.el('roCoords4')) Utils.el('roCoords4').innerHTML=formatSideBySide(absPre,null,cx,cy); updateTransBox('roTransBox4','');}
        else {if(Utils.el('roCoords4')) Utils.el('roCoords4').innerHTML=formatSideBySide(absPre,null,cx,cy); updateTransBox('roTransBox4','');}
      } else {const absPre=pts.map(([px,py])=>[ox+px,oy+py]); if(Utils.el('roCoords4')) Utils.el('roCoords4').innerHTML=formatSideBySide(absPre,null,cx,cy); updateTransBox('roTransBox4','');}
      resetZoom(ctx);
      return;
    }
    if(level===3){
      gShape(ctx,pts,ox,oy,'#ffffff'); gLabels(ctx,pts,ox,oy,'#ffffff');
      if(centerPlaced3){
        gDot(ctx,cxR,cyR,'#bb55ff','P'); const absPre=pts.map(([px,py])=>[ox+px,oy+py]);
        if(revealedRo3&&chalRo3){
          const[ugcx,ugcy]=Utils.gc(cxR,cyR,cx,cy);
          if(ugcx!==chalRo3.gcx||ugcy!==chalRo3.gcy){
            const tCC=cx+chalRo3.gcx*Utils.STEP, tCR=cy-chalRo3.gcy*Utils.STEP; gDot(ctx,tCC,tCR,'#00ff7f','P\u2713');
            const imgAbsReal=absPre.map(([px,py])=>Utils.rotatePt(px,py,tCC,tCR,chalRo3.angle)), [rcxR,rcyR]=Utils.rotatePt(ox,oy,tCC,tCR,chalRo3.angle), imgRelR=imgAbsReal.map(([px,py])=>[px-rcxR,py-rcyR]), vi=Math.min(arcVtx,pts.length-1);
            drawArcAndRays(tCC,tCR,absPre,imgAbsReal,chalRo3.angle,vi); gShape(ctx,imgRelR,rcxR,rcyR,COLOR); gLabels(ctx,imgRelR,rcxR,rcyR,COLOR,"'");
            if(Utils.el('roCoords3')) Utils.el('roCoords3').innerHTML=formatSideBySide(absPre,imgAbsReal,cx,cy);
          } else {
            const imgAbsCorrect=absPre.map(([px,py])=>Utils.rotatePt(px,py,cxR,cyR,chalRo3.angle)), [rcxC,rcyC]=Utils.rotatePt(ox,oy,cxR,cyR,chalRo3.angle), imgRelC=imgAbsCorrect.map(([px,py])=>[px-rcxC,py-rcyC]), vi=Math.min(arcVtx,pts.length-1);
            drawArcAndRays(cxR,cyR,absPre,imgAbsCorrect,chalRo3.angle,vi); gShape(ctx,imgRelC,rcxC,rcyC,COLOR); gLabels(ctx,imgRelC,rcxC,rcyC,COLOR,"'");
            if(Utils.el('roCoords3')) Utils.el('roCoords3').innerHTML=formatSideBySide(absPre,imgAbsCorrect,cx,cy);
          }
          updateTransBox('roTransBox3',getRotTransText(chalRo3.angle,chalRo3.gcx,chalRo3.gcy));
        } else {
          const imgAbsUser=absPre.map(([px,py])=>Utils.rotatePt(px,py,cxR,cyR,userAngle3)), [rcxU,rcyU]=Utils.rotatePt(ox,oy,cxR,cyR,userAngle3), imgRelU=imgAbsUser.map(([px,py])=>[px-rcxU,py-rcyU]), vi=Math.min(arcVtx,pts.length-1);
          if(Math.abs(userAngle3)>0) drawArcAndRays(cxR,cyR,absPre,imgAbsUser,userAngle3,vi);
          gShape(ctx,imgRelU,rcxU,rcyU,COLOR); gLabels(ctx,imgRelU,rcxU,rcyU,COLOR,"'");
          if(Utils.el('roCoords3')) Utils.el('roCoords3').innerHTML=formatSideBySide(absPre,imgAbsUser,cx,cy); const[ugcx,ugcy]=Utils.gc(cxR,cyR,cx,cy); updateTransBox('roTransBox3',getRotTransText(userAngle3,ugcx,ugcy));
        }
      } else {const absPre=pts.map(([px,py])=>[ox+px,oy+py]); if(Utils.el('roCoords3')) Utils.el('roCoords3').innerHTML=formatSideBySide(absPre,null,cx,cy); updateTransBox('roTransBox3','');}
      resetZoom(ctx);
      return;
    }
    const CC=(level===1)?cx:cxR, CR=(level===1)?cy:cyR; gDot(ctx,CC,CR,'#bb55ff','P');
    const absPre=pts.map(([px,py])=>[ox+px,oy+py]), imgAbs=absPre.map(([px,py])=>Utils.rotatePt(px,py,CC,CR,angle)), [rcx,rcy]=Utils.rotatePt(ox,oy,CC,CR,angle), imgRel=imgAbs.map(([px,py])=>[px-rcx,py-rcy]), vi=Math.min(arcVtx,pts.length-1);
    if(Math.abs(angle)>1) drawArc(CC,CR,absPre[vi][0],absPre[vi][1],angle); gLine(ctx,CC,CR,absPre[vi][0],absPre[vi][1],Utils.rgba('#ffffff',.4),true); gLine(ctx,CC,CR,imgAbs[vi][0],imgAbs[vi][1],Utils.rgba(COLOR,.4),true);
    gShape(ctx,pts,ox,oy,'#ffffff'); gLabels(ctx,pts,ox,oy,'#ffffff'); gShape(ctx,imgRel,rcx,rcy,COLOR); gLabels(ctx,imgRel,rcx,rcy,COLOR,"'");
    const[gcc,gcr]=Utils.gc(CC,CR,cx,cy); Utils.set('roV1',`${angle}°`); Utils.set('roV2',`${angle}°`);
    if(Utils.el('roCoords1')) Utils.el('roCoords1').innerHTML=formatSideBySide(absPre,imgAbs,cx,cy); if(Utils.el('roCoords2')) Utils.el('roCoords2').innerHTML=formatSideBySide(absPre,imgAbs,cx,cy); updateTransBox('roTransBox'+level,getRotTransText(angle,gcc,gcr));
    resetZoom(ctx);
  }

  multiDrag(canvas,[{pos:()=>[cxR,cyR],set:([x,y])=>{if(level===2){cxR=Utils.snap(x);cyR=Utils.snap(y);}},r:24,snp:true},{pos:()=>[ox,oy],set:([x,y])=>{if(level===1||level===2){ox=Utils.snap(x);oy=Utils.snap(y);}},bounds:(x,y)=>zoomedClampPos(x,y,shape(),cx,cy,w,h),r:75}],draw);

  canvas.addEventListener('click',function(e){if(level!==3&&level!==4) return; if(level===3&&revealedRo3) return; if(level===4&&revealedRo4) return; const r=canvas.getBoundingClientRect(); const [_crx,_cry]=screenToCanvas(e.clientX-r.left,e.clientY-r.top,cx,cy); cxR=Utils.snap(_crx); cyR=Utils.snap(_cry); if(level===3) centerPlaced3=true; if(level===4) centerPlaced4=true; draw();});

  Utils.el('roS1').addEventListener('input',function(){angle=+this.value; if(Utils.el('roS2'))Utils.el('roS2').value=angle; draw();});
  document.querySelectorAll('.ro-quick').forEach(b=>b.addEventListener('click',function(){angle=+this.dataset.a; Utils.el('roS1').value=angle; if(Utils.el('roS2'))Utils.el('roS2').value=angle; draw();}));
  Utils.el('roRst1').addEventListener('click',()=>{ox=Utils.snap(cx-2*Utils.STEP);oy=Utils.snap(cy+2*Utils.STEP);[ox,oy]=clampPos(ox,oy,shape(),w,h); angle=0; Utils.el('roS1').value=0; if(Utils.el('roS2'))Utils.el('roS2').value=0; draw();});
  Utils.el('roS2').addEventListener('input',function(){angle=+this.value; Utils.el('roS1').value=angle; draw();});
  document.querySelectorAll('.ro-quick2').forEach(b=>b.addEventListener('click',function(){angle=+this.dataset.a; Utils.el('roS1').value=angle; Utils.el('roS2').value=angle; draw();}));
  Utils.el('roRst2').addEventListener('click',()=>{ox=Utils.snap(cx-2*Utils.STEP);oy=Utils.snap(cy+2*Utils.STEP);[ox,oy]=clampPos(ox,oy,shape(),w,h); cxR=cx;cyR=cy; angle=0; Utils.el('roS1').value=0; Utils.el('roS2').value=0; draw();});

  // L3 slider: blocked until CoR is placed
  let sliderPos3={x:0,y:0};
  Utils.el('roS3').addEventListener('pointerdown',function(e){sliderPos3={x:e.clientX,y:e.clientY};});
  Utils.el('roS3').addEventListener('input',function(){
    if(!centerPlaced3){this.value=0; showTip(sliderPos3.x,sliderPos3.y,'Rotations require a center.'); return;}
    userAngle3=+this.value; Utils.set('roV3',`${userAngle3}°`); draw();
  });

  // L4 slider: blocked until CoR is placed
  let sliderPos4={x:0,y:0};
  Utils.el('roS4').addEventListener('pointerdown',function(e){sliderPos4={x:e.clientX,y:e.clientY};});
  Utils.el('roS4').addEventListener('input',function(){
    if(!centerPlaced4){this.value=0; showTip(sliderPos4.x,sliderPos4.y,'Rotations require a center.'); return;}
    userAngle4=+this.value; Utils.set('roV4',`${userAngle4}°`); draw();
  });

  Utils.el('roS5').addEventListener('input',function(){userAngle5=+this.value; Utils.set('roV5',`${userAngle5}°`); draw();});

  function newChallengeL3(){
    preRot=[0,90,180,270][Math.floor(Math.random()*4)]; ox=cx+(Math.floor(Math.random()*7)-3)*Utils.STEP; oy=cy+(Math.floor(Math.random()*5)-2)*Utils.STEP; [ox,oy]=clampPos(ox,oy,shape(),w,h);
    const angles=[90,180,270,-90,-180,-270], chosenAngle=angles[Math.floor(Math.random()*angles.length)]; let targetCX=cx,targetCY=cy;
    for(let a=0;a<50;a++){const tcx=cx+(Math.floor(Math.random()*9)-4)*Utils.STEP,tcy=cy+(Math.floor(Math.random()*7)-3)*Utils.STEP, absPre=shape().map(([px,py])=>[ox+px,oy+py]); if(absPre.map(([px,py])=>Utils.rotatePt(px,py,tcx,tcy,chosenAngle)).every(([px,py])=>px>=Utils.STEP&&px<=w-Utils.STEP&&py>=Utils.STEP&&py<=h-Utils.STEP)){targetCX=tcx;targetCY=tcy;break;}}
    const[gcc,gcr]=Utils.gc(targetCX,targetCY,cx,cy); chalRo3={angle:chosenAngle,gcx:gcc,gcy:gcr,absCX:targetCX,absCY:targetCY}; centerPlaced3=false; userAngle3=0; revealedRo3=false; cxR=cx; cyR=cy; Utils.el('roS3').value=0; Utils.set('roV3','0°');
    Utils.el('roRule3').innerHTML=`Rotate ${chosenAngle}° <span style="white-space:nowrap">around P(${gcc},\u00a0${gcr})</span>`;
    const r=Utils.el('roRes3'); r.textContent=''; r.className='pres'; Utils.el('roShow3').style.display='none';
    const _roPre3=shape().map(([px,py])=>[ox+px,oy+py]);
    autoFitZoom([..._roPre3,..._roPre3.map(([px,py])=>Utils.rotatePt(px,py,targetCX,targetCY,chosenAngle)),[targetCX,targetCY]], cx, cy);
    draw();
  }
  Utils.el('roChk3').addEventListener('click',()=>{
    if(!chalRo3) return; if(!centerPlaced3){const r=Utils.el('roRes3');r.textContent='Click on the graph to place center P first.';r.className='pres warn';return;}
    const[ugcx,ugcy]=Utils.gc(cxR,cyR,cx,cy), centerOK=(ugcx===chalRo3.gcx&&ugcy===chalRo3.gcy), angleOK=(userAngle3===chalRo3.angle), r=Utils.el('roRes3'),sb=Utils.el('roShow3');
    if(centerOK&&angleOK){revealedRo3=true;r.textContent='🎉 Great job! That\'s the correct rotation — try a new one!';r.className='pres ok';sb.style.display='none';}
    else if(!centerOK&&!angleOK){r.textContent='Check both center P and the angle.';r.className='pres no';sb.style.display='inline-flex';} else if(!centerOK){r.textContent='The angle is correct, but check center P!';r.className='pres no';sb.style.display='inline-flex';} else{r.textContent='Center P is correct! Now adjust the angle.';r.className='pres no';sb.style.display='inline-flex';}
    draw();
  });
  Utils.el('roShow3').addEventListener('click',()=>{
    if(!chalRo3 || isAnimating || revealedRo3) return;
    cxR=chalRo3.absCX; cyR=chalRo3.absCY; centerPlaced3=true; 
    const startAng = userAngle3;
    isAnimating = true;
    playAnimation(600, (ease) => {
       userAngle3 = startAng + (chalRo3.angle - startAng) * ease;
       Utils.el('roS3').value=userAngle3; Utils.set('roV3',`${Math.round(userAngle3)}°`);
       draw();
    }, () => {
       isAnimating = false; revealedRo3=true; userAngle3=chalRo3.angle; Utils.el('roS3').value=userAngle3; Utils.set('roV3',`${userAngle3}°`); const r=Utils.el('roRes3');r.textContent='Here\'s the solution! Try a new one when you\'re ready.';r.className='pres ok';Utils.el('roShow3').style.display='none'; draw();
    });
  });
  Utils.el('roNew3').addEventListener('click',newChallengeL3);

  function newChallengeL4(){
    preRot=[0,90,180,270][Math.floor(Math.random()*4)]; ox=cx+(Math.floor(Math.random()*7)-3)*Utils.STEP; oy=cy+(Math.floor(Math.random()*5)-2)*Utils.STEP; [ox,oy]=clampPos(ox,oy,shape(),w,h);
    const angles=[90,180,270,-90,-180,-270], chosenAngle=angles[Math.floor(Math.random()*angles.length)]; let targetCX=cx,targetCY=cy;
    for(let a=0;a<50;a++){const tcx=cx+(Math.floor(Math.random()*9)-4)*Utils.STEP,tcy=cy+(Math.floor(Math.random()*7)-3)*Utils.STEP, absPre=shape().map(([px,py])=>[ox+px,oy+py]); if(absPre.map(([px,py])=>Utils.rotatePt(px,py,tcx,tcy,chosenAngle)).every(([px,py])=>px>=Utils.STEP&&px<=w-Utils.STEP&&py>=Utils.STEP&&py<=h-Utils.STEP)){targetCX=tcx;targetCY=tcy;break;}}
    const[gcc,gcr]=Utils.gc(targetCX,targetCY,cx,cy), vIdx=Math.floor(Math.random()*shape().length); chalRo4={angle:chosenAngle,cx:gcc,cy:gcr,absCX:targetCX,absCY:targetCY,vIdx:vIdx}; centerPlaced4=false; userAngle4=0; revealedRo4=false; cxR=cx; cyR=cy; Utils.el('roS4').value=0; Utils.set('roV4','0°'); Utils.el('roPX4').value=''; Utils.el('roPY4').value='';
    Utils.set('roChalQ4',`Where will vertex ${String.fromCharCode(65+vIdx)}' land?`);
    Utils.el('roRule4').innerHTML=`Rotate ${chosenAngle}° <span style="white-space:nowrap">around P(${gcc},\u00a0${gcr})</span>`;
    const r=Utils.el('roRes4'); r.textContent=''; r.className='pres'; Utils.el('roShow4').style.display='none';
    const _roPre4=shape().map(([px,py])=>[ox+px,oy+py]);
    autoFitZoom([..._roPre4,..._roPre4.map(([px,py])=>Utils.rotatePt(px,py,targetCX,targetCY,chosenAngle)),[targetCX,targetCY]], cx, cy);
    draw();
  }
  Utils.el('roChk4').addEventListener('click',()=>{
    if(!chalRo4) return; if(!centerPlaced4){const r=Utils.el('roRes4');r.textContent='Click on the graph to place center P first.';r.className='pres warn';return;}
    const px=parseInt(Utils.el('roPX4').value),py=parseInt(Utils.el('roPY4').value); if(isNaN(px)||isNaN(py)){const r=Utils.el('roRes4');r.textContent='Enter your predicted coordinates.';r.className='pres warn';return;}
    const[ugcx,ugcy]=Utils.gc(cxR,cyR,cx,cy), centerOK=(ugcx===chalRo4.cx&&ugcy===chalRo4.cy), angleOK=(userAngle4===chalRo4.angle), tCC=chalRo4.absCX,tCR=chalRo4.absCY, absPre=shape().map(([px,py])=>[ox+px,oy+py]), imgAbsCorrect=absPre.map(([px,py])=>Utils.rotatePt(px,py,tCC,tCR,chalRo4.angle)), [ansX,ansY]=Utils.gc(imgAbsCorrect[chalRo4.vIdx][0],imgAbsCorrect[chalRo4.vIdx][1],cx,cy), coordOK=(px===ansX&&py===ansY), vL=String.fromCharCode(65+chalRo4.vIdx), r=Utils.el('roRes4'),sb=Utils.el('roShow4');
    if(centerOK&&angleOK&&coordOK){revealedRo4=true;r.textContent=`🎉 Great job! ${vL}' is at (${ansX}, ${ansY}) — try a new one!`;r.className='pres ok';sb.style.display='none';}
    else {let h=[]; if(!centerOK)h.push('center placement'); if(!angleOK)h.push('angle'); if(!coordOK)h.push('predicted coordinates'); r.textContent=`Check your ${h.join(' and ')} — you've got this!`; r.className='pres no'; sb.style.display='inline-flex';}
    draw();
  });
  Utils.el('roShow4').addEventListener('click',()=>{
    if(!chalRo4 || isAnimating || revealedRo4) return;
    cxR=chalRo4.absCX; cyR=chalRo4.absCY; centerPlaced4=true; 
    const startAng = userAngle4;
    isAnimating = true;
    playAnimation(600, (ease) => {
       userAngle4 = startAng + (chalRo4.angle - startAng) * ease;
       Utils.el('roS4').value=userAngle4; Utils.set('roV4',`${Math.round(userAngle4)}°`); draw();
    }, () => {
       isAnimating = false; revealedRo4=true; userAngle4=chalRo4.angle; Utils.el('roS4').value=userAngle4; Utils.set('roV4',`${userAngle4}°`); const absPre=shape().map(([px,py])=>[ox+px,oy+py]), imgAbsCorrect=absPre.map(([px,py])=>Utils.rotatePt(px,py,cxR,cyR,chalRo4.angle)), [ansX,ansY]=Utils.gc(imgAbsCorrect[chalRo4.vIdx][0],imgAbsCorrect[chalRo4.vIdx][1],cx,cy), vL=String.fromCharCode(65+chalRo4.vIdx); Utils.el('roPX4').value=ansX; Utils.el('roPY4').value=ansY; const r=Utils.el('roRes4'); r.textContent=`${vL}' is at (${ansX}, ${ansY}). Try a new one when you're ready!`; r.className='pres ok'; Utils.el('roShow4').style.display='none'; draw();
    });
  });
  Utils.el('roNew4').addEventListener('click',newChallengeL4);

  function newChallengeL5(){
    preRot=[0,90,180,270][Math.floor(Math.random()*4)]; ox=cx+(Math.floor(Math.random()*7)-3)*Utils.STEP; oy=cy+(Math.floor(Math.random()*5)-2)*Utils.STEP; [ox,oy]=clampPos(ox,oy,shape(),w,h);
    const angles=[90,180,270], chosenAngle=angles[Math.floor(Math.random()*angles.length)];
    const absPre=shape().map(([px,py])=>[ox+px,oy+py]);
    if(!absPre.map(([px,py])=>Utils.rotatePt(px,py,cx,cy,chosenAngle)).every(([px,py])=>px>=0&&px<=w&&py>=0&&py<=h)){ox=cx; oy=Utils.snap(cy+2*Utils.STEP); [ox,oy]=clampPos(ox,oy,shape(),w,h);}
    // Shuffle within type groups once at challenge generation
    const order=[0,1,2,3];
    if(Math.random()>.5){[order[0],order[1]]=[order[1],order[0]];}
    if(Math.random()>.5){[order[2],order[3]]=[order[3],order[2]];}
    const vIdx5=Math.floor(Math.random()*shape().length);
    chalRo5={angle:chosenAngle,optOrder:order,vIdx:vIdx5}; userAngle5=0; revealedRo5=false; selectedRule5=null;
    Utils.el('roS5').value=0; Utils.set('roV5','0°');
    Utils.el('roRule5').innerHTML=`Rotate ${chosenAngle}° <span style="white-space:nowrap">around P(0,\u00a00)</span>`;
    const r=Utils.el('roRes5'); r.textContent=''; r.className='pres'; Utils.el('roShow5').style.display='none';
    autoFitZoom([...absPre,...absPre.map(([px,py])=>Utils.rotatePt(px,py,cx,cy,chosenAngle))], cx, cy);
    buildOptions5(); draw();
  }
  Utils.el('roChk5').addEventListener('click',()=>{
    if(!chalRo5) return;
    if(!selectedRule5){const r=Utils.el('roRes5');r.textContent='Select an answer below.';r.className='pres warn';return;}
    const correct=correctRuleFor(chalRo5.angle), r=Utils.el('roRes5'), sb=Utils.el('roShow5');
    if(selectedRule5===correct){
      revealedRo5=true; buildOptions5();
      r.textContent='🎉 Great job! That\'s the correct result — try a new one!'; r.className='pres ok'; sb.style.display='none'; draw();
    } else {
      document.querySelectorAll('#roRuleBtns5 .rule-btn').forEach(b=>{if(b.classList.contains('selected')) b.className='rule-btn wrong';});
      r.textContent='Not quite — take another look at the graph!'; r.className='pres no'; sb.style.display='inline-flex';
    }
  });
  Utils.el('roShow5').addEventListener('click',()=>{
    if(!chalRo5 || isAnimating || revealedRo5) return; 
    selectedRule5=correctRuleFor(chalRo5.angle);
    isAnimating = true;
    const startAng = userAngle5;
    playAnimation(600, (ease) => {
       userAngle5 = startAng + (chalRo5.angle - startAng) * ease;
       Utils.el('roS5').value=userAngle5; Utils.set('roV5',`${Math.round(userAngle5)}°`); draw();
    }, () => {
       isAnimating = false; revealedRo5=true;
       userAngle5=chalRo5.angle; Utils.el('roS5').value=userAngle5; Utils.set('roV5',`${userAngle5}°`);
       buildOptions5(); const r=Utils.el('roRes5'); r.textContent='Here\'s the solution! Try a new one when you\'re ready.'; r.className='pres ok'; Utils.el('roShow5').style.display='none'; draw();
    });
  });
  Utils.el('roNew5').addEventListener('click',newChallengeL5);

  document.querySelectorAll('#roSB .sbtn').forEach(b=>b.addEventListener('click',function(){document.querySelectorAll('#roSB .sbtn').forEach(x=>x.classList.remove('active')); this.classList.add('active');sk=this.dataset.shape; arcVtx=0; rebuildAllVtxBtns(); if(level===1||level===2){[ox,oy]=clampPos(ox,oy,shape(),w,h);} if(level===3) newChallengeL3(); if(level===4) newChallengeL4(); if(level===5) newChallengeL5(); draw();}));
  document.querySelectorAll('[data-panel=rotation] .lbtn').forEach(b=>b.addEventListener('click',function(){document.querySelectorAll('[data-panel=rotation] .lbtn').forEach(x=>x.classList.remove('active')); this.classList.add('active'); level=+this.dataset.level; document.querySelector('[data-panel=rotation]').setAttribute('data-level',level); Utils.set('roLN', LEVEL_NAMES[level]||'Explore'); preRot=0; angle=0; Utils.el('roS1').value=0; Utils.el('roS2').value=0; if(level===1||level===2){cxR=cx;cyR=cy; ox=Utils.snap(cx-2*Utils.STEP);oy=Utils.snap(cy+2*Utils.STEP);[ox,oy]=clampPos(ox,oy,shape(),w,h);} if(level===3) newChallengeL3(); if(level===4) newChallengeL4(); if(level===5) newChallengeL5(); draw();}));

  attachResize('roCanvas',()=>{const fresh=initCanvas('roCanvas'); const dx=fresh.cx-cx,dy=fresh.cy-cy; w=fresh.w;h=fresh.h;cx=fresh.cx;cy=fresh.cy; ox+=dx;oy+=dy;cxR+=dx;cyR+=dy; [ox,oy]=clampPos(ox,oy,shape(),w,h); draw();});
  rebuildAllVtxBtns(); [ox,oy]=clampPos(ox,oy,shape(),w,h); draw();
}

/* ── src/js/modules/dilation.js ────────────────────────────────── */
function initDilation() {
  let cData = initCanvas('dCanvas');
  let {canvas,ctx,w,h,cx,cy} = cData;
  let sk='triangle', level=1, scale=1;
  let DCX=cx, DCY=cy;
  let ox=Utils.snap(cx+Utils.STEP), oy=Utils.snap(cy-Utils.STEP);
  const COLOR='#ff3355';
  const LEVEL_NAMES={1:'Explore',2:'Explore',3:'Apply',4:'Challenge',5:'Rules'};
  const shape=()=>Utils.getShape(sk);
  const dilPt=(px,py,kx,ky,k)=>[kx+(px-kx)*k, ky+(py-ky)*k];

  // L2 state
  let showDist2=true, selVtx2=0;
  // L3 state
  let chalD3=null, revealedD3=false, centerPlaced3=false, dCX3=cx, dCY3=cy, userScale3=1, userType3=null;
  // L4 state
  let chalD4=null, revealedD4=false;
  // L5 state
  let chalD5=null, revealedD5=false, placedVerts5=[];
  let isAnimating = false, animE = 0;
  let dL5Mode = 'origin';

  // ── Floating tooltip ──
  let tipTimer=null;
  const floatTip=document.createElement('div');
  floatTip.style.cssText='position:fixed;background:rgba(10,5,25,.95);border:1px solid rgba(255,51,85,.5);color:#ff8899;padding:5px 12px;border-radius:8px;font-size:.78rem;font-family:"Space Mono",monospace;pointer-events:none;z-index:1000;display:none;white-space:nowrap;box-shadow:0 2px 12px rgba(0,0,0,.5);';
  document.body.appendChild(floatTip);
  function showTip(mx,my,html){
    floatTip.innerHTML=html;
    floatTip.style.left='0px'; floatTip.style.top='0px'; floatTip.style.display='block';
    const tw=floatTip.offsetWidth, th=floatTip.offsetHeight;
    const vw=window.innerWidth, vh=window.innerHeight;
    floatTip.style.left=Math.min(mx+14,vw-tw-8)+'px';
    floatTip.style.top=Math.max(8,Math.min(my-32,vh-th-8))+'px';
    clearTimeout(tipTimer); tipTimer=setTimeout(()=>{floatTip.style.display='none';},2200);
  }

  // Round a pixel coord to grid value (up to 1 decimal)
  function gcRound(px, origin, flip=false) {
    const raw=(px-origin)/Utils.STEP*(flip?-1:1);
    const r=Math.round(raw*10)/10;
    return Number.isInteger(r)?r:parseFloat(r.toFixed(1));
  }

  // Coord table
  function formatDilCoords(absPre, absImg) {
    let html=`<div class="coord-grid"><div class="coord-col"><div class="ck cpre" style="margin-bottom:2px">Pre-image</div>`;
    if(absPre) absPre.forEach((p,i)=>{
      const gx=gcRound(p[0],cx), gy=gcRound(p[1],cy,true);
      html+=`<div class="cpre">${String.fromCharCode(65+i)}(${gx}, ${gy})</div>`;
    });
    html+=`</div><div class="coord-col"><div class="ck cimg" style="margin-bottom:2px">Image</div>`;
    if(absImg) absImg.forEach((p,i)=>{
      const gx=gcRound(p[0],cx), gy=gcRound(p[1],cy,true);
      html+=`<div class="cimg">${String.fromCharCode(65+i)}'(${gx}, ${gy})</div>`;
    });
    html+=`</div></div>`;
    return html;
  }

  function drawRays(KX,KY,absPts,color,alpha){
    ctx.save();
    ctx.strokeStyle=Utils.rgba(color,alpha); ctx.lineWidth=1.2; ctx.setLineDash([5,4]);
    ctx.shadowColor=color; ctx.shadowBlur=4;
    absPts.forEach(([px,py])=>{ctx.beginPath();ctx.moveTo(KX,KY);ctx.lineTo(px,py);ctx.stroke();});
    ctx.restore();
  }

  // Draw horizontal + vertical component lines from K to a vertex, labeled in grid units.
  // bboxPts: array of [px,py] pixel positions of all visible shape vertices — used to
  // pick which L-corner lies outside the shapes rather than through their interior.
  function drawDistLines(KX, KY, vtxPx, vtxPy, color, bboxPts=[]) {
    if(Math.abs(vtxPx-KX)<2&&Math.abs(vtxPy-KY)<2) return;
    const vGx=gcRound(vtxPx,cx), vGy=gcRound(vtxPy,cy,true);
    const kGx=gcRound(KX,cx);
    const dGx=Math.round(Math.abs(vGx-kGx)*10)/10;
    const dGy=Math.round(Math.abs(vGy-gcRound(KY,cy,true))*10)/10;
    if(dGx===0&&dGy===0) return;

    // Compute combined bounding box of all shape points + K + target vertex
    let bMinX=Infinity,bMaxX=-Infinity,bMinY=Infinity,bMaxY=-Infinity;
    [[KX,KY],[vtxPx,vtxPy],...bboxPts].forEach(([x,y])=>{
      bMinX=Math.min(bMinX,x); bMaxX=Math.max(bMaxX,x);
      bMinY=Math.min(bMinY,y); bMaxY=Math.max(bMaxY,y);
    });
    const bcx=(bMinX+bMaxX)/2, bcy=(bMinY+bMaxY)/2;

    // Two L-corner candidates:
    //  c1 (horizontal-first): corner at (vtxPx, KY)
    //  c2 (vertical-first):   corner at (KX, vtxPy)
    const inBox=(x,y,m=6)=>x>bMinX+m&&x<bMaxX-m&&y>bMinY+m&&y<bMaxY-m;
    const c1In=inBox(vtxPx,KY), c2In=inBox(KX,vtxPy);
    // Prefer the corner that is outside the bbox.
    // Tie-break: pick whichever corner is farther from the bbox centre.
    const d1=Math.hypot(vtxPx-bcx,KY-bcy), d2=Math.hypot(KX-bcx,vtxPy-bcy);
    const horizFirst=(!c1In&&c2In)?true:(c1In&&!c2In)?false:(d1>=d2);

    ctx.save();
    ctx.strokeStyle=Utils.rgba(color,.9); ctx.lineWidth=1.6; ctx.setLineDash([5,3]);
    ctx.fillStyle=color;
    ctx.font=`bold ${9.5/APP_ZOOM}px "Space Mono",monospace`;

    if(horizFirst){
      // K → (vtxPx, KY) → vertex
      if(dGx>0){
        ctx.beginPath(); ctx.moveTo(KX,KY); ctx.lineTo(vtxPx,KY); ctx.stroke();
        ctx.textAlign='center';
        ctx.fillText(String(dGx),(KX+vtxPx)/2,KY+(vtxPy>KY?-8/APP_ZOOM:12/APP_ZOOM));
      }
      if(dGy>0){
        ctx.beginPath(); ctx.moveTo(vtxPx,KY); ctx.lineTo(vtxPx,vtxPy); ctx.stroke();
        ctx.textAlign=vtxPx>=KX?'left':'right';
        ctx.fillText(String(dGy),vtxPx+(vtxPx>=KX?7/APP_ZOOM:-7/APP_ZOOM),(KY+vtxPy)/2);
      }
    } else {
      // K → (KX, vtxPy) → vertex
      if(dGy>0){
        ctx.beginPath(); ctx.moveTo(KX,KY); ctx.lineTo(KX,vtxPy); ctx.stroke();
        ctx.textAlign=vtxPx>=KX?'right':'left';
        ctx.fillText(String(dGy),KX+(vtxPx>=KX?-8/APP_ZOOM:8/APP_ZOOM),(KY+vtxPy)/2);
      }
      if(dGx>0){
        ctx.beginPath(); ctx.moveTo(KX,vtxPy); ctx.lineTo(vtxPx,vtxPy); ctx.stroke();
        ctx.textAlign='center';
        ctx.fillText(String(dGx),(KX+vtxPx)/2,vtxPy+(vtxPy>=KY?12/APP_ZOOM:-8/APP_ZOOM));
      }
    }
    ctx.restore();
  }

  function getDilTransText(k,kgx,kgy){
    return k!==1?`Dilation: \u00d7${k} from K(${kgx}, ${kgy})`:'';
  }

  // ── Build L2 vertex selector buttons ──
  function buildVtxBtns2(){
    const c=Utils.el('dVtxBtns2'); if(!c) return;
    c.innerHTML='';
    shape().forEach((_,i)=>{
      const b=document.createElement('button');
      b.className='rule-btn'+(i===selVtx2?' selected':'');
      b.style.cssText='min-width:34px;padding:4px 9px;font-size:.75rem;';
      b.textContent=String.fromCharCode(65+i);
      b.addEventListener('click',()=>{
        selVtx2=i;
        c.querySelectorAll('.rule-btn').forEach((x,j)=>x.classList.toggle('selected',j===i));
        draw();
      });
      c.appendChild(b);
    });
  }

  // ── Main draw ──
  function draw(){
    drawGrid(ctx,w,h,cx,cy);
    applyZoom(ctx, cx, cy);
    const pts=shape();
    const absPts=pts.map(([px,py])=>[ox+px,oy+py]);

    // ── L5: student places image vertices ──
    if(level===5){
      if(!chalD5){
        gDot(ctx,cx,cy,'#ffffff','K');
        gShape(ctx,pts,ox,oy,'#ffffff'); gLabels(ctx,pts,ox,oy,'#ffffff');
        resetZoom(ctx); return;
      }
      const k=chalD5.scale;
      const KX5=cx+(chalD5.kgx||0)*Utils.STEP, KY5=cy-(chalD5.kgy||0)*Utils.STEP;
      gDot(ctx,KX5,KY5,'#ffffff','K');
      gShape(ctx,pts,ox,oy,'#ffffff'); gLabels(ctx,pts,ox,oy,'#ffffff');
      if(isAnimating) {
        const kScale=1+(k-1)*animE;
        const imgAbs=absPts.map(([px,py])=>dilPt(px,py,KX5,KY5,kScale));
        const[rix,riy]=dilPt(ox,oy,KX5,KY5,kScale);
        const imgRel=imgAbs.map(([px,py])=>[px-rix,py-riy]);
        drawRays(KX5,KY5,imgAbs,'#ffffff',.15);
        gShape(ctx,imgRel,rix,riy,COLOR); gLabels(ctx,imgRel,rix,riy,COLOR,"'");
      } else if(revealedD5){
        const imgAbs=absPts.map(([px,py])=>dilPt(px,py,KX5,KY5,k));
        const[rix,riy]=dilPt(ox,oy,KX5,KY5,k);
        const imgRel=imgAbs.map(([px,py])=>[px-rix,py-riy]);
        drawRays(KX5,KY5,absPts,'#ffffff',.22);
        drawRays(KX5,KY5,imgAbs,'#ffffff',.15);
        gShape(ctx,imgRel,rix,riy,COLOR); gLabels(ctx,imgRel,rix,riy,COLOR,"'");
        if(Utils.el('dCoords5')) Utils.el('dCoords5').innerHTML=formatDilCoords(absPts,imgAbs);
        updateTransBox('dTransBox5',getDilTransText(k,chalD5.kgx||0,chalD5.kgy||0));
      } else {
        if(Utils.el('dCoords5')) Utils.el('dCoords5').innerHTML=formatDilCoords(absPts,null);
        updateTransBox('dTransBox5','');
        if(placedVerts5.length>=2){
          ctx.save();
          ctx.strokeStyle=Utils.rgba(COLOR,.55); ctx.lineWidth=1.5; ctx.setLineDash([]);
          ctx.beginPath();
          placedVerts5.forEach(([px,py],i)=>i===0?ctx.moveTo(px,py):ctx.lineTo(px,py));
          if(placedVerts5.length===pts.length) ctx.closePath();
          ctx.stroke(); ctx.restore();
        }
        placedVerts5.forEach(([px,py],i)=>gDot(ctx,px,py,COLOR,String.fromCharCode(65+i)+"'"));
        const nxt=placedVerts5.length;
        Utils.set('dChalQ5', nxt<pts.length
          ? `Click to place vertex ${String.fromCharCode(65+nxt)}'`
          : 'All vertices placed \u2014 click Check!');
      }
      resetZoom(ctx);
      return;
    }

    // ── L4: K + pre-image shown; image hidden until correct answer ──
    if(level===4){
      gShape(ctx,pts,ox,oy,'#ffffff'); gLabels(ctx,pts,ox,oy,'#ffffff');
      if(chalD4){
        const KX=cx+chalD4.kgx*Utils.STEP, KY=cy-chalD4.kgy*Utils.STEP;
        gDot(ctx,KX,KY,'#ffffff','K');
        drawRays(KX,KY,absPts,'#ffffff',.22);
        const vi=chalD4.vIdx;
        if(isAnimating) {
          const kScale=1+(chalD4.scale-1)*animE;
          const imgAbs=absPts.map(([px,py])=>dilPt(px,py,KX,KY,kScale));
          const[rix,riy]=dilPt(ox,oy,KX,KY,kScale);
          const imgRel=imgAbs.map(([px,py])=>[px-rix,py-riy]);
          drawRays(KX,KY,imgAbs,'#ffffff',.15);
          gShape(ctx,imgRel,rix,riy,COLOR); gLabels(ctx,imgRel,rix,riy,COLOR,"'");
        } else if(revealedD4){
          const imgAbs=absPts.map(([px,py])=>dilPt(px,py,KX,KY,chalD4.scale));
          const[rix,riy]=dilPt(ox,oy,KX,KY,chalD4.scale);
          const imgRel=imgAbs.map(([px,py])=>[px-rix,py-riy]);
          drawRays(KX,KY,imgAbs,'#ffffff',.15);
          gShape(ctx,imgRel,rix,riy,COLOR); gLabels(ctx,imgRel,rix,riy,COLOR,"'");
          // Both pre-image (cyan) and image (yellow) distance lines after reveal
          const bboxAll=[...absPts,...imgAbs];
          drawDistLines(KX,KY,absPts[vi][0],absPts[vi][1],'#ffffff',bboxAll);
          drawDistLines(KX,KY,imgAbs[vi][0],imgAbs[vi][1],COLOR,bboxAll);
          if(Utils.el('dCoords4')) Utils.el('dCoords4').innerHTML=formatDilCoords(absPts,imgAbs);
          updateTransBox('dTransBox4',getDilTransText(chalD4.scale,chalD4.kgx,chalD4.kgy));
        } else {
          // Pre-image vertex distance lines while question is presented
          drawDistLines(KX,KY,absPts[vi][0],absPts[vi][1],'#ffffff',absPts);
          if(Utils.el('dCoords4')) Utils.el('dCoords4').innerHTML=formatDilCoords(absPts,null);
          updateTransBox('dTransBox4','');
        }
      }
      resetZoom(ctx);
      return;
    }

    // ── L3: student plots K, sets scale, classifies ──
    if(level===3){
      gShape(ctx,pts,ox,oy,'#ffffff'); gLabels(ctx,pts,ox,oy,'#ffffff');
      if(centerPlaced3){
        gDot(ctx,dCX3,dCY3,'#ffffff','K');
        const imgAbs=absPts.map(([px,py])=>dilPt(px,py,dCX3,dCY3,userScale3));
        drawRays(dCX3,dCY3,absPts,'#ffffff',.22);
        if(Math.abs(userScale3-1)>0.01) drawRays(dCX3,dCY3,imgAbs,'#ffffff',.15);
        const[rix,riy]=dilPt(ox,oy,dCX3,dCY3,userScale3);
        const imgRel=imgAbs.map(([px,py])=>[px-rix,py-riy]);
        gShape(ctx,imgRel,rix,riy,COLOR); gLabels(ctx,imgRel,rix,riy,COLOR,"'");
        if(Utils.el('dCoords3')) Utils.el('dCoords3').innerHTML=formatDilCoords(absPts,imgAbs);
        updateTransBox('dTransBox3',getDilTransText(userScale3,...Utils.gc(dCX3,dCY3,cx,cy)));
        if(revealedD3&&chalD3){
          const[ucx3,ucy3]=Utils.gc(dCX3,dCY3,cx,cy);
          if(ucx3!==chalD3.kgx||ucy3!==chalD3.kgy){
            const tKX=cx+chalD3.kgx*Utils.STEP, tKY=cy-chalD3.kgy*Utils.STEP;
            gDot(ctx,tKX,tKY,'#00ff7f','K\u2713');
          }
        }
      } else {
        if(Utils.el('dCoords3')) Utils.el('dCoords3').innerHTML=formatDilCoords(absPts,null);
        updateTransBox('dTransBox3','');
      }
      resetZoom(ctx);
      return;
    }

    // ── L1 & L2 ──

    if(Math.abs(scale-1)<0.001){
      gDot(ctx,DCX,DCY,'#ffffff','K');
      gShape(ctx,pts,ox,oy,'#ffffff'); gLabels(ctx,pts,ox,oy,'#ffffff');
      if(level===2&&showDist2){
        const idx=Math.min(selVtx2,pts.length-1);
        drawDistLines(DCX,DCY,absPts[idx][0],absPts[idx][1],'#ffffff',absPts);
      }
      const k=scale.toFixed(1),[gcc,gcr]=Utils.gc(DCX,DCY,cx,cy);
      Utils.set('dV',k); Utils.set('dV2',k); Utils.set('dScale',k); Utils.set('dScale2',k); Utils.set('dCtr1',Utils.gf(gcc,gcr));
      const absPre=pts.map(([px,py])=>[ox+px,oy+py]);
      if(Utils.el('dCoords1')) Utils.el('dCoords1').innerHTML=formatDilCoords(absPre,absPre);
      if(Utils.el('dCoords2')) Utils.el('dCoords2').innerHTML=formatDilCoords(absPre,absPre);
      updateTransBox('dTransBox'+level,'');
      resetZoom(ctx); return;
    }
    const imgAbs=absPts.map(([px,py])=>dilPt(px,py,DCX,DCY,scale));
    const[dicx,dicy]=dilPt(ox,oy,DCX,DCY,scale);
    const imgRel=imgAbs.map(([px,py])=>[px-dicx,py-dicy]);
    gDot(ctx,DCX,DCY,'#ffffff','K');
    drawRays(DCX,DCY,imgAbs,'#ffffff',.22);
    gShape(ctx,imgRel,dicx,dicy,COLOR); gLabels(ctx,imgRel,dicx,dicy,COLOR,"'");
    gShape(ctx,pts,ox,oy,'#ffffff'); gLabels(ctx,pts,ox,oy,'#ffffff');
    if(level===2&&showDist2){
      const idx=Math.min(selVtx2,pts.length-1);
      const bboxAll=[...absPts,...imgAbs];
      drawDistLines(DCX,DCY,absPts[idx][0],absPts[idx][1],'#ffffff',bboxAll);
      drawDistLines(DCX,DCY,imgAbs[idx][0],imgAbs[idx][1],COLOR,bboxAll);
    }
    const k=scale.toFixed(1),[gcc,gcr]=Utils.gc(DCX,DCY,cx,cy);
    Utils.set('dV',k); Utils.set('dV2',k); Utils.set('dScale',k); Utils.set('dScale2',k); Utils.set('dCtr1',Utils.gf(gcc,gcr));
    if(Utils.el('dCoords1')) Utils.el('dCoords1').innerHTML=formatDilCoords(absPts,imgAbs);
    if(Utils.el('dCoords2')) Utils.el('dCoords2').innerHTML=formatDilCoords(absPts,imgAbs);
    updateTransBox('dTransBox'+level,getDilTransText(scale,gcc,gcr));
    resetZoom(ctx);
  }

  // ── multiDrag ──
  multiDrag(canvas,[
    {pos:()=>[DCX,DCY], set:([x,y])=>{if(level===2){DCX=Utils.snap(x);DCY=Utils.snap(y);}}, r:24, snp:true},
    {pos:()=>[ox,oy],   set:([x,y])=>{if(level===1||level===2){ox=Utils.snap(x);oy=Utils.snap(y);}}, bounds:(x,y)=>zoomedClampPos(x,y,shape(),cx,cy,w,h), r:95},
  ],draw);

  // ── Canvas click: L3 place K | L5 place vertex ──
  canvas.addEventListener('click',function(e){
    if(level!==3&&level!==5) return;
    const rect=canvas.getBoundingClientRect();
    const [_kx,_ky]=screenToCanvas(e.clientX-rect.left,e.clientY-rect.top,cx,cy);
    const kx=Utils.snap(_kx), ky=Utils.snap(_ky);
    if(level===3){
      if(revealedD3) return;
      dCX3=kx; dCY3=ky; centerPlaced3=true;
    } else {
      if(!chalD5||revealedD5) return;
      if(placedVerts5.length>=shape().length) return;
      placedVerts5.push([kx,ky]);
    }
    draw();
  });

  // ── Right-click: L5 undo last vertex ──
  canvas.addEventListener('contextmenu',function(e){
    if(level!==5) return;
    e.preventDefault();
    if(!revealedD5&&placedVerts5.length>0){ placedVerts5.pop(); draw(); }
  });

  // ── L1/L2 scale controls ──
  const setScale=k=>{scale=k; Utils.el('dS').value=scale; Utils.el('dS2').value=scale; draw();};
  Utils.el('dS').addEventListener('input',function(){scale=+this.value; Utils.el('dS2').value=scale; draw();});
  Utils.el('dS2').addEventListener('input',function(){scale=+this.value; Utils.el('dS').value=scale; draw();});
  Utils.el('d05').addEventListener('click',()=>setScale(.5));
  Utils.el('d1').addEventListener('click',()=>setScale(1));
  Utils.el('d2').addEventListener('click',()=>setScale(2));
  Utils.el('d3').addEventListener('click',()=>setScale(3));
  const resetD=()=>{ox=Utils.snap(cx+Utils.STEP);oy=Utils.snap(cy-Utils.STEP);if(level===1){DCX=cx;DCY=cy;}setScale(2);[ox,oy]=clampPos(ox,oy,shape(),w,h);draw();};
  Utils.el('dRst').addEventListener('click',resetD);
  Utils.el('dRst2').addEventListener('click',resetD);

  // ── L2 distance toggle + vertex selector ──
  Utils.el('dDistShow2').addEventListener('change',function(){ showDist2=this.checked; draw(); });

  // ── L3 slider – blocked until K placed ──
  let sPos3={x:0,y:0};
  Utils.el('dS3').addEventListener('pointerdown',e=>{sPos3={x:e.clientX,y:e.clientY};});
  Utils.el('dS3').addEventListener('input',function(){
    if(!centerPlaced3){
      this.value=1;
      showTip(sPos3.x,sPos3.y,'Plot <strong style="color:#fff">center K</strong> first.');
      return;
    }
    userScale3=+this.value; Utils.set('dV3',userScale3+'\u00d7'); draw();
  });

  // ── L3 stretch/shrink buttons ──
  function setType3(t){
    userType3=t;
    Utils.el('dStretch3').classList.toggle('selected',t==='stretch');
    Utils.el('dShrink3').classList.toggle('selected',t==='shrink');
  }
  Utils.el('dStretch3').addEventListener('click',()=>setType3('stretch'));
  Utils.el('dShrink3').addEventListener('click',()=>setType3('shrink'));

  // ─── Challenge generators ───

  // General placement: exhaustive search for valid (CoD, pre-image) at scale k
  function findValidChallenge(k){
    const codOff=[-2,-1,1,2], preOff=[-2,-1,0,1,2];
    const margin=Utils.STEP, valid=[];
    for(const kgx of codOff){
      for(const kgy of codOff){
        const KX=cx+kgx*Utils.STEP, KY=cy-kgy*Utils.STEP;
        for(const pgx of preOff){
          for(const pgy of preOff){
            const tOx=cx+pgx*Utils.STEP, tOy=cy-pgy*Utils.STEP;
            const[cOx,cOy]=clampPos(tOx,tOy,shape(),w,h);
            if(Math.abs(cOx-tOx)>1||Math.abs(cOy-tOy)>1) continue;
            const absPts=shape().map(([px,py])=>[tOx+px,tOy+py]);
            const imgAbs=absPts.map(([px,py])=>dilPt(px,py,KX,KY,k));
            // Note: no canvas-bounds check on imgAbs — autoFitZoom handles visibility
            valid.push({kgx,kgy,ox:tOx,oy:tOy});
          }
        }
      }
    }
    if(!valid.length) return null;
    return valid[Math.floor(Math.random()*valid.length)];
  }

  const SCALES=[0.5,1.5,2,2.5,3];
  function pickScaleCombo(){
    const order=[...SCALES].sort(()=>Math.random()-.5);
    for(const k of order){const c=findValidChallenge(k);if(c) return{k,combo:c};}
    return null;
  }

  // L4 specialized: find combo where named vertex has integer, non-zero Δx AND Δy from K
  function findValidChallengeL4(){
    const codOff=[-3,-2,-1,1,2,3], preOff=[-2,-1,0,1,2];
    const valid=[];
    for(const k of SCALES){
      for(const kgx of codOff){
        for(const kgy of codOff){
          const KX=cx+kgx*Utils.STEP, KY=cy-kgy*Utils.STEP;
          for(const pgx of preOff){
            for(const pgy of preOff){
              const tOx=cx+pgx*Utils.STEP, tOy=cy-pgy*Utils.STEP;
              const[cOx,cOy]=clampPos(tOx,tOy,shape(),w,h);
              if(Math.abs(cOx-tOx)>1||Math.abs(cOy-tOy)>1) continue;
              const absPts=shape().map(([px,py])=>[tOx+px,tOy+py]);
              const imgAbs=absPts.map(([px,py])=>dilPt(px,py,KX,KY,k));
              // Note: no canvas-bounds check on imgAbs — autoFitZoom handles visibility
              const goodVtxs=[];
              for(let vi=0;vi<absPts.length;vi++){
                const imgGx=gcRound(imgAbs[vi][0],cx), imgGy=gcRound(imgAbs[vi][1],cy,true);
                const dx=Math.abs(imgGx-kgx), dy=Math.abs(imgGy-kgy);
                if(Number.isInteger(dx)&&Number.isInteger(dy)&&dx>0&&dy>0)
                  goodVtxs.push(vi);
              }
              if(goodVtxs.length>0) valid.push({k,kgx,kgy,ox:tOx,oy:tOy,goodVtxs});
            }
          }
        }
      }
    }
    if(!valid.length) return null;
    const combo=valid[Math.floor(Math.random()*valid.length)];
    const vIdx=combo.goodVtxs[Math.floor(Math.random()*combo.goodVtxs.length)];
    return{k:combo.k,kgx:combo.kgx,kgy:combo.kgy,ox:combo.ox,oy:combo.oy,vIdx};
  }

  // L5 specialized: K at origin, all image coords must be integers, both shapes on canvas
  function findValidChallengeL5(){
    const margin=Utils.STEP, valid=[];
    for(const k of SCALES){
      for(let pgx=-4;pgx<=4;pgx++){
        for(let pgy=-4;pgy<=4;pgy++){
          if(pgx===0&&pgy===0) continue;
          const tOx=cx+pgx*Utils.STEP, tOy=cy-pgy*Utils.STEP;
          const[cOx,cOy]=clampPos(tOx,tOy,shape(),w,h);
          if(Math.abs(cOx-tOx)>1||Math.abs(cOy-tOy)>1) continue;
          const absPts=shape().map(([px,py])=>[tOx+px,tOy+py]);
          if(!absPts.every(([px,py])=>px>=margin&&px<=w-margin&&py>=margin&&py<=h-margin)) continue;
          const imgAbs=absPts.map(([px,py])=>dilPt(px,py,cx,cy,k));
          // Note: no canvas-bounds check — autoFitZoom handles visibility
          // All image vertex grid coords must be integers
          const allInt=imgAbs.every(([px,py])=>{
            const igx=(px-cx)/Utils.STEP, igy=(cy-py)/Utils.STEP;
            return Math.abs(igx-Math.round(igx))<0.001&&Math.abs(igy-Math.round(igy))<0.001;
          });
          if(!allInt) continue;
          valid.push({k,ox:tOx,oy:tOy});
        }
      }
    }
    if(!valid.length) return null;
    return valid[Math.floor(Math.random()*valid.length)];
  }

  // L5 specialized (free K): K at any non-origin grid point, image coords must be integers
  function findValidChallengeL5_free(){
    const valid=[];
    const codOff=[-3,-2,-1,1,2,3];
    for(const k of SCALES){
      for(const kgx of codOff){
        for(const kgy of codOff){
          const KX=cx+kgx*Utils.STEP, KY=cy-kgy*Utils.STEP;
          for(let pgx=-4;pgx<=4;pgx++){
            for(let pgy=-4;pgy<=4;pgy++){
              const tOx=cx+pgx*Utils.STEP, tOy=cy-pgy*Utils.STEP;
              const[cOx,cOy]=clampPos(tOx,tOy,shape(),w,h);
              if(Math.abs(cOx-tOx)>1||Math.abs(cOy-tOy)>1) continue;
              const absPts=shape().map(([px,py])=>[tOx+px,tOy+py]);
              const imgAbs=absPts.map(([px,py])=>dilPt(px,py,KX,KY,k));
              const allInt=imgAbs.every(([px,py])=>{
                const igx=(px-cx)/Utils.STEP, igy=(cy-py)/Utils.STEP;
                return Math.abs(igx-Math.round(igx))<0.001&&Math.abs(igy-Math.round(igy))<0.001;
              });
              if(!allInt) continue;
              valid.push({k,kgx,kgy,ox:tOx,oy:tOy});
            }
          }
        }
      }
    }
    if(!valid.length) return null;
    return valid[Math.floor(Math.random()*valid.length)];
  }

  // ─── L3 ───
  function newChallengeL3(){
    const res=pickScaleCombo();
    if(!res) return;
    const{k,combo}=res;
    ox=combo.ox; oy=combo.oy; [ox,oy]=clampPos(ox,oy,shape(),w,h);
    chalD3={scale:k,kgx:combo.kgx,kgy:combo.kgy};
    centerPlaced3=false; userScale3=1; revealedD3=false; userType3=null;
    dCX3=cx; dCY3=cy;
    Utils.el('dS3').value=1; Utils.set('dV3','1\u00d7');
    Utils.el('dStretch3').classList.remove('selected');
    Utils.el('dShrink3').classList.remove('selected');
    Utils.el('dRule3').innerHTML=`Scale factor ${k} <span style="white-space:nowrap">from K(${combo.kgx},\u00a0${combo.kgy})</span>`;
    const r=Utils.el('dRes3'); r.textContent=''; r.className='pres'; Utils.el('dShow3').style.display='none';
    const _dilKX3=cx+combo.kgx*Utils.STEP, _dilKY3=cy-combo.kgy*Utils.STEP;
    const _dilPre3=shape().map(([px,py])=>[ox+px,oy+py]);
    autoFitZoom([..._dilPre3,..._dilPre3.map(([px,py])=>dilPt(px,py,_dilKX3,_dilKY3,k)),[_dilKX3,_dilKY3]], cx, cy);
    draw();
  }
  Utils.el('dChk3').addEventListener('click',()=>{
    if(!chalD3) return;
    if(!centerPlaced3){
      const r=Utils.el('dRes3');
      r.innerHTML='Click the graph to place <strong style="color:#fff">center K</strong> first.';
      r.className='pres warn'; return;
    }
    if(userType3===null){
      const r=Utils.el('dRes3');
      r.textContent='Choose Stretch or Shrink before checking.';
      r.className='pres warn'; return;
    }
    const[ugx,ugy]=Utils.gc(dCX3,dCY3,cx,cy);
    const centerOK=ugx===chalD3.kgx&&ugy===chalD3.kgy;
    const scaleOK=userScale3===chalD3.scale;
    const typeOK=userType3===(chalD3.scale>1?'stretch':'shrink');
    const r=Utils.el('dRes3'),sb=Utils.el('dShow3');
    if(centerOK&&scaleOK&&typeOK){
      revealedD3=true;
      r.textContent='🎉 Great job! That\'s the correct dilation — try a new one!';
      r.className='pres ok'; sb.style.display='none';
    } else {
      const hints=[];
      if(!typeOK) hints.push('dilation type (Stretch/Shrink)');
      if(!centerOK) hints.push('center K');
      if(!scaleOK) hints.push('scale factor');
      r.textContent=`Check your ${hints.join(' and ')} — keep going!`;
      r.className='pres no'; sb.style.display='inline-flex';
    }
    draw();
  });
  Utils.el('dShow3').addEventListener('click',()=>{
    if(!chalD3 || isAnimating || revealedD3) return;
    dCX3=cx+chalD3.kgx*Utils.STEP; dCY3=cy-chalD3.kgy*Utils.STEP;
    centerPlaced3=true; userScale3=1;
    setType3(chalD3.scale>1?'stretch':'shrink');
    isAnimating = true;
    playAnimation(600, (ease) => {
       userScale3 = 1 + (chalD3.scale - 1) * ease;
       Utils.el('dS3').value = userScale3; Utils.set('dV3', userScale3.toFixed(1)+'\u00d7'); draw();
    }, () => {
       isAnimating = false; revealedD3=true; userScale3=chalD3.scale;
       Utils.el('dS3').value=userScale3; Utils.set('dV3',userScale3+'\u00d7');
       const r=Utils.el('dRes3'); r.textContent='Here\'s the solution! Try a new one when you\'re ready.'; r.className='pres ok'; Utils.el('dShow3').style.display='none'; draw();
    });
  });
  Utils.el('dNew3').addEventListener('click',newChallengeL3);

  // ─── L4 ───
  function newChallengeL4(){
    const res=findValidChallengeL4();
    if(!res) return;
    ox=res.ox; oy=res.oy; [ox,oy]=clampPos(ox,oy,shape(),w,h);
    chalD4={scale:res.k,kgx:res.kgx,kgy:res.kgy,vIdx:res.vIdx}; revealedD4=false;
    Utils.el('dDX4').value=''; Utils.el('dDY4').value='';
    const vL=String.fromCharCode(65+res.vIdx);
    Utils.el('dChalQ4').innerHTML=`Distances from <strong style="color:#fff">K</strong> to vertex <strong style="color:${COLOR}">${vL}'</strong>?`;
    Utils.el('dRule4').innerHTML=`Scale factor ${res.k} <span style="white-space:nowrap">from K(${res.kgx},\u00a0${res.kgy})</span>`;
    const r=Utils.el('dRes4'); r.textContent=''; r.className='pres'; Utils.el('dShow4').style.display='none';
    const _dilKX4=cx+res.kgx*Utils.STEP, _dilKY4=cy-res.kgy*Utils.STEP;
    const _dilPre4=shape().map(([px,py])=>[ox+px,oy+py]);
    autoFitZoom([..._dilPre4,..._dilPre4.map(([px,py])=>dilPt(px,py,_dilKX4,_dilKY4,res.k)),[_dilKX4,_dilKY4]], cx, cy);
    draw();
  }
  Utils.el('dChk4').addEventListener('click',()=>{
    if(!chalD4) return;
    const userDX=parseFloat(Utils.el('dDX4').value), userDY=parseFloat(Utils.el('dDY4').value);
    if(isNaN(userDX)||isNaN(userDY)){
      const r=Utils.el('dRes4'); r.textContent='Enter both horizontal and vertical distances.'; r.className='pres warn'; return;
    }
    const KX=cx+chalD4.kgx*Utils.STEP, KY=cy-chalD4.kgy*Utils.STEP;
    const absPts=shape().map(([px,py])=>[ox+px,oy+py]);
    const vi=chalD4.vIdx;
    const[imgPx,imgPy]=dilPt(absPts[vi][0],absPts[vi][1],KX,KY,chalD4.scale);
    const imgGx=gcRound(imgPx,cx), imgGy=gcRound(imgPy,cy,true);
    const corrDX=Math.abs(imgGx-chalD4.kgx), corrDY=Math.abs(imgGy-chalD4.kgy);
    const dxOK=Math.round(userDX*10)/10===corrDX, dyOK=Math.round(userDY*10)/10===corrDY;
    const vL=String.fromCharCode(65+vi),r=Utils.el('dRes4'),sb=Utils.el('dShow4');
    if(dxOK&&dyOK){
      revealedD4=true;
      r.textContent=`🎉 Correct! |Δx| = ${corrDX}, |Δy| = ${corrDY} — try a new one!`;
      r.className='pres ok'; sb.style.display='none'; draw();
    } else {
      const hints=[];
      if(!dxOK) hints.push('horizontal');
      if(!dyOK) hints.push('vertical');
      r.textContent=`Check your ${hints.join(' and ')} distance${hints.length>1?'s':''} — keep going!`;
      r.className='pres no'; sb.style.display='inline-flex';
    }
  });
  Utils.el('dShow4').addEventListener('click',()=>{
    if(!chalD4 || isAnimating || revealedD4) return;
    const KX=cx+chalD4.kgx*Utils.STEP, KY=cy-chalD4.kgy*Utils.STEP;
    const absPts=shape().map(([px,py])=>[ox+px,oy+py]);
    const vi=chalD4.vIdx;
    const[imgPx,imgPy]=dilPt(absPts[vi][0],absPts[vi][1],KX,KY,chalD4.scale);
    const imgGx=gcRound(imgPx,cx), imgGy=gcRound(imgPy,cy,true);
    const corrDX=Math.abs(imgGx-chalD4.kgx), corrDY=Math.abs(imgGy-chalD4.kgy);
    const vL=String.fromCharCode(65+vi);
    Utils.el('dDX4').value=corrDX; Utils.el('dDY4').value=corrDY;
    isAnimating = true;
    playAnimation(600, (ease) => {
       animE = ease; draw();
    }, () => {
       isAnimating = false; revealedD4=true;
       const r=Utils.el('dRes4'); r.textContent=`|Δx| = ${corrDX}, |Δy| = ${corrDY} from K to ${vL}'. Try a new one!`; r.className='pres ok'; Utils.el('dShow4').style.display='none'; draw();
    });
  });
  Utils.el('dNew4').addEventListener('click',newChallengeL4);

  // ─── L5 ───
  function newChallengeL5(){
    const res = dL5Mode==='free' ? findValidChallengeL5_free() : findValidChallengeL5();
    if(!res) return;
    ox=res.ox; oy=res.oy; [ox,oy]=clampPos(ox,oy,shape(),w,h);
    const kgx=res.kgx||0, kgy=res.kgy||0;
    chalD5={scale:res.k, kgx, kgy}; revealedD5=false; placedVerts5=[];
    const kLabel = kgx===0&&kgy===0 ? 'K(0,\u00a00)' : `K(${kgx},\u00a0${kgy})`;
    Utils.el('dRule5').innerHTML=`Scale factor ${res.k} <span style="white-space:nowrap">from ${kLabel}</span>`;
    Utils.set('dChalQ5', `Click to place vertex A'`);
    const r=Utils.el('dRes5'); r.textContent=''; r.className='pres'; Utils.el('dShow5').style.display='none';
    const KX5=cx+kgx*Utils.STEP, KY5=cy-kgy*Utils.STEP;
    const _dilPre5=shape().map(([px,py])=>[ox+px,oy+py]);
    autoFitZoom([..._dilPre5,..._dilPre5.map(([px,py])=>dilPt(px,py,KX5,KY5,res.k)),[KX5,KY5]], cx, cy);
    draw();
  }
  Utils.el('dChk5').addEventListener('click',()=>{
    if(!chalD5) return;
    const pts=shape();
    if(placedVerts5.length<pts.length){
      const r=Utils.el('dRes5');
      r.textContent=`Place all ${pts.length} vertices first.`;
      r.className='pres warn'; return;
    }
    const absPts=pts.map(([p,q])=>[ox+p,oy+q]);
    const KX5c=cx+(chalD5.kgx||0)*Utils.STEP, KY5c=cy-(chalD5.kgy||0)*Utils.STEP;
    let allOK=true;
    for(let vi=0;vi<pts.length;vi++){
      const[ipx,ipy]=dilPt(absPts[vi][0],absPts[vi][1],KX5c,KY5c,chalD5.scale);
      const ansGx=Math.round((ipx-cx)/Utils.STEP), ansGy=Math.round((cy-ipy)/Utils.STEP);
      const[pgx,pgy]=Utils.gc(placedVerts5[vi][0],placedVerts5[vi][1],cx,cy);
      if(pgx!==ansGx||pgy!==ansGy){allOK=false;break;}
    }
    const r=Utils.el('dRes5'),sb=Utils.el('dShow5');
    if(allOK){
      revealedD5=true;
      r.textContent='🎉 Excellent! You\'ve found the image — try a new one!';
      r.className='pres ok'; sb.style.display='none'; draw();
    } else {
      r.textContent='Not quite — check your vertex placements and try again.';
      r.className='pres no'; sb.style.display='inline-flex';
    }
  });
  Utils.el('dShow5').addEventListener('click',()=>{
    if(!chalD5 || isAnimating || revealedD5) return;
    isAnimating = true;
    playAnimation(600, (ease) => {
      animE = ease; draw();
    }, () => {
      isAnimating = false; revealedD5=true;
      const r=Utils.el('dRes5');
      r.textContent='Here\'s the correct image! Try a new one when you\'re ready.';
      r.className='pres ok'; Utils.el('dShow5').style.display='none'; draw();
    });
  });
  Utils.el('dNew5').addEventListener('click',newChallengeL5);

  // ── L5 question-type selector ──
  document.querySelectorAll('#dL5TypeBtns .rule-btn').forEach(b=>b.addEventListener('click',function(){
    document.querySelectorAll('#dL5TypeBtns .rule-btn').forEach(x=>x.classList.remove('selected'));
    this.classList.add('selected');
    dL5Mode=this.dataset.mode;
    newChallengeL5();
  }));

  // ── Shape selector ──
  document.querySelectorAll('#dSB .sbtn').forEach(b=>b.addEventListener('click',function(){
    document.querySelectorAll('#dSB .sbtn').forEach(x=>x.classList.remove('active'));
    this.classList.add('active'); sk=this.dataset.shape;
    selVtx2=0; [ox,oy]=clampPos(ox,oy,shape(),w,h);
    if(level===2) buildVtxBtns2();
    if(level===3) newChallengeL3();
    if(level===4) newChallengeL4();
    if(level===5) newChallengeL5();
    draw();
  }));

  // ── Level selector ──
  document.querySelectorAll('[data-panel=dilation] .lbtn').forEach(b=>b.addEventListener('click',function(){
    document.querySelectorAll('[data-panel=dilation] .lbtn').forEach(x=>x.classList.remove('active'));
    this.classList.add('active'); level=+this.dataset.level;
    document.querySelector('[data-panel=dilation]').setAttribute('data-level',level);
    Utils.set('dLN',LEVEL_NAMES[level]||'Explore');
    if(level===1){DCX=cx;DCY=cy;}
    if(level===2){selVtx2=0; buildVtxBtns2();}
    if(level===3) newChallengeL3();
    if(level===4) newChallengeL4();
    if(level===5) newChallengeL5();
    draw();
  }));

  attachResize('dCanvas',()=>{
    const fresh=initCanvas('dCanvas'); const dx=fresh.cx-cx, dy=fresh.cy-cy;
    w=fresh.w; h=fresh.h; cx=fresh.cx; cy=fresh.cy;
    ox+=dx; oy+=dy;
    if(level===1){DCX=cx;DCY=cy;} else{DCX+=dx;DCY+=dy;}
    dCX3+=dx; dCY3+=dy;
    placedVerts5=[];
    [ox,oy]=clampPos(ox,oy,shape(),w,h); draw();
  });

  buildVtxBtns2();
  [ox,oy]=clampPos(ox,oy,shape(),w,h); draw();
}

/* ── src/js/modules/challenge.js ───────────────────────────────── */
// ══════════════════════════════════════════════════
// CHALLENGE MODE - OVERHAUL
// ══════════════════════════════════════════════════







function initChallenge() {
  let { canvas, ctx, w, h, cx, cy } = initCanvas('chCanvas');

  let level = 1;
  let chainLength = 2;
  let sk = 'triangle';

  let chalCh = null; 
  let currentStep = 0; 
  
  let userShapes = []; 
  let currentUserPts = []; 
  let currentUserAux = []; 
  let transDragOffset = [0, 0]; 
  
  let isDragging = false;
  let draggedPointIndex = -1; // -1: none, 0+: pts, -100: aux[0], -101: aux[1]
  
  let mouseX = 0, mouseY = 0;

  let animating = false;
  let animFrameId = null;
  let isLevel4Done = false; 

  const LEVEL_NAMES = { 1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Evil' };
  const PRIMES = ["", "'", "''", "'''", "''''"];

  const getTypeColor = type => ({
    'translation': '#00d4ff',
    'reflection': '#00ff7f',
    'rotation': '#ffcc00',
    'dilation': '#ff3355'
  })[type] || '#fff';

  // ── Transformation Math ──────────────────────────
  const translatePt  = (px, py, tx, ty) => [px + tx * Utils.STEP, py - ty * Utils.STEP];
  const dilPt        = (px, py, kx, ky, k) => [kx + (px - kx) * k, ky + (py - ky) * k];
  const reflectPt = (px, py, ax1, ax2) => {
    const dx = ax2.x - ax1.x, dy = ax2.y - ax1.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 0.01) return [px, py];
    const t = ((px - ax1.x) * dx + (py - ax1.y) * dy) / len2;
    return [2 * (ax1.x + t * dx) - px, 2 * (ax1.y + t * dy) - py];
  };

  function axisEndpoints(axKey) {
    const D = 5 * Utils.STEP;
    switch (axKey) {
      case 'x':   return [{ x: cx - D, y: cy },    { x: cx + D, y: cy }];
      case 'yx':  return [{ x: cx - D, y: cy + D }, { x: cx + D, y: cy - D }];
      case 'ynx': return [{ x: cx - D, y: cy - D }, { x: cx + D, y: cy + D }];
      default:    return [{ x: cx,     y: cy - D }, { x: cx,     y: cy + D }]; 
    }
  }

  function applyTransform(pts, t) {
    switch (t.type) {
      case 'translation': return pts.map(([px, py]) => translatePt(px, py, t.params.tx, t.params.ty));
      case 'reflection': {
        const [a1, a2] = axisEndpoints(t.params.axKey);
        return pts.map(([px, py]) => reflectPt(px, py, a1, a2));
      }
      case 'rotation': {
        const rcx = cx + t.params.gcx * Utils.STEP, rcy = cy - t.params.gcy * Utils.STEP;
        return pts.map(([px, py]) => Utils.rotatePt(px, py, rcx, rcy, -t.params.angle));
      }
      case 'dilation': {
        const kx = cx + t.params.kgx * Utils.STEP, ky = cy - t.params.kgy * Utils.STEP;
        return pts.map(([px, py]) => dilPt(px, py, kx, ky, t.params.scale));
      }
      default: return pts;
    }
  }

  function isPointInPolygon(point, vs) {
    let x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i][0], yi = vs[i][1];
        let xj = vs[j][0], yj = vs[j][1];
        let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
  }

  // ── Generation ─────────────────────────
  function shuffle(arr) {
    const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a;
  }
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const ri = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  function randomParams(type) {
    switch (type) {
      case 'translation': return { tx: pick([-4,-3,-2,-1,1,2,3,4]), ty: pick([-3,-2,-1,1,2,3]) };
      case 'reflection': return { axKey: pick(['y', 'x', 'yx', 'ynx']) };
      case 'rotation': return { angle: pick([90, 180, 270, -90, -180, -270]), gcx: ri(-3,3), gcy: ri(-3,3) };
      case 'dilation': {
        let kgx = ri(-2, 2), kgy = ri(-2, 2);
        if (kgx === 0 && kgy === 0) kgx = 1;
        return { scale: pick([0.5, 1.5, 2, 2.5]), kgx, kgy };
      }
    }
  }

  function allInBounds(shapes) {
    for (const pts of shapes)
      for (const [px, py] of pts)
        if (px < Utils.STEP || px > w - Utils.STEP || py < Utils.STEP || py > h - Utils.STEP) return false;
    return true;
  }

  function newChallenge() {
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    animating = false;
    const relPts = Utils.getShape(sk);

    for (let attempt = 0; attempt < 80; attempt++) {
      let ox = cx + ri(-3, 3) * Utils.STEP, oy = cy + ri(-3, 3) * Utils.STEP;
      [ox, oy] = clampPos(ox, oy, relPts, w, h);
      const startPts = relPts.map(([px, py]) => [ox + px, oy + py]);
      
      const types = shuffle(['translation', 'reflection', 'rotation', 'dilation']).slice(0, chainLength);
      const transformations = types.map(type => ({ type, params: randomParams(type) }));

      const shapes = [startPts];
      for (let i = 0; i < transformations.length; i++) {
        shapes.push(applyTransform(shapes[i], transformations[i]));
      }
      if (!allInBounds(shapes)) continue;

      chalCh = { transformations, shapes, relPts };
      resetUserProgress();
      return;
    }
    console.warn('Challenge generation failed after 80 attempts');
  }

  function resetUserProgress() {
    if(!chalCh) return;
    userShapes = [ chalCh.shapes[0].map(p => [...p]) ]; 
    currentStep = 0;
    currentUserPts = [];
    currentUserAux = [];
    transDragOffset = [0, 0];
    isLevel4Done = false;
    isDragging = false;
    draggedPointIndex = -1;
    hideTooltip();
    clearResult();
    Utils.el('chChkBtn').style.display = 'none';
    updateUI();
    draw();
  }

  // ── Labels & Text ────────────────────
  function axisLabel(axKey) { return { y: 'y-axis', x: 'x-axis', yx: 'y = x', ynx: 'y = −x' }[axKey] || axKey; }
  function transLabel(t) {
    switch (t.type) {
      case 'translation': {
        const { tx, ty } = t.params;
        const p = [];
        if (tx > 0) p.push(`Right ${tx}`); else if (tx < 0) p.push(`Left ${Math.abs(tx)}`);
        if (ty > 0) p.push(`Up ${ty}`); else if (ty < 0) p.push(`Down ${Math.abs(ty)}`);
        return `Translate ${p.join(', ')}`;
      }
      case 'reflection': return `Reflect across ${axisLabel(t.params.axKey)}`;
      case 'rotation': return `Rotate ${Math.abs(t.params.angle)}° ${t.params.angle > 0 ? 'CCW' : 'CW'} around <span style="white-space:nowrap">P(${t.params.gcx}, ${t.params.gcy})</span>`;
      case 'dilation': return `Dilate ×${t.params.scale} from <span style="white-space:nowrap">K(${t.params.kgx}, ${t.params.kgy})</span>`;
      default: return t.type;
    }
  }

  // ── UI Updates ───────────────────────────────────
  function updateUI() {
    if (!chalCh) return;
    
    // Chains
    let html = '';
    for(let i=0; i<chainLength; i++) {
      const t = chalCh.transformations[i];
      const color = getTypeColor(t.type);
      const isActive = i === currentStep;
      
      let style = `border-color:${color};color:${color};opacity:${isActive ? 1 : 0.4};`;
      if (isActive && level < 4) {
        style += `box-shadow: 0 0 10px ${Utils.rgba(color, 0.4)};`;
      }
      if(isLevel4Done && i === chainLength - 1) style = `border-color:${color};color:${color};opacity:1;`;

      html += `<div class="chain-step" style="${style}">Step ${i + 1}: ${transLabel(t)}</div>`;
    }
    Utils.el('chRule').innerHTML = html;

    // Instructions
    let inst = "Chain Complete!";
    Utils.el('chChkBtn').style.display = 'none';

    if (currentStep < chainLength) {
      const t = chalCh.transformations[currentStep];
      const nv = chalCh.relPts.length;
      if (t.type === 'translation') {
        inst = "Drag the shape to its new translated position.";
      } else if (t.type === 'reflection') {
        if(currentUserAux.length < 2) inst = `Plot 2 points for the axis of symmetry (${currentUserAux.length}/2).`;
        else inst = `Plot the ${nv} image vertices (${currentUserPts.length}/${nv}).`;
      } else if (t.type === 'rotation') {
        if(currentUserAux.length < 1) inst = `Plot the center of rotation.`;
        else inst = `Plot the ${nv} image vertices (${currentUserPts.length}/${nv}).`;
      } else if (t.type === 'dilation') {
        if(currentUserAux.length < 1) inst = `Plot the center of dilation.`;
        else inst = `Plot the ${nv} image vertices (${currentUserPts.length}/${nv}).`;
      }
    } else if (!isLevel4Done) {
      inst = "Sequence Plotted! Check to verify your chain.";
    }

    if(level === 3 && currentStep > 0 && !isLevel4Done) {
      Utils.el('chChkBtn').style.display = 'inline-block';
      Utils.el('chChkBtn').textContent = "✓ Check Step";
    } else if(level === 4 && currentStep === chainLength && !isLevel4Done) {
      Utils.el('chChkBtn').style.display = 'inline-block';
      Utils.el('chChkBtn').textContent = "✓ Check Transformation";
    }
    
    Utils.el('chInstContext').textContent = inst;
    Utils.el('chCoords').innerHTML = formatSideBySide(userShapes[0], currentStep < chainLength ? null : userShapes[chainLength], cx, cy);
  }

  const clearResult = () => { const e = Utils.el('chRes'); if (e) { e.className = 'pres'; e.textContent = ''; } };
  const hideTooltip = () => { const t = Utils.el('chTooltip'); if(t) t.style.display = 'none'; };
  const showTooltip = (msg, ok) => {
    if(level !== 2) return; 
    const t = Utils.el('chTooltip');
    if(!t) return;
    t.textContent = msg;
    t.className = 'canvas-tooltip ' + (ok ? 'ok' : 'no');
    t.style.display = 'block';
    
    const rect = canvas.getBoundingClientRect();
    t.style.left = (rect.left + cx - 40) + 'px';
    t.style.top = (rect.top + cy - 40) + 'px';
  };

  // ── Drawing ──────────────────────────────────────
  const drawAbs = (absPts, color, suffix = '', fA = 0.16) => {
    gShape(ctx, absPts, 0, 0, color, fA);
    gLabels(ctx, absPts, 0, 0, color, suffix);
  };

  function getExpectedAux() {
    const t = chalCh.transformations[currentStep];
    if(t.type === 'reflection') return axisEndpoints(t.params.axKey);
    else if(t.type === 'rotation') return [[cx + t.params.gcx * Utils.STEP, cy - t.params.gcy * Utils.STEP]];
    else if(t.type === 'dilation') return [[cx + t.params.kgx * Utils.STEP, cy - t.params.kgy * Utils.STEP]];
    return [];
  }

  function drawArrowArc(ctx, cx, cy, radius, startA, endA, color) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    
    let isCCW = true;
    let diff = endA - startA;
    // Normalize to -PI to PI
    while(diff <= -Math.PI) diff += Math.PI * 2;
    while(diff > Math.PI) diff -= Math.PI * 2;
    if(diff < 0) isCCW = false;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startA, endA, !isCCW);
    ctx.stroke();

    // arrowhead
    const arrowLen = 8;
    const arrowAng = 0.5; // radians spread
    const endX = cx + radius * Math.cos(endA);
    const endY = cy + radius * Math.sin(endA);
    const tangent = endA + (isCCW ? Math.PI/2 : -Math.PI/2);
    
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - arrowLen * Math.cos(tangent - arrowAng), endY - arrowLen * Math.sin(tangent - arrowAng));
    ctx.lineTo(endX - arrowLen * Math.cos(tangent + arrowAng), endY - arrowLen * Math.sin(tangent + arrowAng));
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }

  function draw() {
    drawGrid(ctx, w, h, cx, cy);
    if (!chalCh) return;
    applyZoom(ctx, cx, cy);

    for(let i=0; i<=currentStep; i++) {
       if(i >= userShapes.length) break;
       const isPre = (i === 0);
       let isActive = false;
       if (isLevel4Done && i === chainLength) isActive = true;
       if (!isLevel4Done && i === currentStep && !isPre) isActive = true;

       const color = i === 0 ? '#ffffff' : getTypeColor(chalCh.transformations[i-1].type);

       if (isPre) {
         // Full opacity while on step 0; fade once student is past the first transform
         if (currentStep === 0) {
           ctx.globalAlpha = 1.0;
           drawAbs(userShapes[i], color, PRIMES[i], 0.2);
         } else {
           ctx.globalAlpha = 0.2;
           drawAbs(userShapes[i], color, PRIMES[i], 0.05);
         }
       } else {
         const alpha = isActive ? 0.2 : 0.05;
         ctx.globalAlpha = isActive ? 1.0 : 0.2;
         drawAbs(userShapes[i], color, PRIMES[i], alpha);
       }
       ctx.globalAlpha = 1.0;
    }

    if (currentStep >= chainLength || animating) {
       resetZoom(ctx);
       return;
    }

    const t = chalCh.transformations[currentStep];
    const tcolor = getTypeColor(t.type);
    
    if (t.type === 'translation') {
       const source = userShapes[currentStep];
       const currentPos = source.map(([px,py]) => [px + transDragOffset[0], py + transDragOffset[1]]);
       drawAbs(currentPos, tcolor, PRIMES[currentStep+1]);
       
       if(level === 1) {
         ctx.globalAlpha = 0.3;
         drawAbs(chalCh.shapes[currentStep+1], '#888', PRIMES[currentStep+1]);
         const startA = source[0], endA = chalCh.shapes[currentStep+1][0];
         gLine(ctx, startA[0], startA[1], endA[0], endA[1], '#888', true, 1.5);
         ctx.globalAlpha = 1.0;
       }
    } else {
       if(t.type === 'reflection') {
         currentUserAux.forEach(p => gDot(ctx, p[0], p[1], '#fff'));
         if(currentUserAux.length === 2) {
           const dx = currentUserAux[1][0] - currentUserAux[0][0];
           const dy = currentUserAux[1][1] - currentUserAux[0][1];
           const len = Math.hypot(dx, dy);
           if(len > 0) {
             const ux = dx/len, uy = dy/len;
             const p1x = currentUserAux[0][0] - ux*2000, p1y = currentUserAux[0][1] - uy*2000;
             const p2x = currentUserAux[0][0] + ux*2000, p2y = currentUserAux[0][1] + uy*2000;
             gLine(ctx, p1x, p1y, p2x, p2y, tcolor, false, 2);
           }
         }
       } else {
         if(currentUserAux.length === 1) gDot(ctx, currentUserAux[0][0], currentUserAux[0][1], '#fff', 'C');
       }
       
       currentUserPts.forEach((p, i) => gDot(ctx, p[0], p[1], tcolor, String.fromCharCode(65+i)+PRIMES[currentStep+1]));
       if(currentUserPts.length === chalCh.relPts.length) drawAbs(currentUserPts, tcolor, PRIMES[currentStep+1]);

       if (level === 1) {
         ctx.globalAlpha = 0.3;
         const exAux = getExpectedAux();
         if(t.type === 'reflection') {
           const dx = exAux[1].x - exAux[0].x, dy = exAux[1].y - exAux[0].y;
           const len = Math.hypot(dx, dy);
           const ux = dx/len, uy = dy/len;
           gLine(ctx, exAux[0].x - ux*2000, exAux[0].y - uy*2000, exAux[0].x + ux*2000, exAux[0].y + uy*2000, '#888', true, 2);
         } else gDot(ctx, exAux[0][0], exAux[0][1], '#888');
         
         if(currentUserAux.length === (t.type === 'reflection' ? 2 : 1)) {
           drawAbs(chalCh.shapes[currentStep+1], '#888', PRIMES[currentStep+1]);
           const source = userShapes[currentStep];
           const target = chalCh.shapes[currentStep+1];
           if(t.type === 'reflection') {
             for(let i=0; i<source.length; i++) gLine(ctx, source[i][0], source[i][1], target[i][0], target[i][1], '#888', true, 1);
           } else if(t.type === 'rotation') {
             const c = exAux[0];
             for(let i=0; i<source.length; i++) {
               const r = Math.hypot(source[i][0]-c[0], source[i][1]-c[1]);
               if(r < 1) continue;
               const startAngle = Math.atan2(source[i][1]-c[1], source[i][0]-c[0]);
               const endAngle = Math.atan2(target[i][1]-c[1], target[i][0]-c[0]);
               drawArrowArc(ctx, c[0], c[1], r, startAngle, endAngle, '#888');
             }
           } else if(t.type === 'dilation') {
             const c = exAux[0];
             for(let i=0; i<source.length; i++) gLine(ctx, c[0], c[1], target[i][0], target[i][1], '#888', true, 1);
           }
         }
         ctx.globalAlpha = 1.0;
       }
    }
    resetZoom(ctx);
  }

  // ── Validation Helpers ─────────────────────
  const isCollinear = (p, l1, l2) => {
    const cross = (l2.x - l1.x)*(p[1] - l1.y) - (l2.y - l1.y)*(p[0] - l1.x);
    return Math.abs(cross) < 100;
  };

  function checkCurrentPoint(px, py, indexOverride = -1) {
    const t = chalCh.transformations[currentStep];
    const isAux = indexOverride < 0; 
    
    if (isAux) {
       const ex = getExpectedAux();
       if(t.type === 'reflection') return isCollinear([px,py], ex[0], ex[1]);
       else return Math.hypot(px - ex[0][0], py - ex[0][1]) < 10;
    } else {
       if (indexOverride >= chalCh.relPts.length) return false;
       const target = chalCh.shapes[currentStep+1][indexOverride];
       return Math.hypot(px - target[0], py - target[1]) < 10;
    }
  }

  function advanceStep(plottedShape = null) {
    isDragging = false; draggedPointIndex = -1;
    transDragOffset = [0, 0];
    let nextShape = plottedShape;
    if (!nextShape) {
       nextShape = chalCh.shapes[currentStep+1].map(p=>[...p]);
    }
    
    userShapes.push(nextShape.map(p=>[...p]));
    currentStep++;
    currentUserPts = []; currentUserAux = [];
    hideTooltip();
    
    if(currentStep >= chainLength && level <= 2) {
       isLevel4Done = true;
       const res = Utils.el('chRes');
       res.className = 'pres ok';
       res.textContent = "✓ Chain Complete! Brilliant work!";
    }
    updateUI(); draw();
  }

  // ── Animations ─────────────────────────────
  function eio(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  function playSequenceAnimation(stepIdx, fromStep, onDone) {
    if (fromStep >= stepIdx) { onDone(); return; }
    
    const fromPts = chalCh.shapes[fromStep];
    const toPts   = chalCh.shapes[fromStep + 1];
    const t0      = chalCh.transformations[fromStep];
    
    const isRot   = t0.type === 'rotation';
    const rcx = cx + (isRot ? t0.params.gcx * Utils.STEP : 0);
    const rcy = cy - (isRot ? t0.params.gcy * Utils.STEP : 0);

    const DURATION = 600;
    let t_start = null;
    
    animating = true;

    function frame(ts) {
      if (!t_start) t_start = ts;
      const frac = Math.min((ts - t_start) / DURATION, 1);
      const e = eio(frac);

      const interp = isRot
        ? fromPts.map(([px, py]) => Utils.rotatePt(px, py, rcx, rcy, -t0.params.angle * e))
        : fromPts.map(([fx, fy], i) => [fx + (toPts[i][0] - fx) * e, fy + (toPts[i][1] - fy) * e]);

      drawGrid(ctx, w, h, cx, cy);
      applyZoom(ctx, cx, cy);
      ctx.globalAlpha = 0.2;
      drawAbs(chalCh.shapes[0], '#ffffff', PRIMES[0]);
      for (let j = 0; j < fromStep; j++) drawAbs(chalCh.shapes[j + 1], getTypeColor(chalCh.transformations[j].type), PRIMES[j+1]);
      ctx.globalAlpha = 1.0;
      drawAbs(interp, getTypeColor(t0.type), PRIMES[fromStep+1]);
      resetZoom(ctx);

      if (frac < 1) animFrameId = requestAnimationFrame(frame);
      else setTimeout(() => playSequenceAnimation(stepIdx, fromStep + 1, onDone), 200);
    }
    animFrameId = requestAnimationFrame(frame);
  }

  // ── Handlers ───────────────────────────────
  
  function checkStepValidation() {
    const t = chalCh.transformations[currentStep];
    const res = Utils.el('chRes');
    
    let isCorrect = true;
    if(t.type === 'translation') {
      const source = userShapes[currentStep];
      const target = chalCh.shapes[currentStep+1];
      const cxDrag = source[0][0] + transDragOffset[0];
      const cyDrag = source[0][1] + transDragOffset[1];
      if(Math.hypot(cxDrag - target[0][0], cyDrag - target[0][1]) > 15) isCorrect = false;
    } else {
      if(currentUserPts.length < chalCh.relPts.length) return false; 
      const target = chalCh.shapes[currentStep+1];
      for(let i=0; i<target.length; i++) {
        if(Math.hypot(currentUserPts[i][0] - target[i][0], currentUserPts[i][1] - target[i][1]) > 10) isCorrect = false;
      }
    }
    
    if(isCorrect) {
       advanceStep();
    } else {
       res.className = 'pres no'; 
       res.textContent = "✗ Incorrect placement. Try adjusting or use Show Me.";
    }
  }

  function checkSequence(isLevel4Check = false) {
    const res = Utils.el('chRes');
    let firstWrongIdx = -1;
    for (let i = 0; i < currentStep; i++) {
        let isWrong = false;
        const target = chalCh.shapes[i+1];
        for (let j = 0; j < target.length; j++) {
            if(Math.hypot(userShapes[i+1][j][0] - target[j][0], userShapes[i+1][j][1] - target[j][1]) > 15) {
                isWrong = true; break;
            }
        }
        if (isWrong) { firstWrongIdx = i; break; }
    }

    if (firstWrongIdx !== -1) {
       res.className = 'pres no'; 
       res.textContent = `✗ Step ${firstWrongIdx + 1} was incorrect. Try again from here!`;
       
       const revertParams = () => {
         userShapes.length = firstWrongIdx + 1;
         currentStep = firstWrongIdx;
         currentUserPts = []; currentUserAux = []; transDragOffset = [0,0];
         isDragging = false;
         updateUI(); draw();
       };

       if (isLevel4Check && firstWrongIdx > 0) {
          playSequenceAnimation(firstWrongIdx, 0, () => { animating = false; revertParams(); });
       } else {
          revertParams();
       }
    } else {
       if (currentStep === chainLength) {
          res.className = 'pres ok'; 
          res.textContent = "✓ Sequence Complete! Flawless execution!";
          
          const completeParams = () => {
             isLevel4Done = true;
             updateUI(); draw();
          };
          if (isLevel4Check) {
             playSequenceAnimation(chainLength, 0, () => { animating = false; completeParams(); });
          } else {
             completeParams();
          }
       } else {
          res.className = 'pres ok'; res.textContent = "✓ Correct! Replaying step...";
          if (level === 3) {
             playSequenceAnimation(currentStep, currentStep - 1, () => { animating = false; updateUI(); draw(); });
          }
       }
    }
  }

  Utils.el('chChkBtn')?.addEventListener('click', () => {
     if(level <= 2) checkStepValidation();
     else checkSequence(level === 4);
  });

  Utils.el('chUndoBtn')?.addEventListener('click', () => {
     if(!chalCh || isLevel4Done || animating) return;
     if(currentUserPts.length > 0) currentUserPts.pop();
     else if(currentUserAux.length > 0) currentUserAux.pop();
     else if(currentStep > 0) {
        // Revert last step
        currentStep--;
        userShapes.pop();
        transDragOffset = [0,0];
     }
     hideTooltip(); updateUI(); draw();
  });

  Utils.el('chResetBtn')?.addEventListener('click', resetUserProgress);

  Utils.el('chNewBtn')?.addEventListener('click', newChallenge);

  Utils.el('chShowBtn')?.addEventListener('click', () => {
     if(!chalCh) return;
     const res = Utils.el('chRes');
     if(res) { res.className = 'pres warn'; res.textContent = "Solution shown."; }
     playSequenceAnimation(chainLength, 0, () => {
       animating = false;
       isLevel4Done = true;
       userShapes = chalCh.shapes.map(s => [...s]);
       updateUI(); draw();
     });
  });

  // Canvas Mouse Hooks for Plotting
  canvas.addEventListener('mousedown', e => {
     if(!chalCh || currentStep >= chainLength || animating) return;
     if(e.button === 2) { 
       Utils.el('chUndoBtn').click();
       e.preventDefault();
       return; 
     }

     const rect = canvas.getBoundingClientRect();
     const [mx, my] = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, cx, cy);
     mouseX = mx; mouseY = my;
     
     const t = chalCh.transformations[currentStep];
     
     if (t.type === 'translation') {
       const source = userShapes[currentStep];
       let hit = isPointInPolygon([mx, my], source) || source.some(v => Math.hypot(v[0]-mx, v[1]-my) < 30);
       // Allow picking up regardless of interior if close, or if they dragged the active translated shadow
       const currentGhost = source.map(([px,py]) => [px + transDragOffset[0], py + transDragOffset[1]]);
       if(!hit) hit = isPointInPolygon([mx, my], currentGhost) || currentGhost.some(v => Math.hypot(v[0]-mx, v[1]-my) < 30);
       
       if(hit) {
         isDragging = true;
         draggedPointIndex = -1; // Not dragging a point, dragging the whole shape
       }
     } else {
       // Compute placement state FIRST so drag-detection cannot block new point placement
       const nv = chalCh.relPts.length;
       const isAux = currentUserAux.length < (t.type === 'reflection' ? 2 : 1);
       const allPointsPlaced = !isAux && currentUserPts.length >= nv;

       // Drag-reposition existing point — only when ALL required points are already placed
       if (allPointsPlaced) {
         for(let i=0; i<currentUserPts.length; i++) {
           if(Math.hypot(mx - currentUserPts[i][0], my - currentUserPts[i][1]) < 20) {
              isDragging = true; draggedPointIndex = i; return;
           }
         }
         for(let i=0; i<currentUserAux.length; i++) {
           if(Math.hypot(mx - currentUserAux[i][0], my - currentUserAux[i][1]) < 20) {
              isDragging = true; draggedPointIndex = -100 - i; return;
           }
         }
       }

       // Plotting New Point
       let px = Utils.snap(mx), py = Utils.snap(my);
       const targetNodes = chalCh.shapes[currentStep+1];
       if (targetNodes) {
          for(let v of targetNodes) {
             if(Math.hypot(mx - v[0], my - v[1]) < 18) { px = v[0]; py = v[1]; break; }
          }
       }
       if (isAux) {
         currentUserAux.push([px, py]);
         draggedPointIndex = -100 - (currentUserAux.length - 1);
         isDragging = true;
         if(level <= 2) showTooltip(checkCurrentPoint(px, py) ? "Correct!" : "Needs adjustment", checkCurrentPoint(px, py));
       } else if (currentUserPts.length < nv) {
         currentUserPts.push([px, py]);
         draggedPointIndex = currentUserPts.length - 1;
         isDragging = true;
         if(level <= 2) showTooltip(checkCurrentPoint(px, py, draggedPointIndex) ? "Correct!" : "Needs adjustment", checkCurrentPoint(px, py, draggedPointIndex));
       }
       updateUI(); draw();
     }
  });

  canvas.addEventListener('contextmenu', e => { e.preventDefault(); });

  canvas.addEventListener('mousemove', e => {
     const rect = canvas.getBoundingClientRect();
     [mouseX, mouseY] = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, cx, cy);
     
     if(!chalCh || currentStep >= chainLength || animating) return;
     const t = chalCh.transformations[currentStep];
     
     if (isDragging) {
       if (t.type === 'translation') {
         const source = userShapes[currentStep];
         const scx = source.reduce((s,p)=>s+p[0],0)/source.length;
         const scy = source.reduce((s,p)=>s+p[1],0)/source.length;
         transDragOffset = [Utils.snap(mouseX - scx), Utils.snap(mouseY - scy)];
         
         if (level === 2) {
            const target = chalCh.shapes[currentStep+1];
            const tcx = target.reduce((s,p)=>s+p[0],0)/target.length;
            const tcy = target.reduce((s,p)=>s+p[1],0)/target.length;
            if(Math.hypot(scx+transDragOffset[0]-tcx, scy+transDragOffset[1]-tcy) < 5) showTooltip("Correct!", true);
            else showTooltip("Needs adjustment", false);
         }
       } else if (draggedPointIndex !== -1) { // Point dragging
         let px = Utils.snap(mouseX), py = Utils.snap(mouseY);
         const targetNodes = chalCh.shapes[currentStep+1];
         if(targetNodes) {
            for(let v of targetNodes) {
               if(Math.hypot(mouseX - v[0], mouseY - v[1]) < 18) { px = v[0]; py = v[1]; break; }
            }
         }
         if(draggedPointIndex >= 0) {
            currentUserPts[draggedPointIndex] = [px, py];
            if(level <= 2) showTooltip(checkCurrentPoint(px, py, draggedPointIndex) ? "Correct!" : "Needs adjustment", checkCurrentPoint(px, py, draggedPointIndex));
         } else {
            const auxIdx = -draggedPointIndex - 100;
            currentUserAux[auxIdx] = [px, py];
            if(level <= 2) showTooltip(checkCurrentPoint(px, py) ? "Correct!" : "Needs adjustment", checkCurrentPoint(px, py));
         }
       }
       draw();
     }
  });

  window.addEventListener('mouseup', e => {
     if(isDragging) {
       isDragging = false; draggedPointIndex = -1;
       const t = chalCh.transformations[currentStep];
       
       if (t.type === 'translation') {
          if (level <= 2) { checkStepValidation(); }
          else { 
             const source = userShapes[currentStep];
             const plotted = source.map(p => [p[0] + transDragOffset[0], p[1] + transDragOffset[1]]);
             advanceStep(plotted);
          }
       } else if (currentUserPts.length === chalCh.relPts.length) {
          if (level <= 2) { checkStepValidation(); }
          else { advanceStep(currentUserPts.map(p=>[...p])); }
       }
       setTimeout(hideTooltip, 1200);
     }
  });

  document.querySelectorAll('[data-panel=challenge] .lbtn').forEach(b =>
    b.addEventListener('click', function () { 
       level = +this.dataset.level;
       Utils.set('chLN', LEVEL_NAMES[level]);
       document.querySelectorAll('[data-panel=challenge] .lbtn').forEach(bb => bb.classList.toggle('active', +bb.dataset.level === level));
       const panel = document.querySelector('[data-panel=challenge]');
       if(panel) panel.dataset.level = level;
       newChallenge();
    })
  );

  Utils.el('chSB')?.querySelectorAll('.sbtn').forEach(b =>
    b.addEventListener('click', function () {
      Utils.el('chSB').querySelectorAll('.sbtn').forEach(x => x.classList.remove('active'));
      this.classList.add('active');
      sk = this.dataset.shape;
      newChallenge();
    })
  );

  Utils.el('chChainBtns')?.querySelectorAll('.ch-chain').forEach(b =>
    b.addEventListener('click', function () {
      Utils.el('chChainBtns').querySelectorAll('.ch-chain').forEach(x => x.classList.remove('active'));
      this.classList.add('active');
      chainLength = +this.dataset.n;
      newChallenge();
    })
  );

  // ── Init ───────────────────
  attachResize('chCanvas', () => {
    const fresh = initCanvas('chCanvas');
    const dx = fresh.cx - cx, dy = fresh.cy - cy;
    ({ canvas, ctx, w, h, cx, cy } = fresh);
    if (chalCh) {
      chalCh.shapes = chalCh.shapes.map(pts => pts.map(([px, py]) => [px + dx, py + dy]));
      for(let i=0; i<userShapes.length; i++) userShapes[i] = userShapes[i].map(([px,py]) => [px + dx, py + dy]);
      currentUserAux = currentUserAux.map(([px, py]) => [px + dx, py + dy]);
      currentUserPts = currentUserPts.map(([px, py]) => [px + dx, py + dy]);
      draw();
    } else {
      newChallenge(); // panel was hidden during init — retry with correct canvas size
    }
  });

  newChallenge();
}

/* ── src/js/modules/freeform.js ────────────────────────────────── */
// ══════════════════════════════════════════════════
// FREEFORM MODE
// ══════════════════════════════════════════════════







function initFreeform() {
  let { canvas, ctx, w, h, cx, cy } = initCanvas('ffCanvas');

  // Phase 1: drawing
  let drawPhase = true;
  let drawnVerts = [];          // [[px,py],...] snapped pixel positions

  // Phase 2: chain
  let baseShape = [];           // locked absolute pixel pts
  let chain = [];               // transformation spec objects
  let chainOutputs = [];        // chainOutputs[0]=baseShape, [i+1]=result of chain[i-1]

  // Mode & animation
  let animateMode = false;
  let animStep = 0;             // next step to animate
  let animFrameId = null;
  let animPlaying = false;

  const COLOR_CHAIN = ['#00d4ff', '#00ff7f', '#ffcc00', '#ff3355'];
  const TYPE_COLORS = {
    translation: '#00d4ff',
    reflection:  '#00ff7f',
    rotation:    '#ffcc00',
    dilation:    '#ff3355'
  };
  const PRIMES      = ["'", "''", "'''", "''''"];
  const TYPE_LABELS = {
    translation: 'Translation',
    reflection:  'Reflection',
    rotation:    'Rotation',
    dilation:    'Dilation'
  };

  // ── Transformation Math ──────────────────────────

  const translatePt = (px, py, tx, ty) => [px + tx * Utils.STEP, py - ty * Utils.STEP];
  const dilPt       = (px, py, kx, ky, k) => [kx + (px - kx) * k, ky + (py - ky) * k];

  const reflectPt = (px, py, ax1, ax2) => {
    const dx = ax2.x - ax1.x, dy = ax2.y - ax1.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 0.01) return [px, py];
    const t = ((px - ax1.x) * dx + (py - ax1.y) * dy) / len2;
    return [2 * (ax1.x + t * dx) - px, 2 * (ax1.y + t * dy) - py];
  };

  function defaultAxis() {
    return {
      ax1: { x: cx, y: cy - 4 * Utils.STEP },
      ax2: { x: cx, y: cy + 4 * Utils.STEP }
    };
  }

  function applyStepMath(pts, step) {
    switch (step.type) {
      case 'translation': {
        const { tx, ty } = step.params;
        return pts.map(([px, py]) => translatePt(px, py, tx, ty));
      }
      case 'reflection':
        return pts.map(([px, py]) => reflectPt(px, py, step.ax1, step.ax2));
      case 'rotation':
        if (!step.centerPlaced) return pts;
        return pts.map(([px, py]) =>
          Utils.rotatePt(px, py, step.centerPx, step.centerPy, step.params.angle));
      case 'dilation':
        if (!step.centerPlaced) return pts;
        return pts.map(([px, py]) =>
          dilPt(px, py, step.centerPx, step.centerPy, step.params.scale));
      default: return pts;
    }
  }

  // ── Draw ─────────────────────────────────────────

  function draw() {
    drawGrid(ctx, w, h, cx, cy);
    applyZoom(ctx, cx, cy);

    if (drawPhase) {
      drawPhase1();
      resetZoom(ctx);
      return;
    }

    if (baseShape.length >= 3) {
      gShape(ctx, baseShape, 0, 0, '#ffffff');
      gLabels(ctx, baseShape, 0, 0, '#ffffff');
    }

    if (animateMode) {
      for (let i = 0; i < animStep; i++) {
        if (chainOutputs[i + 1]) {
          gShape(ctx, chainOutputs[i + 1], 0, 0, TYPE_COLORS[chain[i].type]);
          gLabels(ctx, chainOutputs[i + 1], 0, 0, TYPE_COLORS[chain[i].type], PRIMES[i]);
        }
      }
      resetZoom(ctx);
      return;
    }

    if (typeof testModeParams !== 'undefined' && testModeParams.active) {
      for (let i = 0; i < testModeParams.step; i++) {
        if (chainOutputs[i + 1]) {
          gShape(ctx, chainOutputs[i + 1], 0, 0, TYPE_COLORS[chain[i].type]);
          gLabels(ctx, chainOutputs[i + 1], 0, 0, TYPE_COLORS[chain[i].type], PRIMES[i]);
        }
      }
      
      const cStepIdx = testModeParams.step;
      if (cStepIdx < chain.length) {
         const step = chain[cStepIdx];
         if (step.type === 'reflection' && step.ax1) {
            gLine(ctx, step.ax1.x, step.ax1.y, step.ax2.x, step.ax2.y, '#bb55ff', true, 1.5);
         } else if (step.centerPlaced) {
            gDot(ctx, step.centerPx, step.centerPy, step.type==='dilation' ? '#ffffff' : '#bb55ff', step.type==='dilation' ? 'K' : 'P');
         }
         
         const color = TYPE_COLORS[step.type];
         if (step.plottedVerts && step.plottedVerts.length > 0) {
            step.plottedVerts.forEach(([px, py]) => gDot(ctx, px, py, color));
            if (step.plottedVerts.length >= 2) {
              for (let i = 0; i < step.plottedVerts.length - 1; i++) {
                gLine(ctx,
                  step.plottedVerts[i][0], step.plottedVerts[i][1],
                  step.plottedVerts[i + 1][0], step.plottedVerts[i + 1][1],
                  color, false, 1.5);
              }
            }
         }
      }
    }
    resetZoom(ctx);
  }


  function drawPhase1() {
    const N = drawnVerts.length;
    if (N === 0) return;

    // Edges between consecutive vertices
    for (let i = 0; i < N - 1; i++) {
      gLine(ctx, drawnVerts[i][0], drawnVerts[i][1],
                 drawnVerts[i + 1][0], drawnVerts[i + 1][1], '#ffffff', false, 1.5);
    }
    // Dashed closing edge if ≥ 3
    if (N >= 3) {
      gLine(ctx, drawnVerts[N - 1][0], drawnVerts[N - 1][1],
                 drawnVerts[0][0], drawnVerts[0][1], '#ffffff', true, 1.2);
    }
    // Vertex dots + labels
    drawnVerts.forEach(([px, py], i) => {
      gDot(ctx, px, py, '#ffffff', String.fromCharCode(65 + i));
    });
  }

  // ── Legend ───────────────────────────────────────

  function updateLegend() {
    const legend = Utils.el('ffLegend');
    if (!legend) return;
    // Keep base Pre-image entry, rebuild step entries
    const existing = legend.querySelectorAll('.ff-leg-step');
    existing.forEach(e => e.remove());

    const appliedCount = chain.filter(s => s.applied).length;
    for (let i = 0; i < appliedCount; i++) {
      const div = document.createElement('div');
      div.className = 'li ff-leg-step';
      div.innerHTML = `<div class="ld" style="background:${TYPE_COLORS[chain[i].type]}"></div>Step ${i + 1}`;
      legend.appendChild(div);
    }
  }

  // ── Phase Transition ─────────────────────────────

  function confirmShape() {
    baseShape = drawnVerts.map(v => [...v]);
    chainOutputs = [baseShape];
    chain = [];
    drawPhase = false;

    const n = baseShape.length;
    Utils.set('ffShapeSummary', `${n}-vertex polygon`);
    Utils.el('ffPhase1').style.display = 'none';
    Utils.el('ffPhase2').style.display = '';

    updateLegend();
    resetAnimate();
    draw();
  }

  function newShape() {
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    animPlaying = false;
    animStep = 0;
    drawPhase = true;
    drawnVerts = [];
    baseShape = [];
    chain = [];
    chainOutputs = [];

    Utils.el('ffPhase2').style.display = 'none';
    Utils.el('ffPhase1').style.display = '';
    Utils.el('ffChainList').innerHTML = '';
    Utils.el('ffTypePicker').style.display = 'none';
    Utils.el('ffAddBtn').disabled = false;
    Utils.el('ffAnimControls').style.display = 'none';
    animateMode = false;
    if (typeof testModeParams !== 'undefined') { testModeParams.active = false; testModeParams.step = 0; }
    if(Utils.el('ffModeButtons')) Utils.el('ffModeButtons').style.display = 'flex';
    if(Utils.el('ffAnimControls')) Utils.el('ffAnimControls').style.display = 'none';
    if(Utils.el('ffTestControls')) Utils.el('ffTestControls').style.display = 'none';
    if(Utils.el('ffAddBtn')) Utils.el('ffAddBtn').style.display = '';

    updateVertCount();
    updateLegend();
    draw();
  }

  function updateVertCount() {
    Utils.set('ffVertCount', `${drawnVerts.length} of 6 vertices placed`);
    const btn = Utils.el('ffConfirm');
    if (btn) btn.disabled = drawnVerts.length < 3;
  }

  // ── Add Transformation ───────────────────────────

  function addTransformation(type) {
    const stepIdx = chain.length;
    const step = makeChainEntry(type, stepIdx);
    chain.push(step);

    const box = createSpecBox(stepIdx, type);
    Utils.el('ffChainList').appendChild(box);

    checkInputs();

    if (chain.length >= 4) Utils.el('ffAddBtn').disabled = true;
    Utils.el('ffTypePicker').style.display = 'none';
    draw();
  }

  function makeChainEntry(type, idx) {
    const base = { type, applied: false, plottedVerts: [] };
    switch (type) {
      case 'translation':
        return { ...base, params: { tx: 0, ty: 0 } };
      case 'reflection':
        return { ...base, params: { axText: '' }, ax1: null, ax2: null };
      case 'rotation':
        return { ...base, params: { cx: 0, cy: 0, angle: 90 }, centerPx: null, centerPy: null, centerPlaced: true };
      case 'dilation':
        return { ...base, params: { cx: 0, cy: 0, scale: 2 }, centerPx: null, centerPy: null, centerPlaced: true };
    }
  }

  // ── Spec Box Creation ─────────────────────────────

  function createSpecBox(stepIdx, type) {
    const color = TYPE_COLORS[type];
    const box = document.createElement('div');
    box.className = 'ff-step-box';
    box.dataset.step = stepIdx;
    box.innerHTML = `
      <div class="ff-step-header">
        <span class="ff-step-label" style="color:${color}">Step ${stepIdx + 1} — ${TYPE_LABELS[type]}</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <div class="ff-inline-res" id="ffRes${stepIdx}"></div>
          <button class="ff-step-remove btn bg" data-step="${stepIdx}">×</button>
        </div>
      </div>
      ${specBodyHTML(type, stepIdx, color)}
    `;

    wireSpecBox(box, stepIdx, type);
    return box;
  }

  function specBodyHTML(type, idx, color) {
    switch (type) {
      case 'translation':
        return `
          <div class="sgrp">
            <label style="color:${color};font-size:.8rem;flex:1">X Shift: <input type="number" id="ffTx${idx}" value="0" style="width:50px;margin-left:5px"></label>
            <label style="color:${color};font-size:.8rem;flex:1">Y Shift: <input type="number" id="ffTy${idx}" value="0" style="width:50px;margin-left:5px"></label>
          </div>`;
      case 'reflection':
        return `
          <div class="sgrp">
            <label style="color:${color};font-size:.8rem">Axis of Symmetry (e.g. y-axis, x=2, y=-x): <input type="text" id="ffAx${idx}" placeholder="y-axis" style="width:100px;margin-left:5px"></label>
          </div>`;
      case 'rotation':
        return `
          <div class="sgrp">
            <label style="color:${color};font-size:.8rem">Center P — X: <input type="number" id="ffRotX${idx}" value="0" style="width:40px;margin-right:8px"> Y: <input type="number" id="ffRotY${idx}" value="0" style="width:40px"></label>
            <label style="color:${color};font-size:.8rem;margin-top:5px">Angle: <input type="number" id="ffAng${idx}" value="90" style="width:50px;margin-left:5px">°</label>
          </div>`;
      case 'dilation':
        return `
          <div class="sgrp">
            <label style="color:${color};font-size:.8rem">Center K — X: <input type="number" id="ffDilX${idx}" value="0" style="width:40px;margin-right:8px"> Y: <input type="number" id="ffDilY${idx}" value="0" style="width:40px"></label>
            <label style="color:${color};font-size:.8rem;margin-top:5px">Scale Factor: <input type="number" step="0.1" id="ffScale${idx}" value="2" style="width:50px;margin-left:5px"></label>
          </div>`;
    }
    return '';
  }

  function wireSpecBox(box, stepIdx, type) {
    box.querySelector('.ff-step-remove')?.addEventListener('click', () => removeStep(stepIdx));
    
    const inputs = box.querySelectorAll('input');
    inputs.forEach(inp => {
      inp.addEventListener('input', () => {
         const step = chain[stepIdx];
         if (type === 'translation') {
            step.params.tx = parseFloat(box.querySelector(`#ffTx${stepIdx}`).value) || 0;
            step.params.ty = parseFloat(box.querySelector(`#ffTy${stepIdx}`).value) || 0;
         } else if (type === 'reflection') {
            step.params.axText = box.querySelector(`#ffAx${stepIdx}`).value;
         } else if (type === 'rotation') {
            step.params.cx = parseFloat(box.querySelector(`#ffRotX${stepIdx}`).value) || 0;
            step.params.cy = parseFloat(box.querySelector(`#ffRotY${stepIdx}`).value) || 0;
            step.params.angle = parseFloat(box.querySelector(`#ffAng${stepIdx}`).value) || 0;
         } else if (type === 'dilation') {
            step.params.cx = parseFloat(box.querySelector(`#ffDilX${stepIdx}`).value) || 0;
            step.params.cy = parseFloat(box.querySelector(`#ffDilY${stepIdx}`).value) || 0;
            step.params.scale = parseFloat(box.querySelector(`#ffScale${stepIdx}`).value) || 1;
         }
         checkInputs();
      });
      // trigger input to set initial state correctly
      inp.dispatchEvent(new Event('input'));
    });
  }

  function checkInputs() {
     let valid = chain.length > 0;
     for(let i=0; i<chain.length; i++) {
        if(chain[i].type === 'reflection' && !parseReflectionAxis(chain[i].params.axText)) {
           valid = false;
        }
     }
     Utils.el('ffTestTrans').disabled = !valid;
     Utils.el('ffAnimateTrans').disabled = !valid;
  }

  function parseReflectionAxis(str) {
    str = str.toLowerCase().replace(/\s/g, '');
    if(!str) return null;
    const D = 4000; 
    if (str === 'y-axis' || str === 'x=0') return { ax1: {x: cx, y: cy-D}, ax2: {x: cx, y: cy+D} };
    if (str === 'x-axis' || str === 'y=0') return { ax1: {x: cx-D, y: cy}, ax2: {x: cx+D, y: cy} };
    if (str === 'y=x') return { ax1: {x: cx-D, y: cy+D}, ax2: {x: cx+D, y: cy-D} };
    if (str === 'y=-x') return { ax1: {x: cx-D, y: cy-D}, ax2: {x: cx+D, y: cy+D} };
    
    let m = str.match(/^x=([+-]?\d*\.?\d+)$/);
    if (m) {
      const v = parseFloat(m[1]) * Utils.STEP;
      return { ax1: {x: cx + v, y: cy-D}, ax2: {x: cx + v, y: cy+D} };
    }
    m = str.match(/^y=([+-]?\d*\.?\d+)$/);
    if (m) {
      const v = parseFloat(m[1]) * Utils.STEP;
      return { ax1: {x: cx-D, y: cy - v}, ax2: {x: cx+D, y: cy - v} };
    }
    return null;
  }

  function calculateChainOutputs() {
    chainOutputs = [baseShape];
    for (let i = 0; i < chain.length; i++) {
        const step = chain[i];
        let inputPts = chainOutputs[i];
        
        if (step.type === 'reflection') {
            const axes = parseReflectionAxis(step.params.axText);
            if (!axes) return false;
            step.ax1 = axes.ax1;
            step.ax2 = axes.ax2;
        } else if (step.type === 'rotation' || step.type === 'dilation') {
            step.centerPx = cx + step.params.cx * Utils.STEP;
            step.centerPy = cy - step.params.cy * Utils.STEP;
        }
        
        let out = applyStepMath(inputPts, step);
        chainOutputs.push(out);
    }
    return true;
  }

  // ── Remove Step ──────────────────────────────────

  function removeStep(stepIdx) {
    chain.splice(stepIdx, 1);

    Utils.el('ffChainList').innerHTML = '';
    chain.forEach((s, i) => {
      const box = createSpecBox(i, s.type);
      Utils.el('ffChainList').appendChild(box);
    });

    Utils.el('ffAddBtn').disabled = chain.length >= 4;
    checkInputs();
    draw();
  }

  function showRes(stepIdx, cls) {
    const res = Utils.el(`ffRes${stepIdx}`);
    if (res) {
      res.className = `ff-inline-res ${cls}`;
      res.textContent = cls === 'ok' ? '✓' : '✗';
    }
  }

  // ── Canvas Click Routing ─────────────────────────

  let testModeParams = { active: false, step: 0 };

  canvas.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const [_fpx, _fpy] = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, cx, cy);
    const px = Utils.snap(_fpx);
    const py = Utils.snap(_fpy);

    if (drawPhase) {
      if (drawnVerts.length < 6) {
        drawnVerts.push([px, py]);
        updateVertCount();
        draw();
      }
      return;
    }

    if (testModeParams.active) {
       const cStepIdx = testModeParams.step;
       if (cStepIdx >= chain.length) return;
       const step = chain[cStepIdx];
       
       if (step.plottedVerts.length < baseShape.length) {
          step.plottedVerts.push([px, py]);
          const remaining = baseShape.length - step.plottedVerts.length;
          Utils.set('ffTestStatus', remaining > 0 ? `Plot ${remaining} more points for Step ${cStepIdx + 1}` : `Checking Step ${cStepIdx + 1}...`);
          draw();
          
          if (step.plottedVerts.length === baseShape.length) {
             // Verify
             const correctPts = chainOutputs[cStepIdx + 1];
             const tolerance = Utils.STEP / 2 + 4;
             let allOk = true;
             for (let i = 0; i < correctPts.length; i++) {
               const pv = step.plottedVerts[i];
               const cv = correctPts[i];
               if (Math.hypot(pv[0] - cv[0], pv[1] - cv[1]) > tolerance) { allOk = false; break; }
             }
             if (allOk) {
                step.applied = true;
                showRes(cStepIdx, 'ok', '✓ Correctly Plotted!');
                testModeParams.step++;
                if (testModeParams.step >= chain.length) {
                   Utils.set('ffTestStatus', '🎉 All steps complete!');
                } else {
                   Utils.set('ffTestStatus', `Plot the image for Step ${testModeParams.step + 1}`);
                }
             } else {
                showRes(cStepIdx, 'no', '✗ Some vertices are incorrect. Try again.');
                step.plottedVerts = [];
                Utils.set('ffTestStatus', `Plot the image for Step ${cStepIdx + 1}`);
             }
             updateLegend();
             draw();
          }
       }
    }
  });

  canvas.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    if (drawPhase) {
      if (drawnVerts.length > 0) {
        drawnVerts.pop();
        updateVertCount();
        draw();
      }
      return;
    }
    
    if (testModeParams.active) {
       const cStepIdx = testModeParams.step;
       if (cStepIdx >= chain.length) return;
       const step = chain[cStepIdx];
       if (step.plottedVerts.length > 0) {
          step.plottedVerts.pop();
          const remaining = baseShape.length - step.plottedVerts.length;
          Utils.set('ffTestStatus', `Plot ${remaining} more points for Step ${cStepIdx + 1}`);
          draw();
       }
    }
  });

  // ── Animation ────────────────────────────────────

  function eio(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  function resetAnimate() {
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    animPlaying = false;
    animStep = 0;
  }

  function runAnimStep(sIdx, onDone) {
    const fromPts = chainOutputs[sIdx];
    const toPts   = chainOutputs[sIdx + 1];
    if (!fromPts || !toPts) { onDone(); return; }

    const step = chain[sIdx];
    const isRot = step.type === 'rotation';

    const DURATION = 600;
    let t_start = null;

    function frame(ts) {
      if (!t_start) t_start = ts;
      const frac = Math.min((ts - t_start) / DURATION, 1);
      const e = eio(frac);

      let interp;
      if (isRot) {
        interp = fromPts.map(([px, py]) =>
          Utils.rotatePt(px, py, step.centerPx, step.centerPy, step.params.angle * e));
      } else {
        interp = fromPts.map(([fx, fy], i) => [fx + (toPts[i][0] - fx) * e, fy + (toPts[i][1] - fy) * e]);
      }

      drawGrid(ctx, w, h, cx, cy);
      applyZoom(ctx, cx, cy);
      if (baseShape.length >= 3) {
        gShape(ctx, baseShape, 0, 0, '#ffffff');
        gLabels(ctx, baseShape, 0, 0, '#ffffff');
      }
      for (let j = 0; j < sIdx; j++) {
        if (chainOutputs[j + 1]) {
          gShape(ctx, chainOutputs[j + 1], 0, 0, TYPE_COLORS[chain[j].type]);
          gLabels(ctx, chainOutputs[j + 1], 0, 0, TYPE_COLORS[chain[j].type], PRIMES[j]);
        }
      }
      gShape(ctx, interp, 0, 0, TYPE_COLORS[chain[sIdx].type]);
      gLabels(ctx, interp, 0, 0, TYPE_COLORS[chain[sIdx].type], PRIMES[sIdx]);
      resetZoom(ctx);

      if (frac < 1) {
        animFrameId = requestAnimationFrame(frame);
      } else {
        setTimeout(onDone, 200);
      }
    }
    animFrameId = requestAnimationFrame(frame);
  }

  function playAll(fromStep) {
    if (fromStep >= chain.length || !chain[fromStep]?.applied) {
      animPlaying = false;
      animStep = fromStep;
      draw();
      return;
    }
    animStep = fromStep;
    runAnimStep(fromStep, () => {
      animStep = fromStep + 1;
      if (animPlaying) playAll(animStep);
      else draw();
    });
  }

  // ── Resize ───────────────────────────────────────

  attachResize('ffCanvas', () => {
    const fresh = initCanvas('ffCanvas');
    const dx = fresh.cx - cx, dy = fresh.cy - cy;
    ({ canvas, ctx, w, h, cx, cy } = fresh);

    drawnVerts  = drawnVerts.map(([px, py]) => [px + dx, py + dy]);
    baseShape   = baseShape.map(([px, py]) => [px + dx, py + dy]);
    chainOutputs = chainOutputs.map(pts => pts ? pts.map(([px, py]) => [px + dx, py + dy]) : pts);
    chain.forEach(s => {
      if (s.centerPx !== null && s.centerPx !== undefined) {
        s.centerPx += dx; s.centerPy += dy;
      }
      if (s.ax1) { s.ax1.x += dx; s.ax1.y += dy; s.ax2.x += dx; s.ax2.y += dy; }
      if (s.plottedVerts) s.plottedVerts = s.plottedVerts.map(([px, py]) => [px + dx, py + dy]);
      if (s.diyOx !== null && s.diyOx !== undefined) { s.diyOx += dx; s.diyOy += dy; }
    });

    draw();
  });

  // ── Wire Top-Level Events ─────────────────────────

  Utils.el('ffConfirm')?.addEventListener('click', confirmShape);

  Utils.el('ffClearVerts')?.addEventListener('click', () => {
    drawnVerts = [];
    updateVertCount();
    draw();
  });


  Utils.el('ffAddBtn')?.addEventListener('click', () => {
    Utils.el('ffTypePicker').style.display =
      Utils.el('ffTypePicker').style.display === 'none' ? '' : 'none';
  });

  Utils.el('ffTypePicker')?.querySelectorAll('.ff-type-btn').forEach(btn =>
    btn.addEventListener('click', function () {
      addTransformation(this.dataset.type);
    }));

  Utils.el('ffAnimPlay')?.addEventListener('click', () => {
    if (animPlaying) return;
    // Ensure all applied steps have computed outputs
    const appliedCount = chain.filter(s => s.applied).length;
    if (appliedCount === 0) return;
    animPlaying = true;
    resetAnimate();
    animPlaying = true;
    playAll(0);
  });

  Utils.el('ffAnimStep')?.addEventListener('click', () => {
    if (animPlaying) return;
    const appliedCount = chain.filter(s => s.applied).length;
    if (animStep >= appliedCount) return;
    runAnimStep(animStep, () => {
      animStep++;
      draw();
    });
  });

  Utils.el('ffAnimReset')?.addEventListener('click', () => {
    resetAnimate();
    draw();
  });

  Utils.el('ffNewShape')?.addEventListener('click', newShape);


  Utils.el('ffTestTrans')?.addEventListener('click', () => {
    if (!calculateChainOutputs()) return alert('Invalid transformation parameters. Check reflection axis format.');
    testModeParams.active = true;
    testModeParams.step = 0;
    chain.forEach(s => { s.applied = false; s.plottedVerts = []; });
    Utils.el('ffModeButtons').style.display = 'none';
    Utils.el('ffTestControls').style.display = 'block';
    Utils.el('ffTestStatus').textContent = 'Plot the image for Step 1';
    Utils.el('ffAddBtn').style.display = 'none';
    document.querySelectorAll('.ff-step-box input').forEach(el => el.disabled = true);
    document.querySelectorAll('.ff-step-remove').forEach(el => el.style.visibility = 'hidden');
    draw();
  });

  Utils.el('ffAnimateTrans')?.addEventListener('click', () => {
    if (!calculateChainOutputs()) return alert('Invalid transformation parameters. Check reflection axis format.');
    animateMode = true;
    chain.forEach(s => s.applied = true);
    Utils.el('ffModeButtons').style.display = 'none';
    Utils.el('ffAnimControls').style.display = 'flex';
    Utils.el('ffAddBtn').style.display = 'none';
    document.querySelectorAll('.ff-step-box input').forEach(el => el.disabled = true);
    document.querySelectorAll('.ff-step-remove').forEach(el => el.style.visibility = 'hidden');
    resetAnimate();
    draw();
  });

  Utils.el('ffExitMode')?.addEventListener('click', () => {
     animateMode = false;
     resetAnimate();
     Utils.el('ffAnimControls').style.display = 'none';
     Utils.el('ffModeButtons').style.display = 'flex';
     Utils.el('ffAddBtn').style.display = '';
     document.querySelectorAll('.ff-step-box input').forEach(el => el.disabled = false);
     document.querySelectorAll('.ff-step-remove').forEach(el => el.style.visibility = 'visible');
     draw();
  });

  Utils.el('ffTestExit')?.addEventListener('click', () => {
     testModeParams.active = false;
     testModeParams.step = 0;
     Utils.el('ffTestControls').style.display = 'none';
     Utils.el('ffModeButtons').style.display = 'flex';
     Utils.el('ffAddBtn').style.display = '';
     document.querySelectorAll('.ff-step-box input').forEach(el => el.disabled = false);
     document.querySelectorAll('.ff-step-remove').forEach(el => el.style.visibility = 'visible');
     draw();
  });

  // ── Init ─────────────────────────────────────────

  updateVertCount();
  draw();
}

/* ── src/js/main.js ────────────────────────────────────────────── */
// Tab switching
document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', function() {
  document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
  this.classList.add('active');
  document.querySelector(`.panel[data-panel="${this.dataset.tab}"]`).classList.add('active');
}));

// Collapsible info boxes
// Set max-height on itext elements so CSS transition works
function initInfoBox(panel) {
  const box = panel.querySelector('.info-box');
  if (!box) return;
  const itext = box.querySelector('.itext');
  if (!itext) return;

  // Measure natural height and lock it so transition has a target
  itext.style.maxHeight = itext.scrollHeight + 'px';

  // Click anywhere on the box to toggle
  box.addEventListener('click', () => {
    box.classList.toggle('collapsed');
    if (!box.classList.contains('collapsed')) {
      itext.style.maxHeight = itext.scrollHeight + 'px';
    }
  });
}

// Collapse/expand based on level: levels 1 & 2 expanded, 3+ collapsed
function setInfoBoxForLevel(panel, level) {
  const box = panel.querySelector('.info-box');
  if (!box) return;
  const itext = box.querySelector('.itext');
  if (itext) itext.style.maxHeight = itext.scrollHeight + 'px';
  if (level <= 2) {
    box.classList.remove('collapsed');
  } else {
    box.classList.add('collapsed');
  }
}

document.querySelectorAll('.panel').forEach(panel => {
  initInfoBox(panel);
  // Listen for level button clicks within this panel
  panel.querySelectorAll('.lbtn').forEach(btn => {
    btn.addEventListener('click', function() {
      setInfoBoxForLevel(panel, +this.dataset.level);
    });
  });
});

// Initialize all transformation modules
initTranslation();
initReflection();
initRotation();
initDilation();
initChallenge();
initFreeform();

})();
