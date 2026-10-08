(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const dialog=$('#model-dialog'),status=$('#sensor-status');const reduced=matchMedia('(prefers-reduced-motion:reduce)');
if(!window.THREE){$$('.model-loading').forEach(e=>e.textContent='三维组件未能载入，请刷新页面。');return;}
const T=THREE, views=[];let fullView=null,mode='demo',listening=false,lastPhone=0,reference=null,permissionToken=0;
const rawPhone=new T.Quaternion(),phoneTarget=new T.Quaternion(),smoothPhone=new T.Quaternion();
function silk(text,w,h){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#e5f0df';c.textAlign='center';c.textBaseline='middle';c.font='bold 40px monospace';c.fillText(text,256,128);const texture=new T.CanvasTexture(canvas);const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:T.DoubleSide}));mesh.rotation.x=-Math.PI/2;return mesh;}
function createDetailedBoard(){
 // Original chip, substrate, 8 pins, LED and axes come from imu_visualizer.
 const group=createIMUBoard(0x225f54,'MPU-6050 SENSOR');
 const gold=new T.MeshStandardMaterial({color:0xc9a15a,metalness:.8,roughness:.3});const silver=new T.MeshStandardMaterial({color:0xaeb9b9,metalness:.8,roughness:.3});
 const dark=new T.MeshStandardMaterial({color:0x22292b,roughness:.8});
 // The original axis arrows remain available at a more compact scale.
 group.children[group.children.length-1].scale.setScalar(.6);
 for(const x of [-.92,.92]){const ring=new T.Mesh(new T.TorusGeometry(.07,.02,8,20),gold);ring.rotation.x=Math.PI/2;ring.position.set(x,.054,-.62);group.add(ring);const hole=new T.Mesh(new T.CylinderGeometry(.052,.052,.012,18),dark);hole.position.copy(ring.position);group.add(hole);}
 for(let i=0;i<6;i++){let x=i<3?-.66:.56,z=-.38+(i%3)*.27;const body=new T.Mesh(new T.BoxGeometry(.17,.055,.078),dark);body.position.set(x,.07,z);group.add(body);for(const dx of [-.082,.082]){const end=new T.Mesh(new T.BoxGeometry(.043,.06,.084),silver);end.position.set(x+dx,.073,z);group.add(end);}}
 const reg=new T.Mesh(new T.BoxGeometry(.25,.10,.19),dark);reg.position.set(-.57,.09,.43);group.add(reg);
 const traceMaterial=new T.LineBasicMaterial({color:0x6c997b,transparent:true,opacity:.5});
 for(let i=0;i<8;i++){const x=-.8+i*.23;const path=[new T.Vector3(x,.048,.62),new T.Vector3(x,.048,.40),new T.Vector3((x*.4),.048,.24)];group.add(new T.Line(new T.BufferGeometry().setFromPoints(path),traceMaterial));const pad=new T.Mesh(new T.TorusGeometry(.049,.013,6,14),gold);pad.rotation.x=Math.PI/2;pad.position.set(x,.051,.7);group.add(pad);}
 const label=silk('MPU-6050',.80,.25);label.position.set(.04,.052,-.54);group.add(label);
 const chip=silk('INV',.24,.13);chip.position.set(0,.146,.06);group.add(chip);
 return group;
}
function createView(host,interactive){
 try{
  const scene=new T.Scene();const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0,0);if(T.sRGBEncoding)renderer.outputEncoding=T.sRGBEncoding;
  host.querySelector('.model-loading')?.remove();host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','MPU6050 三维板卡，拖动可旋转观察');renderer.domElement.setAttribute('role','img');
  const camera=new T.PerspectiveCamera(37,1,.1,40);
   if(host.id==='mini-stage'){
     camera.position.set(1.42,1.50,1.88);
     camera.fov=34;
     camera.lookAt(0,0.10,0);
   }else{
     camera.position.set(2.35,2.25,2.85);
     camera.lookAt(0,0.18,0);
   }
  scene.add(new T.HemisphereLight(0xfffcf0,0x516e67,.95));const key=new T.DirectionalLight(0xfff8e6,.9);key.position.set(2,6,4);scene.add(key);const fill=new T.DirectionalLight(0xa7d5ea,.6);fill.position.set(-3,2,-4);scene.add(fill);
  const model=createDetailedBoard();scene.add(model);
  const grid=new T.GridHelper(6,20,0x9eafa6,0xc8d4cb);grid.position.y=-.53;grid.material.transparent=true;grid.material.opacity=.35;scene.add(grid);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;const c=shadowCanvas.getContext('2d');const grad=c.createRadialGradient(64,64,2,64,64,60);grad.addColorStop(0,'rgba(39,60,48,.2)');grad.addColorStop(1,'rgba(39,60,48,0)');c.fillStyle=grad;c.fillRect(0,0,128,128);const shadow=new T.Mesh(new T.PlaneGeometry(3.4,2.7),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.52;scene.add(shadow);
  const controls=new T.OrbitControls(camera,renderer.domElement);
   controls.enablePan=false;
   controls.enableZoom=host.id==='full-stage';
   controls.enableDamping=true;
   controls.dampingFactor=.09;
   controls.minDistance=2.0;
   controls.maxDistance=10;
   controls.maxPolarAngle=Math.PI*.89;
   if(host.id==='mini-stage'){
     controls.target.set(0,0.10,0);
   }else{
     controls.target.set(0,0.18,0);
   }
   controls.saveState();
  const view={host,renderer,scene,camera,controls,model,visible:true,interactive};views.push(view);
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(host);resize();try{renderer.render(scene,camera);}catch(e){}
  new IntersectionObserver(entries=>{view.visible=entries[0].isIntersecting;},{threshold:0}).observe(host);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='三维绘制暂时中断，请刷新页面恢复。';});
  return view;
 }catch(e){host.textContent='当前浏览器无法启动 WebGL 三维显示。请启用硬件加速后重试。';host.dataset.renderError=e.message;return null;}
}
createView($('#mini-stage'),true);
const projectHost=$('#project-stage');let projectCreated=false;const lazyObserver=new IntersectionObserver(entries=>{if(entries[0].isIntersecting&&!projectCreated){projectCreated=true;createView(projectHost,true);lazyObserver.disconnect();}},{rootMargin:'300px'});lazyObserver.observe(projectHost);
function stopPhone(){permissionToken++;window.removeEventListener('deviceorientation',receivePhone);listening=false;clearTimeout(stopPhone.timer);}
function selectMode(name){mode=name;$$('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===name);b.setAttribute('aria-pressed',String(b.dataset.mode===name));});}
function useDemo(){stopPhone();selectMode('demo');status.textContent='演示姿态：可拖动旋转视角。这里展示的是模拟运动，不是已连接的 MPU6050 数据。';}
function receivePhone(e){if(!listening||e.beta==null||e.gamma==null)return;lastPhone=performance.now();const rad=Math.PI/180;const orientation=(screen.orientation?.angle??window.orientation??0)*rad;rawPhone.setFromEuler(new T.Euler(e.beta*rad,(e.alpha||0)*rad,-e.gamma*rad,'YXZ'));rawPhone.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2));rawPhone.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),-orientation));if(!reference){reference=rawPhone.clone().invert();smoothPhone.identity();}phoneTarget.copy(reference).multiply(rawPhone);selectMode('phone');status.textContent='正在跟随本机姿态。以首次有效读数为零位；可点「归零」重新校准。';}
async function enablePhone(){
 stopPhone();const token=permissionToken;reference=null;lastPhone=0;
 if(!window.isSecureContext){status.textContent='手机姿态需要 HTTPS 页面。当前预览仍可使用演示姿态和自由查看。';return;}
 if(!('DeviceOrientationEvent' in window)){status.textContent='这个浏览器没有设备姿态接口，可继续使用演示或拖动查看。';return;}
 try{
  if(typeof DeviceOrientationEvent.requestPermission==='function'){const answer=await DeviceOrientationEvent.requestPermission();if(token!==permissionToken)return;if(answer!=='granted'){status.textContent='未获得手机姿态权限，演示模式仍然可用。';return;}}
  listening=true;window.addEventListener('deviceorientation',receivePhone);status.textContent='等待本机传感器数据，请轻轻转动手机…';
  stopPhone.timer=setTimeout(()=>{if(listening&&!lastPhone){stopPhone();selectMode('demo');status.textContent='未收到传感器数据，已保留演示模式。请在支持设备姿态的手机浏览器中打开 HTTPS 页面。';}},4500);
 }catch(e){stopPhone();selectMode('demo');status.textContent='浏览器未允许姿态读取，可使用演示或自由查看。';}
}
$$('[data-model-open]').forEach(btn=>btn.onclick=()=>{dialog.showModal();document.body.classList.add('modal-open');if(!fullView)fullView=createView($('#full-stage'),true);requestAnimationFrame(()=>{if(fullView){fullView.visible=true;fullView.controls.update();}});});
$$('[data-mode]').forEach(btn=>btn.onclick=()=>{if(btn.dataset.mode==='phone'){enablePhone();}else if(btn.dataset.mode==='manual'){stopPhone();selectMode('manual');status.textContent='自由查看：拖动旋转视角，滚轮或双指缩放。模型停止自动摆动。';}else useDemo();});
$('#calibrate').onclick=()=>{fullView?.controls.reset();if(mode==='phone'){reference=rawPhone.clone().invert();phoneTarget.identity();smoothPhone.identity();status.textContent='已将当前手机姿态设为零位。';}else status.textContent='视角已重置。';};
dialog.addEventListener('close',()=>{useDemo();if(fullView)fullView.visible=false;});
const demoEuler=new T.Euler(),phoneEuler=new T.Euler(),lastManual=new T.Quaternion();let previous=0,frame=0,nextRead=0;
function animate(time){frame=requestAnimationFrame(animate);if(document.hidden)return;const dt=Math.min((time-previous)/1000||.016,.1);previous=time;const seconds=reduced.matches?1:time/1000;
 const roll=Math.sin(seconds*.65)*13,pitch=Math.cos(seconds*.44)*9,yaw=Math.sin(seconds*.25)*16;demoEuler.set(pitch*Math.PI/180,-yaw*Math.PI/180,roll*Math.PI/180,'YXZ');
 if(mode==='phone')smoothPhone.slerp(phoneTarget,1-Math.exp(-12*dt));
 for(const v of views){if(!v.visible||(v===fullView&&!dialog.open))continue;const isPhone=mode==='phone'&&Boolean(lastPhone);
  if(isPhone)v.model.quaternion.copy(smoothPhone);else if(mode==='manual'&&dialog.open)v.model.quaternion.copy(lastManual);else {v.model.rotation.copy(demoEuler);lastManual.copy(v.model.quaternion);}
  const touchReading=matchMedia('(max-width:1000px)').matches&&v!==fullView;v.controls.enabled=!touchReading;v.renderer.domElement.style.touchAction=touchReading?'pan-y':'none';v.controls.update();v.renderer.render(v.scene,v.camera);
 }
 if(time>nextRead){nextRead=time+100;let values={roll,pitch,yaw};if(mode==='phone'&&Boolean(lastPhone)){phoneEuler.setFromQuaternion(smoothPhone,'YXZ');values={roll:phoneEuler.z*180/Math.PI,pitch:phoneEuler.x*180/Math.PI,yaw:-phoneEuler.y*180/Math.PI};}else if(mode==='manual'&&dialog.open){phoneEuler.setFromQuaternion(lastManual,'YXZ');values={roll:phoneEuler.z*180/Math.PI,pitch:phoneEuler.x*180/Math.PI,yaw:-phoneEuler.y*180/Math.PI};}
  for(const [axis,value]of Object.entries(values)){const el=$('#read-'+axis);if(el)el.textContent=value.toFixed(1)+'°';const small=$('[data-mini-'+axis+']');if(small)small.textContent=value.toFixed(1)+'°';}
 }
}
requestAnimationFrame(animate);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&listening){useDemo();status.textContent='页面进入后台，已暂停手机姿态读取。返回后可重新开启。';}});

