(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mobile=()=>matchMedia('(max-width:1000px)').matches;
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const board=$('#board'), cards=$$('.clue'), threads=$('#threads');
let state={positions:{},notes:[],strokes:[]}, drawing=false, pen=false, activeDrag=null;
try { const saved=JSON.parse(localStorage.getItem('biped-workbench-v2')||'null'); if(saved&&Array.isArray(saved.notes))state=saved; }catch(e){}
function save(){try{localStorage.setItem('biped-workbench-v2',JSON.stringify(state));}catch(e){toast('浏览器未允许本地保存，本次仍可正常编辑。');}}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),2800);}
const edges=[['pcb','imu','core'],['imu','hal','core'],['hal','rtos','future'],['ai','schedule','core'],['ai','ime','core'],['ai','band','core'],['imu','rtos','future']];
const byId=Object.fromEntries(cards.map(el=>[el.dataset.id,el]));
function layout(){
  if(!mobile()){
    for(const el of cards){const pos=state.positions[el.dataset.id]||{x:+el.dataset.x,y:+el.dataset.y};el.style.left=(12+pos.x*Math.max(0,board.clientWidth-el.offsetWidth-24))+'px';el.style.top=(12+pos.y*Math.max(0,board.clientHeight-el.offsetHeight-24))+'px';}
    $$('.note-card').forEach(el=>{const item=state.notes.find(x=>x.id===el.dataset.id);if(item){el.style.left=(12+item.x*Math.max(0,board.clientWidth-el.offsetWidth-24))+'px';el.style.top=(12+item.y*Math.max(0,board.clientHeight-el.offsetHeight-24))+'px';}});
  }else{cards.forEach(el=>{el.style.left='';el.style.top='';});}
  updateThreads();resizeInk();
}
function updateThreads(){
 const r=board.getBoundingClientRect();threads.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);
 threads.innerHTML=edges.map(([a,b,type])=>{
  const A=byId[a],B=byId[b];if(!A.offsetWidth||!B.offsetWidth)return '';
  const ar=A.getBoundingClientRect(),br=B.getBoundingClientRect();
  const ac={x:ar.left-r.left+ar.width/2,y:ar.top-r.top+ar.height/2},bc={x:br.left-r.left+br.width/2,y:br.top-r.top+br.height/2};
  let dx=bc.x-ac.x,dy=bc.y-ac.y;
  const fa=1/Math.max(Math.abs(dx)/(ar.width/2),Math.abs(dy)/(ar.height/2),1),fb=1/Math.max(Math.abs(dx)/(br.width/2),Math.abs(dy)/(br.height/2),1);
  const p={x:ac.x+dx*fa,y:ac.y+dy*fa},q={x:bc.x-dx*fb,y:bc.y-dy*fb};
  const curve=clamp(Math.hypot(dx,dy)*.10,14,40);
  return `<path class="connection ${type}" d="M${p.x},${p.y} Q${(p.x+q.x)/2+curve},${(p.y+q.y)/2+curve} ${q.x},${q.y}"/><circle class="connection-dot" cx="${p.x}" cy="${p.y}" r="2"/><circle class="connection-dot" cx="${q.x}" cy="${q.y}" r="2"/>`;
 }).join('');
}
function drag(el,handle){
 handle.addEventListener('pointerdown',e=>{if(mobile()||pen||e.button!==0||e.target.closest('button'))return;
  activeDrag={el,x:e.clientX,y:e.clientY,left:el.offsetLeft,top:el.offsetTop};handle.setPointerCapture(e.pointerId);el.classList.add('dragging');e.preventDefault();
 });
 handle.addEventListener('pointermove',e=>{if(activeDrag?.el!==el)return;
  el.style.left=clamp(activeDrag.left+e.clientX-activeDrag.x,8,board.clientWidth-el.offsetWidth-8)+'px';
  el.style.top=clamp(activeDrag.top+e.clientY-activeDrag.y,8,board.clientHeight-el.offsetHeight-8)+'px';updateThreads();
 });
 function end(){if(activeDrag?.el!==el)return;activeDrag=null;el.classList.remove('dragging');
  const pos={x:clamp((el.offsetLeft-12)/Math.max(1,board.clientWidth-el.offsetWidth-24),0,1),y:clamp((el.offsetTop-12)/Math.max(1,board.clientHeight-el.offsetHeight-24),0,1)};
  if(el.classList.contains('note-card'))Object.assign(state.notes.find(n=>n.id===el.dataset.id),pos);else state.positions[el.dataset.id]=pos;save();updateThreads();
 }
 handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
}
cards.forEach(el=>drag(el,el.querySelector('.drag-handle')));
$('#arrange').onclick=()=>{state.positions={};save();layout();toast('已整理项目线索，你的便签和涂鸦仍然保留。');};
const ink=$('#ink'),ctx=ink.getContext('2d');let currentStroke=[];
function redrawInk(){ctx.clearRect(0,0,board.clientWidth,board.clientHeight);for(const pts of [...state.strokes,currentStroke]){if(pts.length<2)continue;ctx.beginPath();pts.forEach((p,i)=>{const x=p[0]*board.clientWidth,y=p[1]*board.clientHeight;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle='#a84935';ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}}
function resizeInk(){const dpr=Math.min(devicePixelRatio||1,2);ink.width=board.clientWidth*dpr;ink.height=board.clientHeight*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);redrawInk();}
$('#pen-toggle').onclick=()=>{pen=!pen;board.classList.toggle('draw-mode',pen);$('#pen-toggle').classList.toggle('active',pen);$('#pen-toggle').setAttribute('aria-pressed',String(pen));toast(pen?'画笔已开启，点击「画笔」可返回拖动模式。':'已回到拖动模式。');};
function inkPoint(e){const r=ink.getBoundingClientRect();return [(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height];}
ink.addEventListener('pointerdown',e=>{if(!pen)return;drawing=true;currentStroke=[inkPoint(e)];ink.setPointerCapture(e.pointerId);e.preventDefault();});
ink.addEventListener('pointermove',e=>{if(!drawing)return;currentStroke.push(inkPoint(e));redrawInk();});
function endInk(){if(!drawing)return;drawing=false;if(currentStroke.length>1)state.strokes.push(currentStroke);currentStroke=[];save();redrawInk();}
ink.addEventListener('pointerup',endInk);ink.addEventListener('pointercancel',endInk);
$('#undo-ink').onclick=()=>{state.strokes.pop();save();redrawInk();};
// Editable local notes and original symbol stickers.
let editId=null;const templates={idea:'新想法：先做一个能运行的小版本。',experiment:'实验记录：改了什么？观察到了什么？',sticker:'下一个好玩的想法'};
function openDialog(dialog){dialog.showModal();document.body.classList.add('modal-open');}
function openNote(item=null){editId=item?.id||null;$('#note-type').value=item?.type||'idea';$('#note-text').value=item?.text||templates.idea;$('#note-icon').value=item?.icon||'✳';$('#note-heading').textContent=item?'编辑这条线索。':'留一条新线索。';$('#delete-note').hidden=!item;openDialog($('#note-dialog'));}
$('#add-clue').onclick=()=>openNote();$('#note-type').onchange=e=>{$('#note-text').value=templates[e.target.value];};
function drawNote(item){const el=document.createElement('article');el.className='note-card';el.dataset.id=item.id;el.tabIndex=0;el.setAttribute('aria-label','便签，双击或按回车编辑');
 const icon=document.createElement('span');icon.className='note-icon';icon.textContent=item.icon;const text=document.createElement('div');text.textContent=item.text;el.append(icon,text);
 const del=document.createElement('button');del.className='note-delete';del.textContent='×';del.setAttribute('aria-label','删除此便签');del.onclick=()=>{state.notes=state.notes.filter(n=>n.id!==item.id);el.remove();save();};el.append(del);board.append(el);drag(el,el);
 el.ondblclick=()=>openNote(item);el.onkeydown=e=>{if(e.key==='Enter')openNote(item);};}
state.notes.forEach(drawNote);
$('#note-form').onsubmit=e=>{e.preventDefault();const text=$('#note-text').value.trim()||templates[$('#note-type').value];const item={id:editId||'note-'+Date.now(),text,icon:$('#note-icon').value,type:$('#note-type').value,x:.52,y:.56};
 if(editId){const old=state.notes.find(n=>n.id===editId);item.x=old.x;item.y=old.y;state.notes=state.notes.filter(n=>n.id!==editId);board.querySelector(`[data-id="${editId}"]`).remove();}
 state.notes.push(item);drawNote(item);save();layout();$('#note-dialog').close();toast('线索已保存在当前浏览器。双击便签可以再改。');};
$('#delete-note').onclick=()=>{if(editId){state.notes=state.notes.filter(n=>n.id!==editId);board.querySelector(`[data-id="${editId}"]`)?.remove();save();}$('#note-dialog').close();};
$$('dialog').forEach(dialog=>{dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());dialog.addEventListener('close',()=>{if(!$('dialog[open]'))document.body.classList.remove('modal-open');});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});});
$$('[data-image]').forEach(a=>a.onclick=e=>{e.preventDefault();$('#large-image').src=a.dataset.image;$('#large-image').alt=a.dataset.caption;$('#large-caption').textContent=a.dataset.caption;openDialog($('#image-dialog'));});
// Sticky scroll sequence: pin first, expand from the right, then release to normal document flow.
const track=$('#hero-track'),panel=$('#feature-panel'),compact=$('#panel-compact'),full=$('#panel-full'),bench=$('#workbench');let scrollFrame=0;
function updateScroll() {
  scrollFrame = 0;
  if (mobile()) {
    panel.style.width = '';
    bench.style.opacity = '';
    bench.style.transform = '';
    bench.inert = false;
    compact.style.opacity = '';
    compact.style.transform = '';
    compact.style.pointerEvents = '';
    compact.inert = false;
    compact.removeAttribute('aria-hidden');
    full.style.opacity = '';
    full.style.transform = '';
    full.classList.remove('visible');
    full.inert = true;
    full.setAttribute('aria-hidden', 'true');
    panel.style.setProperty('--expand-progress', 0);
    return;
  }

  const r = track.getBoundingClientRect();
  const travel = Math.max(1, track.offsetHeight - innerHeight);
  const p = clamp(-r.top / travel, 0, 1);

  // Phase 1 (p: 0 -> 0.18): Compact panel fades out gracefully with subtle lift
  const compactProgress = clamp(p / 0.18, 0, 1);
  const compactOpacity = 1 - compactProgress;
  compact.style.opacity = compactOpacity.toFixed(3);
  compact.style.transform = `translateY(${-16 * compactProgress}px)`;
  compact.style.pointerEvents = p > 0.12 ? 'none' : '';
  compact.inert = p > 0.12;
  compact.setAttribute('aria-hidden', String(p > 0.12));

  // Workbench & board (p: 0 -> 0.50): Fades and slides slightly to the left
  const benchProgress = clamp(p / 0.50, 0, 1);
  bench.style.opacity = (1 - benchProgress).toFixed(3);
  bench.style.transform = `translateX(${-50 * benchProgress}px)`;
  bench.inert = p > 0.22;

  // Phase 2 (p: 0.10 -> 0.70): Curtain reveals by expanding panel width with cubic bezier easing
  const grow = clamp((p - 0.10) / 0.60, 0, 1);
  const eased = grow < 0.5 ? 4 * grow * grow * grow : 1 - Math.pow(-2 * grow + 2, 3) / 2;
  const base = 0.36;
  const panelWidthPercent = (base + (1 - base) * eased) * 100;
  panel.style.width = panelWidthPercent.toFixed(2) + '%';
  panel.style.setProperty('--expand-progress', p.toFixed(4));

  // Phase 3 (p: 0.45 -> 0.72): Full panel fades in smoothly and glides up (ZERO clipping, ZERO text reflow)
  const fullProgress = clamp((p - 0.45) / 0.24, 0, 1);
  const fullShow = p > 0.40;
  full.classList.toggle('visible', fullShow);
  full.style.opacity = fullProgress.toFixed(3);
  full.style.transform = `translateY(${20 * (1 - fullProgress)}px)`;
  full.inert = !fullShow;
  full.style.pointerEvents = fullProgress > 0.8 ? 'auto' : 'none';
  full.setAttribute('aria-hidden', String(!fullShow));

  const meter = $('.scroll-meter span');
  if (meter) meter.style.width = (p * 100) + '%';
}
function onScroll(){if(!scrollFrame)scrollFrame=requestAnimationFrame(updateScroll);}
window.addEventListener('scroll',onScroll,{passive:true});
$('#expand-button').onclick=()=>{if(mobile()){$('#direction').scrollIntoView({behavior:'smooth'});return;}window.scrollTo({top:track.offsetTop+(track.offsetHeight-innerHeight)*.83,behavior:reduced.matches?'instant':'smooth'});};
$('.panel-cta').onclick=e=>{if(!mobile()){e.preventDefault();$('#expand-button').click();}};
window.addEventListener('resize',()=>{layout();updateScroll();});
new ResizeObserver(()=>{layout();}).observe(board);
layout();updateScroll();
})();





// --- Continuous Physics Overscroll Mascot (Mistral Horizon Style) ---
(function() {
  const mascot = document.getElementById('mascot-stage');
  const footer = document.getElementById('site-footer');
  const img = document.getElementById('mascot-click-img');
  if (!mascot || !footer) return;

  function getMascotHeight() {
    return window.innerWidth <= 760 ? 190 : 250;
  }

  let mascotHeight = getMascotHeight();
  let currentY = mascotHeight; // in px; mascotHeight = fully submerged, 0 = fully emerged
  let targetY = mascotHeight;
  let isTrackingTouch = false;
  let touchStartY = 0;
  let touchStartTargetY = mascotHeight;

  window.addEventListener('resize', () => {
    mascotHeight = getMascotHeight();
    if (targetY > mascotHeight) targetY = mascotHeight;
  });

  function isAtPageBottom() {
    return (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 10);
  }

  // 1. Desktop Wheel Continuous Physics
  window.addEventListener('wheel', (e) => {
    const atBottom = isAtPageBottom();
    if (!atBottom) return;

    if (e.deltaY > 0) {
      // Continuing to scroll down while at the bottom: pull the mascot up continuously
      const prev = targetY;
      targetY = Math.max(0, targetY - e.deltaY * 0.45);
      if (targetY < mascotHeight && targetY !== prev) {
        e.preventDefault();
      }
    } else if (e.deltaY < 0 && targetY < mascotHeight) {
      // Scrolling up while mascot is out: push it back down into the horizon before page scrolls up
      targetY = Math.min(mascotHeight, targetY - e.deltaY * 0.45);
      e.preventDefault();
    }
  }, { passive: false });

  // 2. Mobile Touch Continuous Physics
  window.addEventListener('touchstart', (e) => {
    if (isAtPageBottom() && e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
      touchStartTargetY = targetY;
      isTrackingTouch = true;
    } else {
      isTrackingTouch = false;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isTrackingTouch || e.touches.length !== 1) return;
    const atBottom = isAtPageBottom();
    if (!atBottom && targetY >= mascotHeight) return;

    const deltaY = touchStartY - e.touches[0].clientY; // positive when dragging up
    if (deltaY > 0) {
      targetY = Math.max(0, touchStartTargetY - deltaY * 0.85);
    } else if (deltaY < 0 && targetY < mascotHeight) {
      targetY = Math.min(mascotHeight, touchStartTargetY - deltaY * 0.85);
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    if (!isTrackingTouch) return;
    isTrackingTouch = false;
    if (targetY < mascotHeight * 0.55) {
      targetY = 0; // magnetic snap to fully emerged
    } else {
      targetY = mascotHeight; // magnetic snap to fully submerged
    }
  }, { passive: true });

  // 3. Auto-retract when scrolling back up the page
  window.addEventListener('scroll', () => {
    const atBottom = isAtPageBottom();
    if (!atBottom && targetY < mascotHeight) {
      targetY = mascotHeight;
    }
  }, { passive: true });

  // 4. Smooth Spring / Damping Physics Animation Loop (rAF)
  function renderPhysics() {
    const diff = targetY - currentY;
    if (Math.abs(diff) > 0.1) {
      currentY += diff * 0.20;
      mascot.style.transform = `translateX(-50%) translateY(${currentY.toFixed(1)}px)`;
      mascot.setAttribute('aria-hidden', currentY >= mascotHeight - 2 ? 'true' : 'false');
      mascot.style.pointerEvents = currentY < mascotHeight * 0.6 ? 'auto' : 'none';
    } else if (currentY !== targetY) {
      currentY = targetY;
      mascot.style.transform = `translateX(-50%) translateY(${currentY.toFixed(1)}px)`;
      mascot.setAttribute('aria-hidden', currentY >= mascotHeight - 2 ? 'true' : 'false');
      mascot.style.pointerEvents = currentY < mascotHeight * 0.6 ? 'auto' : 'none';
    }
    requestAnimationFrame(renderPhysics);
  }
  requestAnimationFrame(renderPhysics);

  // 5. Interactive Mascot Click Bounce
  if (img) {
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      img.classList.remove('bounce');
      void img.offsetWidth;
      img.classList.add('bounce');
    });
  }
})();