// --- Mobile Gravity Sensor Auto-Activation (UA & Aspect Ratio Detection) ---
function isMobileDevice() {
  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|MicroMessenger/i.test(ua);
  const isNarrowOrPortrait = (window.innerWidth <= 820) || (window.innerHeight > window.innerWidth);
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  return (isMobileUA || isNarrowOrPortrait) && hasTouch;
}

function autoInitMobileSensor() {
  if (!isMobileDevice()) return;
  selectMode('phone');
  
  if (typeof DeviceOrientationEvent !== 'undefined') {
    if (typeof DeviceOrientationEvent.requestPermission !== 'function') {
      // Android / Chrome Mobile / WeChat: listen immediately
      listening = true;
      window.addEventListener('deviceorientation', receivePhone, { passive: true });
      if (status) status.textContent = '重力感应已连接：转动手机实时同步 3D 板卡。';
    } else {
      // iOS Safari: user gesture request on first touch
      const reqIOS = async () => {
        try {
          const res = await DeviceOrientationEvent.requestPermission();
          if (res === 'granted') {
            listening = true;
            window.addEventListener('deviceorientation', receivePhone, { passive: true });
            if (status) status.textContent = '重力感应已连接：转动手机实时同步 3D 板卡。';
          }
        } catch (err) {}
      };
      window.addEventListener('touchstart', reqIOS, { once: true });
      window.addEventListener('click', reqIOS, { once: true });
    }
  }
}
autoInitMobileSensor();

window.Biped3D={views,get mode(){return mode;}};
})();
