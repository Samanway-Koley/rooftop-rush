(async function rooftopRushBoot() {
'use strict';
window.__rrGameScriptLoaded = true;
const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');
const { RGBELoader } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/RGBELoader.js');
const { RoomEnvironment } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js');
const { RoundedBoxGeometry } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/geometries/RoundedBoxGeometry.js');

/* =====================================================================
   ROOFTOP RUSH — game.js
   Story-driven 3D runner. Three.js r160 · skinned mocap character ·
   HDR image-based lighting · PBR materials · soft shadows · PWA.

   game.js is a classic script so the split-file build can be opened directly;
   Three.js and the 3D assets are still streamed from HTTPS CDNs.
   ===================================================================== */
const LOGO_PNG='./rooftop-rush.png';
const LOGO_SVG="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><defs><linearGradient id='b' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ff9c5e'/><stop offset='.5' stop-color='#f96a14'/><stop offset='1' stop-color='#e84b04'/></linearGradient></defs><circle cx='256' cy='256' r='250' fill='url(#b)'/><circle cx='256' cy='256' r='208' fill='none' stroke='#fff' stroke-width='12'/><g fill='#fff'><path d='M256 10l12 30h-24z'/><rect x='250' y='40' width='12' height='112' rx='4'/><path d='M192 158l12-110h28l10 110z'/><path d='M270 158l10-110h28l12 110z'/><rect x='188' y='150' width='136' height='14' rx='7'/></g><circle cx='256' cy='248' r='100' fill='#fff'/><circle cx='256' cy='248' r='74' fill='#f96a14'/><circle cx='256' cy='248' r='52' fill='#fff'/><circle cx='256' cy='248' r='29' fill='#f96a14'/><circle cx='256' cy='250' r='12' fill='#fff'/><g fill='none' stroke='#fff' stroke-linecap='round'><path d='M160 152A138 138 0 0 0 142 342' stroke-width='11'/><path d='M352 152A138 138 0 0 1 370 342' stroke-width='11'/></g><g fill='#fff'><circle cx='256' cy='352' r='19'/><rect x='249' y='368' width='14' height='86' rx='6'/><path d='M249 452h14v22l-7 9-7-9z'/></g><circle cx='256' cy='352' r='8' fill='#f96a14'/></svg>";
const LOGO_FALLBACK='data:image/svg+xml,'+encodeURIComponent(LOGO_SVG);
function logoFallback(img){try{if(!img||img.dataset.fbk)return;img.dataset.fbk='1';img.src=LOGO_FALLBACK;}catch(e){}}
function reportLoadError(msg){
  try{
    const ld=document.getElementById('loader');
    if(!ld||ld.classList.contains('hide'))return;   /* game already booted — ignore late noise */
    const el=document.getElementById('ld-err');
    if(!el||el.textContent)return;
    el.classList.add('on');el.textContent=msg;
  }catch(e){}
}
/* Missing asset files must NEVER look like a game failure.
   Only real script errors reach the loader message. */
addEventListener('error',(e)=>{
  const t=e&&e.target;
  if(t&&t!==window&&(t.tagName==='IMG'||t.tagName==='LINK'||t.tagName==='SCRIPT')){
    if(t.tagName==='IMG'&&t.classList&&t.classList.contains('lemblem'))logoFallback(t);
    return;
  }
  if(e&&e.message)reportLoadError('Load error: '+e.message);
},true);
addEventListener('unhandledrejection',(e)=>{
  const r=e&&e.reason;
  const msg=r?(r.message||String(r)):'';
  if(msg&&msg!=='[object Object]')reportLoadError('Load error: '+msg);
});
try{
  document.querySelectorAll('img.lemblem').forEach(img=>{
    img.addEventListener('error',()=>logoFallback(img));
    if(img.complete&&img.naturalWidth===0)logoFallback(img);
  });
  /* If the real PNG exists, upgrade the tab favicons to it (exact logo). */
  const probe=new Image();
  probe.onload=()=>{try{document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]').forEach(l=>{l.type='image/png';l.href=LOGO_PNG;});}catch(e){}};
  probe.onerror=()=>{};
  probe.src=LOGO_PNG;
}catch(e){}
/* Manifest is only valid over http(s) — attaching it on file:// throws CORS errors */
if(location.protocol==='http:'||location.protocol==='https:'){
  try{const m=document.createElement('link');m.rel='manifest';m.href='./manifest.webmanifest';document.head.appendChild(m)}catch(e){}
}

const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, rand=(a,b)=>a+Math.random()*(b-a);
const rint=(a,b)=>Math.floor(rand(a,b+1)), pick=a=>a[Math.floor(Math.random()*a.length)];
const damp=(c,t,r,dt)=>c+(t-c)*(1-Math.exp(-r*dt)), sstep=t=>t*t*(3-2*t);
const store={g(k,d){try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}},s(k,v){try{localStorage.setItem(k,String(v))}catch(e){}}};
const V3=THREE.Vector3;

const MASTER=.42;
const DEV_URL='https://github.com/Samanway-Koley';
const LANE_STIFF=84,LANE_DAMP=16; /* critically-damped spring: smooth lane glides */
const LANES=[-2.15,0,2.15];
const TILE=30,NTILES=8,SPAWN_Z=-150,KILL_Z=14;
const GRAV=24,JUMPV=10,PH=1.75,SHH=.85,PW=.7,PD=.6;
const BASES=['https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/','https://threejs.org/examples/','https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/'];

/* ---------------------------------------------------------------------
   STORY
   --------------------------------------------------------------------- */
const STORY=[
  {title:'THE DROP',sub:'MORNING · HARBOR ROOFTOPS',pal:'morning',diff:0,goal:{type:'dist',v:700,label:'Reach the Signal Relay'},coinGoal:60,
   lines:[[0,'Morning, {name}. You are carrying the Lantern Key — the only thing that can restart the Harbor grid.'],[140,'Signal Relay is 700 meters east. Jump the low stuff, switch lanes around the big stuff.'],[400,'Helix Corp just flagged the Key as stolen property. Expect company.'],[600,'Relay in sight. Keep that pace!']]},
  {title:'GOLDEN HOUR',sub:'SUNSET · MARKET DISTRICT',pal:'golden',diff:1,goal:{type:'shards',v:3,label:'Recover the Lantern Shards'},coinGoal:80,
   lines:[[0,'Bad news. The Key is incomplete — Helix scattered three Lantern Shards across the roofs.'],[170,'Helix drones are sweeping low. Slide under them!'],[650,'Shards glow cyan. Grab every one you see.']]},
  {title:'BLACKOUT',sub:'DUSK · THE GRID GOES DARK',pal:'dusk',diff:2,goal:{type:'dist',v:1300,label:'Cross the dark district'},coinGoal:110,
   lines:[[0,'Helix just cut power to the district. It is you and the tower now, {name}.'],[450,'Scaffolding everywhere. Slide under or go around.'],[1000,'I can see the tower beacon. Almost there!']]},
  {title:'LIGHTS ON',sub:'NIGHT · THE SIGNAL TOWER',pal:'night',diff:3,goal:{type:'dist',v:1700,label:'Deliver the Key to the Tower'},coinGoal:140,
   lines:[[0,'Last stretch. Every Helix drone in the city is on you.'],[800,'Halfway. The tower crew is ready for the Key.'],[1450,'Final approach. Bring the lights back!']]}
];
const ENDING='The Lantern Key clicks into the Signal Tower. One district at a time, Harbor City lights up again — and Helix Corp loses its grip on the night. Night Shift is now open: run as far as you can.';
const ENDLESS_LINES=[[0,'Night Shift. No destination — just distance. Make it count, {name}.'],[1000,'One kilometer. Helix is getting desperate.'],[2000,'Two kilometers! The whole dispatch room is watching.'],[3200,'You are a legend on these roofs, {name}.']];

/* ---------------------------------------------------------------------
   PALETTES (time of day)
   --------------------------------------------------------------------- */
const PALS={
  morning:{top:'#2d7bd2',mid:'#8fc4f0',bot:'#eaf3fb',fog:'#cfe2f2',fogN:70,fogF:290,sun:'#fff1da',sunI:3.1,sunDir:[.45,.78,.4],hemiS:'#d7eaff',hemiG:'#8e8678',hemiI:1.05,night:0,exp:1.0,cloud:'#ffffff'},
  golden: {top:'#3a5ea8',mid:'#f2a46a',bot:'#ffd6a0',fog:'#f2c290',fogN:60,fogF:270,sun:'#ffb066',sunI:3.4,sunDir:[-.38,.26,-.89],hemiS:'#ffd8b4',hemiG:'#5f4a3c',hemiI:.9,night:.2,exp:1.0,cloud:'#ffd0aa'},
  dusk:   {top:'#1b2050',mid:'#7d4d8e',bot:'#f39a70',fog:'#6a4c78',fogN:50,fogF:240,sun:'#ff8d6c',sunI:1.7,sunDir:[-.3,.13,-.95],hemiS:'#9b88c6',hemiG:'#2b2238',hemiI:.8,night:.85,exp:1.12,cloud:'#c597b8'},
  night:  {top:'#060a1d',mid:'#18224d',bot:'#3b3a70',fog:'#1d2348',fogN:45,fogF:230,sun:'#a9bcff',sunI:1.0,sunDir:[.35,.55,-.76],hemiS:'#5a70bb',hemiG:'#121625',hemiI:.7,night:1,exp:1.2,cloud:'#56608f'}
};
const PAL_ORDER=['morning','golden','dusk','night'];

/* ---------------------------------------------------------------------
   AUDIO — synthesized SFX
   --------------------------------------------------------------------- */
class Sfx{
  constructor(){this.ctx=null;this.gain=null;this.muted=store.g('rr_mute','0')==='1';this.musicOn=false;this.built=false}
  /* Built lazily, exactly once, from inside a real user gesture */
  wake(){if(this.built)return;this.built=true;
    try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      this.ctx=new AC();this.gain=this.ctx.createGain();this.gain.gain.value=this.muted?0:MASTER;this.gain.connect(this.ctx.destination)}catch(e){}}
  mute(m){this.muted=m;store.s('rr_mute',m?'1':'0');if(this.gain)this.gain.gain.value=m?0:MASTER}
  n(f,d,v,dl=0,type='sine',sl=0){if(!this.ctx||this.muted)return;v*=1.35;try{const t=this.ctx.currentTime+dl,o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(f,t);if(sl)o.frequency.exponentialRampToValueAtTime(Math.max(40,f+sl),t+d);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.connect(g);g.connect(this.gain);o.start(t);o.stop(t+d+.05)}catch(e){}}
  noise(d,v,f=900){if(!this.ctx||this.muted)return;v*=1.35;try{const n=Math.max(1,this.ctx.sampleRate*d|0),b=this.ctx.createBuffer(1,n,this.ctx.sampleRate),a=b.getChannelData(0);
    for(let i=0;i<n;i++)a[i]=(Math.random()*2-1)*(1-i/n);const s=this.ctx.createBufferSource();s.buffer=b;const fl=this.ctx.createBiquadFilter();fl.type='bandpass';fl.frequency.value=f;
    const g=this.ctx.createGain();g.gain.value=v;s.connect(fl);fl.connect(g);g.connect(this.gain);s.start()}catch(e){}}
  jump(){this.n(330,.18,.45,0,'triangle',300);this.noise(.12,.12,1800)} land(){this.noise(.1,.18,500)}
  swish(){this.noise(.12,.16,2600)} smash(){this.noise(.3,.4,400);this.n(110,.25,.35,0,'square',-60)}
  coin(i){const b=[988,1047,1175,1319,1397][i%5];this.n(b,.09,.32);this.n(b*2,.12,.14,.03)}
  shard(){[880,1175,1568,2093].forEach((f,i)=>this.n(f,.2,.32,i*.06))}
  shield(){this.n(520,.3,.3,0,'sine',400);this.n(780,.3,.2,.05,'sine',300)}
  dash(){this.n(220,.45,.45,0,'sawtooth',600);this.noise(.4,.25,1200)}
  hurt(){this.n(190,.25,.45,0,'sawtooth',-110);this.noise(.2,.3,300)}
  ready(){[659,784,988].forEach((f,i)=>this.n(f,.16,.35,i*.07))}
  over(){[392,330,262,196].forEach((f,i)=>this.n(f,.32,.35,i*.15,'triangle'))}
  win(){[523,659,784,1047,1319].forEach((f,i)=>this.n(f,.24,.38,i*.09,'triangle'))}
  tick(){this.n(1320,.05,.18)} ui(){this.n(660,.07,.25,0,'triangle')} comm(){this.n(1500,.04,.1);this.n(1900,.04,.08,.06)}
}

/* ---------------------------------------------------------------------
   TEXTURES (procedural canvas)
   --------------------------------------------------------------------- */
function cnv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
function tx(c,rep,srgb=true){const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);return t}
function grain(g,w,h,amp){const id=g.getImageData(0,0,w,h),d=id.data;for(let i=0;i<d.length;i+=4){const n=(Math.random()-.5)*amp;d[i]+=n;d[i+1]+=n;d[i+2]+=n}g.putImageData(id,0,0)}
function concreteCanvas(base,seams){const S=512,c=cnv(S,S),g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,S,S);grain(g,S,S,26);
  for(let i=0;i<70;i++){const k=Math.random()<.6?0:255;g.fillStyle=`rgba(${k},${k},${k},${rand(.02,.07)})`;g.beginPath();g.arc(rand(0,S),rand(0,S),rand(8,70),0,7);g.fill()}
  if(seams){g.strokeStyle='rgba(30,32,36,.45)';g.lineWidth=3;for(let y=0;y<=S;y+=S/2){g.beginPath();g.moveTo(0,y);g.lineTo(S,y);g.stroke()}
    g.strokeStyle='rgba(20,20,22,.25)';g.lineWidth=6;g.beginPath();g.moveTo(rand(0,S),0);for(let y=0;y<S;y+=40)g.lineTo(rand(150,360),y);g.stroke()}
  return c}
function laneCanvas(){const W=256,H=1024,c=cnv(W,H),g=c.getContext('2d');g.clearRect(0,0,W,H);
  const dash=(u,col,w,solid)=>{g.fillStyle=col;const x=u*W-w/2;if(solid){g.fillRect(x,0,w,H);return}for(let y=0;y<H;y+=H/5)g.fillRect(x,y,w,H/10)};
  dash(1/3,'rgba(255,255,255,.95)',5,false);dash(2/3,'rgba(255,255,255,.95)',5,false);dash(.012,'#ffb21a',7,true);dash(.988,'#ffb21a',7,true);
  const id=g.getImageData(0,0,W,H),d=id.data;for(let i=3;i<d.length;i+=4)if(d[i]>0)d[i]=d[i]*(.75+Math.random()*.25);g.putImageData(id,0,0);return c}
function facadeCanvas(style){const S=512,c=cnv(S,S),g=c.getContext('2d'),e=cnv(S,S),ge=e.getContext('2d');
  const st=[{f:'#eef0f2',a:'#6d97c4',b:'#173049',m:'#dadfe4',gf:.6},{f:'#d9c6a6',a:'#a08a66',b:'#2b261f',m:'#c6b392',gf:.56},{f:'#46505c',a:'#62b0c2',b:'#0f2a33',m:'#38404a',gf:.66},{f:'#a9bccd',a:'#8fbde3',b:'#1a3656',m:'#d4e0ea',gf:.9}][style];
  g.fillStyle=st.f;g.fillRect(0,0,S,S);grain(g,S,S,10);ge.fillStyle='#000';ge.fillRect(0,0,S,S);
  const cols=4,rows=4,cw=S/cols,rh=S/rows;
  for(let r=0;r<rows;r++)for(let k=0;k<cols;k++){const w=cw*st.gf,h=rh*(style===3?.86:.62),x=k*cw+(cw-w)/2,y=r*rh+(rh-h)/2;
    const gr=g.createLinearGradient(x,y,x+w*.4,y+h);gr.addColorStop(0,st.a);gr.addColorStop(1,st.b);g.fillStyle=gr;g.fillRect(x,y,w,h);
    g.fillStyle='rgba(255,255,255,.22)';g.beginPath();g.moveTo(x+w*.15,y);g.lineTo(x+w*.45,y);g.lineTo(x+w*.1,y+h);g.lineTo(x-w*.2,y+h);g.closePath();g.save();g.clip();g.fillRect(x,y,w,h);g.restore();
    g.fillStyle=st.m;g.fillRect(x+w/2-2,y,4,h);g.fillRect(x,y+h*.42,w,3);g.fillStyle='rgba(0,0,0,.25)';g.fillRect(x,y+h,w,4);
    const roll=Math.random();if(roll<.42){ge.fillStyle=roll<.32?`hsl(${rand(32,44)},90%,${rand(62,75)}%)`:`hsl(${rand(190,210)},70%,75%)`;ge.fillRect(x+2,y+2,w-4,h-4);
      if(Math.random()<.4){ge.fillStyle='rgba(0,0,0,.55)';ge.fillRect(x+2,y+2,w*.45,h-4)}}}
  for(let r=1;r<=rows;r++){g.fillStyle='rgba(0,0,0,.12)';g.fillRect(0,r*rh-6,S,6)}
  return{map:tx(c),em:tx(e)}}
function stripeCanvas(a,b){const S=256,c=cnv(S,64),g=c.getContext('2d');g.fillStyle=a;g.fillRect(0,0,S,64);g.fillStyle=b;
  for(let i=-2;i<10;i++){g.beginPath();g.moveTo(i*40,64);g.lineTo(i*40+20,64);g.lineTo(i*40+52,0);g.lineTo(i*40+32,0);g.closePath();g.fill()}grain(g,S,64,18);return c}
function adCanvas(kind){const c=cnv(512,256),g=c.getContext('2d');
  if(kind===0){const gr=g.createLinearGradient(0,0,512,256);gr.addColorStop(0,'#0c1626');gr.addColorStop(1,'#13324a');g.fillStyle=gr;g.fillRect(0,0,512,256);
    g.strokeStyle='#29e0f0';g.lineWidth=10;g.beginPath();g.ellipse(110,128,66,40,0,0,7);g.stroke();g.fillStyle='#29e0f0';g.beginPath();g.arc(110,128,20,0,7);g.fill();
    g.fillStyle='#fff';g.font='900 64px Archivo, Arial';g.fillText('HELIX',200,128);g.fillStyle='#29e0f0';g.font='800 22px Inter, Arial';g.fillText('WE SEE EVERYTHING',204,168)}
  else if(kind===1){g.fillStyle='#ff6b1a';g.fillRect(0,0,512,256);g.fillStyle='#fff';g.font='900 72px Archivo, Arial';g.fillText('N6',34,110);
    g.font='900 40px Archivo, Arial';g.fillText('HARBOR',34,170);g.fillText('COURIERS',34,214);g.fillStyle='rgba(255,255,255,.25)';g.beginPath();g.arc(420,130,90,0,7);g.fill()}
  else{g.fillStyle='#f4f1ea';g.fillRect(0,0,512,256);g.fillStyle='#132030';g.font='900 54px Archivo, Arial';g.fillText('LIGHTS OUT',30,110);
    g.fillStyle='#e5484d';g.font='800 26px Inter, Arial';g.fillText('GRID SHUTDOWN · 21:00',32,156);g.fillStyle='#132030';g.font='700 18px Inter, Arial';g.fillText('— HELIX ENERGY',32,204)}
  grain(g,512,256,8);return c}
function signCanvas(){const c=cnv(256,128),g=c.getContext('2d');g.fillStyle='#ffc21a';g.fillRect(0,0,256,128);g.fillStyle='#132030';g.fillRect(6,6,244,116);g.fillStyle='#ffc21a';g.fillRect(12,12,232,104);
  g.fillStyle='#132030';g.font='900 34px Archivo, Arial';g.textAlign='center';g.fillText('LOW',128,58);g.fillText('CLEARANCE',128,98);return c}
function coinCanvas(){const S=256,c=cnv(S,S),g=c.getContext('2d');const gr=g.createRadialGradient(100,90,10,128,128,130);gr.addColorStop(0,'#fff0b0');gr.addColorStop(.5,'#ffc93d');gr.addColorStop(1,'#c98a10');
  g.fillStyle=gr;g.fillRect(0,0,S,S);g.strokeStyle='#b97c0a';g.lineWidth=10;g.beginPath();g.arc(128,128,104,0,7);g.stroke();g.strokeStyle='#ffe58a';g.lineWidth=3;g.beginPath();g.arc(128,128,92,0,7);g.stroke();
  const star=(cx,cy,r,col)=>{g.fillStyle=col;g.beginPath();for(let i=0;i<10;i++){const rr=i%2?r*.45:r,a=-Math.PI/2+i*Math.PI/5;g.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr)}g.closePath();g.fill()};
  star(131,131,62,'#a86c05');star(128,128,62,'#ffd75a');return c}
function glowCanvas(){const c=cnv(128,128),g=c.getContext('2d'),gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.3,'rgba(255,255,255,.5)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);return c}
function cloudCanvas(){const c=cnv(256,128),g=c.getContext('2d');for(const[x,y,r]of[[90,80,44],[140,64,54],[190,82,40],[60,92,30],[120,94,36],[170,96,30]]){const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.95)');gr.addColorStop(.7,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill()}return c}
function netCanvas(){const c=cnv(128,128),g=c.getContext('2d');g.clearRect(0,0,128,128);g.strokeStyle='rgba(40,140,80,.9)';g.lineWidth=2;for(let i=0;i<=128;i+=16){g.beginPath();g.moveTo(i,0);g.lineTo(i,128);g.stroke();g.beginPath();g.moveTo(0,i);g.lineTo(128,i);g.stroke()}return c}
function brushedCanvas(){const c=cnv(256,256),g=c.getContext('2d');g.fillStyle='#b8c0c8';g.fillRect(0,0,256,256);for(let i=0;i<1400;i++){g.fillStyle=`rgba(${Math.random()<.5?255:60},${Math.random()<.5?255:60},${Math.random()<.5?255:70},.05)`;g.fillRect(0,rand(0,256),256,rand(.5,2))}return c}
function woodCanvas(){const c=cnv(256,256),g=c.getContext('2d');g.fillStyle='#b88a5c';g.fillRect(0,0,256,256);for(let y=0;y<256;y+=32){g.fillStyle=`hsl(28,${rand(35,45)}%,${rand(42,52)}%)`;g.fillRect(0,y,256,30);g.fillStyle='rgba(60,35,15,.5)';g.fillRect(0,y+30,256,2)}
  for(let i=0;i<500;i++){g.fillStyle='rgba(70,40,20,.08)';g.fillRect(0,rand(0,256),256,1)}return c}

/* ---------------------------------------------------------------------
   GEOMETRY CACHE + MATERIALS
   --------------------------------------------------------------------- */
const GEO=new Map();const q=v=>Math.round(v*200)/200;
function geo(k,f){let g=GEO.get(k);if(!g){g=f();GEO.set(k,g)}return g}
function mesh(g,m,cast=true){const o=new THREE.Mesh(g,m);o.castShadow=cast;o.receiveShadow=true;return o}
const box=(w,h,d,m,r=0)=>mesh(r>0?geo(`rb${q(w)},${q(h)},${q(d)},${q(r)}`,()=>new RoundedBoxGeometry(w,h,d,3,r)):geo(`b${q(w)},${q(h)},${q(d)}`,()=>new THREE.BoxGeometry(w,h,d)),m);
const cyl=(rt,rb,h,m,s=18)=>mesh(geo(`c${q(rt)},${q(rb)},${q(h)},${s}`,()=>new THREE.CylinderGeometry(rt,rb,h,s)),m);
const sph=(r,m,ws=20,hs=14)=>mesh(geo(`s${q(r)},${ws}`,()=>new THREE.SphereGeometry(r,ws,hs)),m);
const tor=(r,t,m,s=28)=>mesh(geo(`t${q(r)},${q(t)}`,()=>new THREE.TorusGeometry(r,t,10,s)),m);
function bgeo(w,h,d){w=Math.round(w*2)/2;h=Math.round(h*2)/2;d=Math.round(d*2)/2;
  return geo(`bg${w},${h},${d}`,()=>{const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv,sc=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
    for(let f=0;f<6;f++)for(let i=0;i<4;i++){const k=f*4+i;uv.setXY(k,uv.getX(k)*sc[f][0]/12,uv.getY(k)*sc[f][1]/12)}uv.needsUpdate=true;return g})}
function std(o){const m=new THREE.MeshStandardMaterial(o);m.envMapIntensity=o.envMapIntensity??.8;return m}

const glowTex=tx(glowCanvas()),cloudTex=tx(cloudCanvas());
const T={
  roof:tx(concreteCanvas('#b7bbbf',true),[3,10]),concrete:tx(concreteCanvas('#d4d3cf',false),[1,1]),parapet:tx(concreteCanvas('#e2e0db',false),[10,1]),
  lane:tx(laneCanvas()),hazard:tx(stripeCanvas('#ffb21a','#1b1f24'),[2,1]),hazardW:tx(stripeCanvas('#ffffff','#ff6b1a'),[2,1]),
  ad:[0,1,2].map(k=>tx(adCanvas(k))),sign:tx(signCanvas()),coin:tx(coinCanvas()),net:tx(netCanvas(),[8,2]),brushed:tx(brushedCanvas()),wood:tx(woodCanvas())
};
T.lane.wrapS=THREE.ClampToEdgeWrapping;
const FAC=[0,1,2,3].map(s=>facadeCanvas(s));
const M={
  roof:std({map:T.roof,roughness:.95,color:0xffffff}),
  roofGravel:std({color:0x8b8f94,roughness:1}),
  lane:new THREE.MeshStandardMaterial({map:T.lane,transparent:true,roughness:.7,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),
  parapet:std({map:T.parapet,roughness:.9}),
  cap:std({color:0xc8cdd3,roughness:.35,metalness:.85}),
  concrete:std({map:T.concrete,roughness:.92}),
  steel:std({map:T.brushed,color:0xd4d9de,roughness:.32,metalness:.9}),
  darkSteel:std({color:0x3a414b,roughness:.45,metalness:.75}),
  rubber:std({color:0x1c1f24,roughness:.9}),
  white:std({color:0xf3f5f7,roughness:.35}),
  plastic:std({color:0xe9edf1,roughness:.3,metalness:.05}),
  graphite:std({color:0x232a33,roughness:.35,metalness:.4}),
  wood:std({map:T.wood,roughness:.82}),
  woodDark:std({map:T.wood,color:0x8a6a4a,roughness:.85}),
  hazard:std({map:T.hazard,roughness:.6}),
  hazardW:std({map:T.hazardW,roughness:.55}),
  sign:std({map:T.sign,roughness:.5}),
  ad:T.ad.map(t=>std({map:t,emissive:0xffffff,emissiveMap:t,emissiveIntensity:.25,roughness:.45})),
  net:new THREE.MeshStandardMaterial({map:T.net,transparent:true,alphaTest:.3,side:THREE.DoubleSide,roughness:.9}),
  redE:std({color:0xff2a2a,emissive:0xff1a1a,emissiveIntensity:2.5}),
  cyanE:std({color:0x29e0f0,emissive:0x19c8e0,emissiveIntensity:2}),
  orangeE:std({color:0xff7a1a,emissive:0xff6a00,emissiveIntensity:1.8}),
  lamp:std({color:0xfff2d6,emissive:0xffd9a0,emissiveIntensity:0}),
  glassDark:std({color:0x1b2633,roughness:.08,metalness:.6}),
  coinEdge:std({color:0xffbf2e,roughness:.22,metalness:1,envMapIntensity:1.4}),
  coinFace:std({map:T.coin,bumpMap:T.coin,bumpScale:2.5,roughness:.28,metalness:.95,envMapIntensity:1.4}),
  shard:new THREE.MeshPhysicalMaterial({color:0x6ff0ff,emissive:0x16c4dc,emissiveIntensity:1.2,roughness:.05,metalness:.1,transmission:.0,clearcoat:1,transparent:true,opacity:.92}),
  shieldOrb:new THREE.MeshStandardMaterial({color:0x8fe8ff,emissive:0x2bb8e0,emissiveIntensity:.6,transparent:true,opacity:.35,depthWrite:false,roughness:.1}),
  bubble:new THREE.MeshStandardMaterial({color:0x9ef0ff,emissive:0x29c4ec,emissiveIntensity:.7,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide,roughness:.05}),
  dust:new THREE.MeshStandardMaterial({color:0xd8dde2,roughness:1,transparent:true,opacity:.7}),
  tower:new THREE.MeshStandardMaterial({color:0x3b4456,roughness:.6,metalness:.4,fog:false}),
  towerBeacon:new THREE.MeshStandardMaterial({color:0xff3a2a,emissive:0xff2a1a,emissiveIntensity:3,fog:false})
};
M.facade=FAC.map(f=>std({map:f.map,emissive:0xffffff,emissiveMap:f.em,emissiveIntensity:0,roughness:.5,metalness:.18,envMapIntensity:.7}));
M.brick=std({color:0xb46a52,roughness:.9});
const facMats=()=>{const r=Math.random();const m=r<.18?M.brick:M.facade[Math.floor(Math.random()*4)];return[m,m,M.roofGravel,M.roofGravel,m,m]};

/* ---------------------------------------------------------------------
   CHARACTER — skinned mocap runner with procedural jump / slide layers
   --------------------------------------------------------------------- */
const canon=n=>String(n).toLowerCase().replace(/^.*mixamorig\d*/,'').replace(/[^a-z0-9]/g,'');
function retarget(clip,model){if(!clip)return null;const map={};model.traverse(o=>{if(o.isBone)map[canon(o.name)]=o.name});
  const tracks=[];for(const t of clip.tracks){const i=t.name.lastIndexOf('.'),node=t.name.slice(0,i),prop=t.name.slice(i+1);if(prop!=='quaternion')continue;
    const tg=map[canon(node)];if(!tg)continue;const nt=t.clone();nt.name=tg+'.quaternion';tracks.push(nt)}
  return tracks.length>10?new THREE.AnimationClip(clip.name,clip.duration,tracks):null}
const _a=new V3(),_b=new V3(),_q1=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_q3=new THREE.Quaternion(),_wq=new THREE.Quaternion();
const _F=new V3(),_U=new V3(),_R=new V3(),_d=[0,1,2,3,4,5,6,7,8,9].map(()=>new V3());
let _di=0;function dv(...p){const o=_d[_di++%_d.length].set(0,0,0);for(let i=0;i<p.length;i+=2)o.addScaledVector(p[i],p[i+1]);return o.normalize()}

class Runner{
  constructor(id,label,gltfScene,clips){
    this.id=id;this.label=label;this.wrapper=new THREE.Group();this.body=new THREE.Group();this.pivot=new THREE.Group();
    this.wrapper.add(this.body);this.body.add(this.pivot);this.model=gltfScene;this.pivot.add(this.model);
    this.model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;
      for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;m.envMapIntensity=1.0;if(m.map)m.map.anisotropy=8}}});
    this.bones={};this.model.traverse(o=>{if(o.isBone)this.bones[canon(o.name)]=o});
    this.mixer=new THREE.AnimationMixer(this.model);this.actions={};this.w={};
    for(const[k,c]of Object.entries(clips))if(c){const a=this.mixer.clipAction(c);a.play();a.setEffectiveWeight(k==='idle'?1:0);this.actions[k]=a;this.w[k]=k==='idle'?1:0}
    this.jw=0;this.sw=0;this.dw=0;this.normalize();
  }
  bone(...names){for(const n of names)if(this.bones[n])return this.bones[n];return null}
  wpos(b,out){return b.getWorldPosition(out)}
  detectYaw(){
    try{return this._detectYaw()}catch(e){return 0}
  }
  _detectYaw(){
    const clip=this.actions.run?this.actions.run.getClip():(this.actions.idle?this.actions.idle.getClip():null);
    if(!clip)return 0;
    const pairs=[];
    for(const s of['left','right']){
      const f=this.bone(s+'foot'),t=this.bone(s+'toebase',s+'toeend');
      if(f&&t)pairs.push([f,t]);
    }
    if(!pairs.length)return 0;
    const a=new V3(),b=new V3(),acc=new V3();
    const saved={};for(const k in this.actions){saved[k]=this.actions[k].getEffectiveWeight();this.actions[k].setEffectiveWeight(k==='run'?1:0)}
    const dur=Math.max(.1,Math.min(clip.duration,2));
    for(let i=0;i<28;i++){
      this.mixer.setTime(dur*i/28);this.wrapper.updateMatrixWorld(true);
      for(const[f,t]of pairs){f.getWorldPosition(a);t.getWorldPosition(b);acc.x+=b.x-a.x;acc.z+=b.z-a.z}
    }
    for(const k in this.actions)this.actions[k].setEffectiveWeight(saved[k]);
    this.mixer.setTime(0);
    if(acc.lengthSq()<1e-7)return 0;
    return Math.PI-Math.atan2(acc.x,acc.z);
  }
  normalize(){
    this.mixer.update(.01);this.wrapper.updateMatrixWorld(true);
    this.pivot.rotation.y=this.detectYaw();
    this.wrapper.updateMatrixWorld(true);
    const foot=this.bone('leftfoot','rightfoot'),
          head=this.bone('head'),
          top=this.bone('headtopend'),
          toeEnd=this.bone('lefttoeend','lefttoebase','righttoeend','righttoebase');
    let h=0,g=0;
    if(head&&foot){
      const hy=top?this.wpos(top,_a).y:this.wpos(head,_a).y+.12;
      g=toeEnd?this.wpos(toeEnd,_b).y:this.wpos(foot,_b).y;
      h=hy-g;
    }
    if(!(h>.001&&h<1e5)){
      const bx=new THREE.Box3().setFromObject(this.model);
      h=bx.max.y-bx.min.y;g=bx.min.y;
    }
    if(!(h>.001)){return}
    this.pivot.scale.setScalar(1.76/h);
    this.wrapper.updateMatrixWorld(true);
    let gy;
    if(toeEnd)gy=this.wpos(toeEnd,_b).y-.015;
    else if(foot)gy=this.wpos(foot,_b).y-.085;
    else gy=new THREE.Box3().setFromObject(this.model).min.y;
    if(!isFinite(gy))gy=0;
    this.pivot.position.y-=gy;
    this.wrapper.updateMatrixWorld(true);
  }
  validate(){if(!this.actions.run)return false;
    for(const k in this.actions)this.actions[k].setEffectiveWeight(k==='run'?1:0);this.mixer.update(.25);this.wrapper.updateMatrixWorld(true);
    const hip=this.bone('hips'),head=this.bone('head'),lf=this.bone('leftfoot'),rf=this.bone('rightfoot'),lh=this.bone('lefthand');
    let ok=!!(hip&&head&&lf&&rf);
    if(ok){const H=this.wpos(hip,new V3()).y,Hd=this.wpos(head,new V3()).y,L=this.wpos(lf,new V3()).y,R=this.wpos(rf,new V3()).y;
      ok=Hd>H+.35&&Hd<2.3&&L<H-.35&&R<H-.35&&H>.6&&H<1.3;if(lh){const Y=this.wpos(lh,new V3()).y;ok=ok&&Y>.3&&Y<2.1}}
    for(const k in this.actions)this.actions[k].setEffectiveWeight(k==='idle'?1:0);this.w={};for(const k in this.actions)this.w[k]=k==='idle'?1:0;this.mixer.update(.01);return ok}
  aim(a,b,dir,w){const A=this.bones[a],B=this.bones[b];if(!A||!B||!A.parent||w<.01)return;
    A.getWorldPosition(_a);B.getWorldPosition(_b);_b.sub(_a);if(_b.lengthSq()<1e-10)return;_b.normalize();
    _q1.setFromUnitVectors(_b,dir);_q2.identity().slerp(_q1,w);A.getWorldQuaternion(_q3);_q3.premultiply(_q2);
    A.parent.getWorldQuaternion(_q1).invert();A.quaternion.copy(_q1.multiply(_q3));A.updateMatrixWorld(true)}
  update(dt,s){
    const want={idle:0,run:0,dance:0};
    if(s.mode==='title'||s.mode==='celebrate')want[this.actions.dance?'dance':'idle']=1;
    else if(s.mode==='idle'||s.mode==='dead')want.idle=1;else want.run=1;
    for(const k in this.actions){this.w[k]=damp(this.w[k]||0,want[k]||0,s.mode==='dead'?4:9,dt);this.actions[k].setEffectiveWeight(this.w[k])}
    if(this.actions.run)this.actions.run.setEffectiveTimeScale(s.mode==='jump'?.3:clamp(s.speed/11.5,.8,1.55));
    this.mixer.update(dt);
    this.jw=damp(this.jw,s.mode==='jump'?1:0,14,dt);this.sw=damp(this.sw,s.mode==='slide'?1:0,18,dt);this.dw=damp(this.dw,s.mode==='dead'?1:0,3.2,dt);
    const lv=clamp(s.laneVel||0,-10,10);
    this.wrapper.position.set(s.x||0,s.alt||0,s.z||0);this.wrapper.rotation.set(0,(s.yaw||0)-lv*.02,-lv*.034);
    this.body.position.y=-.8*this.sw;this.body.rotation.x=1.45*sstep(this.dw);
    this.wrapper.updateMatrixWorld(true);
    if(this.jw>.01||this.sw>.01){this.wrapper.getWorldQuaternion(_wq);_F.set(0,0,-1).applyQuaternion(_wq);_U.set(0,1,0).applyQuaternion(_wq);_R.set(1,0,0).applyQuaternion(_wq);
      const j=this.jw*(1-this.sw),sl=this.sw;
      if(j>.01){
        this.aim('leftupleg','leftleg',dv(_F,.9,_U,-.5),j);this.aim('leftleg','leftfoot',dv(_U,-.85,_F,-.55),j);
        this.aim('rightupleg','rightleg',dv(_U,-.85,_F,-.35),j);this.aim('rightleg','rightfoot',dv(_U,-.5,_F,-.85),j);
        this.aim('leftarm','leftforearm',dv(_U,.55,_F,.25,_R,-.8),j*.7);this.aim('rightarm','rightforearm',dv(_U,.55,_F,.25,_R,.8),j*.7)}
      if(sl>.01){
        this.aim('spine','spine1',dv(_U,.78,_F,-.62),sl*.9);
        this.aim('leftupleg','leftleg',dv(_F,1,_U,-.08,_R,-.12),sl);this.aim('leftleg','leftfoot',dv(_F,1,_U,-.04),sl);
        this.aim('rightupleg','rightleg',dv(_F,1,_U,-.05,_R,.12),sl);this.aim('rightleg','rightfoot',dv(_F,1,_U,-.02),sl);
        this.aim('leftarm','leftforearm',dv(_U,-.45,_F,-.5,_R,-.6),sl);this.aim('rightarm','rightforearm',dv(_U,-.45,_F,-.5,_R,.6),sl)}}
  }
}

/* ---------------------------------------------------------------------
   MATERIAL CLEANER — keeps the suit's real colors, scrubs baked rust
   --------------------------------------------------------------------- */
function cleanifyModel(model){
  const seen=new Set();
  const rebuild=(tex)=>{
    if(!tex||seen.has(tex.uuid))return null; seen.add(tex.uuid);
    const img=tex.image; if(!img)return null;
    const w=img.width||256,h=img.height||256,c=cnv(w,h),g=c.getContext('2d');
    try{g.drawImage(img,0,0,w,h)}catch(e){return null}
    let data;
    try{data=g.getImageData(0,0,w,h)}catch(e){return null}
    const p=data.data;
    for(let i=0;i<p.length;i+=4){
      let r=p[i],gg=p[i+1],b=p[i+2];
      const l=r*.299+gg*.587+b*.114;
      if(r>gg&&gg>=b&&(r-b)>14&&l<215){
        const k=.82;
        r=r*(1-k)+(l-6)*k;
        gg=gg*(1-k)+l*k;
        b=b*(1-k)+(l+12)*k;
      }
      p[i]  =clamp((r-128)*1.07+122,0,255);
      p[i+1]=clamp((gg-128)*1.07+126,0,255);
      p[i+2]=clamp((b-128)*1.07+132,0,255);
    }
    g.putImageData(data,0,0);
    const nt=new THREE.CanvasTexture(c);
    nt.colorSpace=THREE.SRGBColorSpace; nt.anisotropy=8;
    nt.flipY=tex.flipY; nt.wrapS=tex.wrapS; nt.wrapT=tex.wrapT;
    if(tex.repeat)nt.repeat.copy(tex.repeat);
    if(tex.offset)nt.offset.copy(tex.offset);
    return nt;
  };
  model.traverse(o=>{
    if(!o.isMesh||!o.material)return;
    const src=Array.isArray(o.material)?o.material:[o.material];
    const out=src.map(m=>{
      if(!m)return m;
      const n=(m.clone)?m.clone():m;
      if(n.map){const nt=rebuild(n.map); n.map=nt||null}
      if(n.roughnessMap)n.roughnessMap=null;
      if(n.bumpMap)n.bumpMap=null;
      if(n.normalMap)n.normalMap=null;
      if(n.color)n.color.setHex(0xffffff);
      n.roughness=.42; n.metalness=.12; n.envMapIntensity=1.15;
      if(n.emissive)n.emissive.setHex(0x000000),n.emissiveIntensity=0;
      n.needsUpdate=true; return n;
    });
    o.material=Array.isArray(o.material)?out:out[0];
  });
}

/* ---------------------------------------------------------------------
   OBSTACLES
   --------------------------------------------------------------------- */
const OBS={
  barrier:{hits:[{w:1.85,y0:0,y1:.9,d:.6}],cat:'low'},crates:{hits:[{w:1.4,y0:0,y1:1.35,d:1.15}],cat:'low'},hvac:{hits:[{w:1.5,y0:0,y1:1.1,d:1.1}],cat:'low'},
  bot:{hits:[{w:1.1,y0:0,y1:1.2,d:1}],cat:'low',move:5},
  pipe:{hits:[{w:1.95,y0:1.2,y1:2.6,d:.5}],cat:'slide'},drone:{hits:[{w:1.4,y0:1.15,y1:2.2,d:1.1}],cat:'slide',bob:1},
  scaffold:{hits:[{w:7.4,y0:1.25,y1:3,d:1}],cat:'slide'},
  billboard:{hits:[{w:1.95,y0:0,y1:3,d:.6}],cat:'tall'},tank:{hits:[{w:1.9,y0:0,y1:3.8,d:1.9}],cat:'tall'},stair:{hits:[{w:1.95,y0:0,y1:2.8,d:1.6}],cat:'tall'}
};
function jerseyGeo(){return geo('jersey',()=>{const s=new THREE.Shape();s.moveTo(-.3,0);s.lineTo(.3,0);s.lineTo(.3,.08);s.lineTo(.13,.3);s.lineTo(.09,.86);s.lineTo(-.09,.86);s.lineTo(-.13,.3);s.lineTo(-.3,.08);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:1.8,bevelEnabled:true,bevelThickness:.02,bevelSize:.02,bevelSegments:2});g.translate(0,0,-.9);g.rotateY(Math.PI/2);g.computeVertexNormals();return g})}
function makeObstacle(type){const g=new THREE.Group();
  switch(type){
    case'barrier':{const j=mesh(jerseyGeo(),M.concrete);g.add(j);for(const s of[-1,1]){const b=box(1.7,.16,.02,M.hazardW);b.position.set(0,.55,s*.12);b.rotation.x=s*-.07;g.add(b)}
      const l=sph(.06,M.orangeE,10,8);l.position.set(-.7,.92,0);g.add(l);const l2=l.clone();l2.position.x=.7;g.add(l2);break}
    case'crates':{const pal=box(1.3,.14,1.1,M.woodDark);pal.position.y=.07;g.add(pal);
      const c1=box(1.2,.85,1,M.wood,.03);c1.position.y=.57;g.add(c1);
      for(const[x,y,w,h]of[[0,.57,1.24,.1],[0,.95,1.24,.08],[0,.19,1.24,.08]]){const s=box(w,h,1.04,M.woodDark);s.position.set(x,y,0);g.add(s)}
      for(const x of[-.57,.57]){const s=box(.1,.86,1.04,M.woodDark);s.position.set(x,.57,0);g.add(s)}
      const c2=box(.7,.45,.65,M.wood,.03);c2.position.set(.15,1.22,-.05);c2.rotation.y=.35;g.add(c2);
      const tag=box(.34,.22,.01,M.hazard);tag.position.set(-.25,.6,.51);g.add(tag);break}
    case'hvac':{const b=box(1.4,1,1,M.steel,.04);b.position.y=.55;g.add(b);const base=box(1.5,.08,1.1,M.darkSteel);base.position.y=.04;g.add(base);
      const ring=tor(.36,.035,M.darkSteel);ring.rotation.x=Math.PI/2;ring.position.y=1.06;g.add(ring);const hub=cyl(.08,.08,.05,M.graphite);hub.position.y=1.07;g.add(hub);
      const fan=new THREE.Group();fan.position.y=1.06;for(let i=0;i<4;i++){const bl=box(.3,.01,.08,M.graphite);bl.position.x=.15;const p=new THREE.Group();p.rotation.y=i*Math.PI/2;p.add(bl);fan.add(p)}g.add(fan);g.userData.fan=fan;
      for(let i=0;i<5;i++){const v=box(1.2,.03,.02,M.darkSteel);v.position.set(0,.25+i*.13,.51);g.add(v)}
      for(const s of[-1,1]){const p=cyl(.05,.05,.9,M.steel,10);p.position.set(s*.78,.45,.25);g.add(p)}break}
    case'bot':{const b=box(.95,.6,.85,M.plastic,.12);b.position.y=.52;g.add(b);const face=box(.6,.26,.04,M.graphite,.04);face.position.set(0,.62,.43);g.add(face);
      for(const s of[-1,1]){const e=sph(.045,M.cyanE,10,8);e.position.set(s*.13,.63,.46);g.add(e)}
      const pkg=box(.6,.34,.6,M.wood,.03);pkg.position.y=1;g.add(pkg);const tp=box(.62,.07,.62,M.hazard);tp.position.y=1;g.add(tp);
      for(const sx of[-1,1])for(const sz of[-1,1]){const w=cyl(.17,.17,.12,M.rubber);w.rotation.z=Math.PI/2;w.position.set(sx*.5,.18,sz*.3);g.add(w)}
      const ant=cyl(.012,.012,.4,M.steel,6);ant.position.set(-.3,1.35,.2);g.add(ant);const tip=sph(.045,M.orangeE,10,8);tip.position.set(-.3,1.57,.2);g.add(tip);break}
    case'pipe':{for(const s of[-1,1]){const p=box(.16,2.75,.22,M.darkSteel);p.position.set(s*.95,1.375,0);g.add(p);const f=box(.4,.06,.4,M.darkSteel);f.position.set(s*.95,.03,0);g.add(f)}
      const pp=cyl(.24,.24,2.2,M.steel,22);pp.rotation.z=Math.PI/2;pp.position.y=1.72;g.add(pp);for(const x of[-.6,.6]){const c=cyl(.27,.27,.08,M.darkSteel,22);c.rotation.z=Math.PI/2;c.position.set(x,1.72,0);g.add(c)}
      const sg=box(1.1,.5,.04,M.sign);sg.position.set(0,1.32,.05);g.add(sg);for(const x of[-.4,.4]){const ch=cyl(.01,.01,.22,M.darkSteel,6);ch.position.set(x,1.6,.05);g.add(ch)}
      const top=box(2.1,.1,.24,M.hazard);top.position.y=2.75;g.add(top);break}
    case'drone':{const d=new THREE.Group();d.position.y=1.68;g.add(d);g.userData.drone=d;
      const core=box(.7,.26,.6,M.graphite,.1);d.add(core);const shell=box(.56,.14,.5,M.white,.07);shell.position.y=.18;d.add(shell);
      const eye=sph(.09,M.redE,14,10);eye.position.set(0,-.02,.31);d.add(eye);const band=box(.5,.04,.02,M.cyanE);band.position.set(0,.06,.305);d.add(band);
      g.userData.rotors=[];for(const sx of[-1,1])for(const sz of[-1,1]){const arm=box(.42,.05,.06,M.darkSteel);arm.position.set(sx*.42,.05,sz*.32);arm.rotation.y=sx*sz*.5;d.add(arm);
        const hub=cyl(.05,.05,.08,M.darkSteel,10);hub.position.set(sx*.6,.1,sz*.45);d.add(hub);
        const rot=mesh(geo('rotor',()=>new THREE.CircleGeometry(.24,24)),new THREE.MeshBasicMaterial({color:0x9aa4b0,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false}),false);
        rot.rotation.x=-Math.PI/2;rot.position.set(sx*.6,.15,sz*.45);d.add(rot);g.userData.rotors.push(rot)}
      const cone=mesh(geo('scancone',()=>new THREE.ConeGeometry(.7,1.6,24,1,true)),new THREE.MeshBasicMaterial({color:0xff3a3a,transparent:true,opacity:.12,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),false);
      cone.position.y=-.85;d.add(cone);break}
    case'scaffold':{for(const s of[-1,1])for(const zz of[-.45,.45]){const p=cyl(.06,.06,3,M.steel,10);p.position.set(s*3.6,1.5,zz);g.add(p)}
      for(const zz of[-.45,.45])for(const y of[1.28,2.95]){const b=cyl(.05,.05,7.3,M.steel,10);b.rotation.z=Math.PI/2;b.position.set(0,y,zz);g.add(b)}
      const tape=box(7.3,.16,.02,M.hazard);tape.position.set(0,1.28,.5);g.add(tape);const plank=box(7.3,.07,1,M.woodDark);plank.position.y=3.02;g.add(plank);
      const net=mesh(geo('netp',()=>new THREE.PlaneGeometry(7.2,1.6)),M.net,false);net.position.set(0,2.15,.46);g.add(net);
      const bucket=cyl(.17,.14,.32,M.orangeE,14);bucket.position.set(2.6,3.21,0);g.add(bucket);break}
    case'billboard':{for(const s of[-1,1]){const l=box(.12,3,.12,M.darkSteel);l.position.set(s*.9,1.5,0);g.add(l)}
      const back=box(1.95,1.9,.12,M.darkSteel,.02);back.position.y=1.95;g.add(back);
      const ad=M.ad[Math.floor(Math.random()*3)];const f=box(1.85,1.8,.02,ad);f.position.set(0,1.95,.075);g.add(f);const f2=f.clone();f2.position.z=-.075;f2.rotation.y=Math.PI;g.add(f2);
      const lip=box(2,.08,.3,M.steel);lip.position.y=2.94;g.add(lip);const lt=sph(.06,M.lamp,8,6);lt.position.set(0,3.0,.18);g.add(lt);
      const base=box(2,.18,.7,M.concrete);base.position.y=.09;g.add(base);break}
    case'tank':{const t=cyl(.88,.88,1.8,M.wood,22);t.position.y=2.45;g.add(t);const lid=cyl(.06,.98,.55,M.woodDark,22);lid.position.y=3.62;g.add(lid);
      for(const y of[1.85,2.45,3.05]){const b=tor(.89,.035,M.darkSteel,32);b.rotation.x=Math.PI/2;b.position.y=y;g.add(b)}
      for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4,l=cyl(.07,.07,1.6,M.darkSteel,8);l.position.set(Math.cos(a)*.62,.8,Math.sin(a)*.62);g.add(l)}
      const deck=cyl(.95,.95,.1,M.darkSteel,22);deck.position.y=1.55;g.add(deck);const lad=box(.3,1.6,.04,M.steel);lad.position.set(0,2.4,.92);g.add(lad);break}
    case'stair':{const b=box(1.9,2.6,1.4,M.concrete,.04);b.position.y=1.3;g.add(b);const r=box(2.05,.12,1.55,M.cap);r.position.y=2.66;g.add(r);
      const d=box(.8,1.75,.05,M.steel,.02);d.position.set(0,.88,.71);g.add(d);const k=sph(.04,M.darkSteel,8,6);k.position.set(.28,.9,.75);g.add(k);
      const lt=box(.3,.12,.1,M.lamp);lt.position.set(0,1.95,.72);g.add(lt);const v=box(.5,.32,.05,M.darkSteel);v.position.set(-.5,2.2,.71);g.add(v);break}
  }
  g.traverse(o=>{if(o.isMesh&&o.castShadow!==false){o.castShadow=true;o.receiveShadow=true}});return g}

/* pickups */
const COIN_EDGE=new THREE.LatheGeometry([new THREE.Vector2(.2,-.032),new THREE.Vector2(.227,-.028),new THREE.Vector2(.238,0),new THREE.Vector2(.227,.028),new THREE.Vector2(.2,.032)],32);
const COIN_FACE=new THREE.CircleGeometry(.205,32);
function makePickup(type){const g=new THREE.Group();
  if(type==='coin'){const e=mesh(COIN_EDGE,M.coinEdge);e.rotation.x=Math.PI/2;g.add(e);const f=mesh(COIN_FACE,M.coinFace);f.position.z=.032;g.add(f);const b=mesh(COIN_FACE,M.coinFace);b.rotation.y=Math.PI;b.position.z=-.032;g.add(b)}
  else if(type==='shard'){const c=mesh(geo('shard',()=>new THREE.OctahedronGeometry(.3,0)),M.shard);c.scale.set(1,1.7,1);g.add(c);
    const r=tor(.5,.02,M.cyanE,40);r.rotation.x=Math.PI/2;g.add(r);g.userData.ring=r;
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0x3ef0ff,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));s.scale.set(2.2,2.2,1);g.add(s)}
  else if(type==='shield'){const o=sph(.42,M.shieldOrb,28,20);g.add(o);const ic=new THREE.Shape();ic.moveTo(0,.26);ic.lineTo(.2,.18);ic.lineTo(.2,0);ic.quadraticCurveTo(.18,-.18,0,-.28);ic.quadraticCurveTo(-.18,-.18,-.2,0);ic.lineTo(-.2,.18);ic.closePath();
    const sm=mesh(geo('shieldIcon',()=>new THREE.ExtrudeGeometry(ic,{depth:.06,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:2})),M.cyanE);sm.position.z=-.03;g.add(sm);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0x6fdcff,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:.7}));s.scale.set(1.8,1.8,1);g.add(s)}
  return g}

/* ---------------------------------------------------------------------
   WORLD PIECES
   --------------------------------------------------------------------- */
function propWaterTower(){const g=new THREE.Group();const t=cyl(1,1,1.7,M.wood,20);t.position.y=2.1;g.add(t);const lid=cyl(.06,1.1,.5,M.woodDark,20);lid.position.y=3.2;g.add(lid);
  for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4,l=cyl(.06,.06,1.3,M.darkSteel,8);l.position.set(Math.cos(a)*.7,.65,Math.sin(a)*.7);g.add(l)}return g}
function propHVAC(){const g=new THREE.Group();const b=box(1.8,1,1.3,M.steel,.05);b.position.y=.5;g.add(b);const f=cyl(.42,.42,.06,M.darkSteel,20);f.position.y=1.03;g.add(f);return g}
function propAntenna(){const g=new THREE.Group();const p=cyl(.05,.08,4,M.steel,8);p.position.y=2;g.add(p);const t=sph(.12,M.redE,10,8);t.position.y=4.05;g.add(t);const d=cyl(.4,.06,.18,M.white,14);d.position.set(.25,2.8,0);d.rotation.z=-1;g.add(d);return g}
function propBillboard(side){const g=new THREE.Group();for(const x of[-2.6,2.6]){const l=box(.18,2.5,.18,M.darkSteel);l.position.set(x,1.25,0);g.add(l)}
  const ad=pick(M.ad);const p=box(6.2,3,.15,ad);p.position.y=3.9;g.add(p);const fr=box(6.4,.12,.4,M.steel);fr.position.y=5.45;g.add(fr);
  for(const x of[-2,0,2]){const l=sph(.1,M.lamp,8,6);l.position.set(x,5.55,.3);g.add(l)}
  g.rotation.y=side<0?Math.PI/2-.55:-(Math.PI/2-.55);return g}
function propGarden(){const g=new THREE.Group();const pl=box(2.4,.5,1.2,M.woodDark);pl.position.y=.25;g.add(pl);
  for(let i=0;i<5;i++){const b=sph(rand(.3,.5),std({color:new THREE.Color().setHSL(rand(.25,.35),.5,rand(.3,.42)),roughness:.9}),10,8);b.position.set(rand(-.9,.9),.7,rand(-.3,.3));g.add(b)}return g}
function randomProp(side){const r=Math.random();const g=r<.24?propWaterTower():r<.46?propHVAC():r<.62?propAntenna():r<.8?propGarden():propBillboard(side);
  g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false}});return g}

class Tile{
  constructor(scene){this.g=new THREE.Group();scene.add(this.g);this.dyn=new THREE.Group();this.g.add(this.dyn);const L=TILE;
    const roof=mesh(geo('roof',()=>new THREE.BoxGeometry(9,.6,L)),M.roof,false);roof.position.y=-.3;this.g.add(roof);
    const lane=mesh(geo('lanep',()=>new THREE.PlaneGeometry(6.45,L)),M.lane,false);lane.rotation.x=-Math.PI/2;lane.position.y=.004;this.g.add(lane);
    for(const s of[-1,1]){const gr=mesh(geo('gravel',()=>new THREE.BoxGeometry(.95,.04,L)),M.roofGravel,false);gr.position.set(s*3.75,.02,0);this.g.add(gr);
      const p=mesh(geo('parapet',()=>new THREE.BoxGeometry(.36,1.05,L)),M.parapet,true);p.position.set(s*4.42,.525,0);this.g.add(p);
      const c=mesh(geo('pcap',()=>new THREE.BoxGeometry(.46,.06,L)),M.cap,false);c.position.set(s*4.42,1.08,0);this.g.add(c)}
    const body=mesh(bgeo(9.3,40,L),facMats(),false);body.position.y=-20.6;this.g.add(body);this.body=body}
  populate(){this.dyn.clear();const L=TILE;this.body.material=facMats();let props=0;
    for(const s of[-1,1]){for(let z=-L/2+rand(1,5);z<L/2-1;z+=rand(5,9)){const r=Math.random(),x=s*3.75;
        if(r<.3){const v=cyl(.14,.14,rand(.5,1.1),M.steel,10);v.position.set(x+rand(-.2,.2),v.geometry.parameters.height/2,z);this.dyn.add(v);const c=cyl(.22,.16,.12,M.darkSteel,10);c.position.set(v.position.x,v.geometry.parameters.height+.06,z);this.dyn.add(c)}
        else if(r<.55){const lp=new THREE.Group();const pole=cyl(.04,.05,2.6,M.darkSteel,8);pole.position.y=1.3;lp.add(pole);const arm=box(.6,.05,.05,M.darkSteel);arm.position.set(-s*.28,2.6,0);lp.add(arm);
          const hd=box(.28,.08,.16,M.lamp);hd.position.set(-s*.55,2.56,0);lp.add(hd);lp.position.set(x,0,z);this.dyn.add(lp)}
        else if(r<.7){const b=box(.8,.45,.6,M.steel,.03);b.position.set(x,.225,z);this.dyn.add(b)}}}
    for(const side of[-1,1]){let z=-L/2+rand(0,2);
      while(z<L/2-2){const w=rand(5,10),d=rand(6,9),gap=rand(1.6,3.6),top=Math.random()<.35?rand(-10,-2):rand(1,18),h=top+44;
        const m=mesh(bgeo(d,h,w),facMats(),false);m.castShadow=top>0;m.position.set(side*(4.75+gap+d/2),top-h/2,z+w/2);this.dyn.add(m);
        if(top>-1&&props<5&&Math.random()<.62){const p=randomProp(side);p.position.set(m.position.x+rand(-d*.2,d*.2),top,m.position.z+rand(-w*.15,w*.15));this.dyn.add(p);props++}
        z+=w+rand(.8,2.6)}
      for(let z2=-L/2+rand(0,6);z2<L/2;){const w=rand(9,15),d=rand(8,13),top=rand(8,40),h=top+44;const m=mesh(bgeo(d,h,w),facMats(),false);m.castShadow=false;
        m.position.set(side*(18+rand(0,8)+d/2),top-h/2,z2+w/2);this.dyn.add(m);z2+=w+rand(1,4)}}}
}

/* =====================================================================
   GAME
   ===================================================================== */
class Game{
  constructor(){
    this.W=innerWidth;this.H=innerHeight;this.isTouch=matchMedia('(pointer:coarse)').matches||'ontouchstart'in window;if(this.isTouch)document.body.classList.add('touch');
    this.sfx=new Sfx();
    this.save={unlocked:+store.g('rr_unlocked','1')||1,stars:JSON.parse(store.g('rr_stars','[0,0,0,0]')),coins:+store.g('rr_coins','0')||0,shards:+store.g('rr_shards','0')||0,best:+store.g('rr_best','0')||0};
    this.selCh=Math.min(this.save.unlocked,STORY.length)-1;this.runnerId='jane';
    this.state='loading';this.frames=0;this.ts=1;this.tsT=1;this.tsHold=0;this.t=0;
    this.obs=[];this.picks=[];this.pool={coin:[],shard:[],shield:[]};this.frags=[];this.fragPool=[];
    this.camPos=new V3(0,2,-4);this.camLook=new V3(0,1,0);this.fov=50;this.shake=0;this.camKick=0;
    this.ft=[];for(let i=0;i<10;i++){const d=document.createElement('div');d.className='ft';$('ftl').appendChild(d);this.ft.push(d)}this.ftI=0;
    this.initRenderer();this.bindUI();this.boot();
  }
  async boot(){
    try{
      await this.loadAssets();
    }catch(e){
      console.error(e);this.fatal('Could not load the 3D assets.',e);return;
    }
    try{this.buildWorld()}catch(e){console.error('world',e)}
    try{this.buildRunners()}catch(e){console.error('runners',e)}
    if(!this.runners||!Object.keys(this.runners).length){
      this.fatal('The runner character failed to build.',null);return;
    }
    try{this.applyPalette('morning',true)}catch(e){console.error('palette',e)}
    try{this.resetRun()}catch(e){console.error('reset',e)}
    try{this.makeSnapshots()}catch(e){console.error('snapshots',e)}
    try{this.toTitle()}catch(e){console.error('title',e)}
    this.prev=performance.now();requestAnimationFrame(t=>this.loop(t));
  }
  fatal(msg,err){
    const box=$('ld-err');box.classList.add('on');
    box.innerHTML='<b>'+msg+'</b><br><small>'+(err&&err.message?err.message:'')+'</small><br><br>';
    const a=document.createElement('a');a.href='./';a.textContent='RELOAD';
    a.style.cssText='display:inline-block;background:#ff6b1a;color:#fff;padding:9px 20px;border-radius:999px;text-decoration:none;font-weight:800;letter-spacing:.14em;font-size:12px';
    box.appendChild(a);
    $('ld-fill').style.width='100%';
    $('loader').querySelector('.msg').textContent='LOADING STOPPED';
  }

  initRenderer(){
    const r=this.renderer=new THREE.WebGLRenderer({canvas:$('gl'),antialias:true,powerPreference:'high-performance'});
    this.dprMax=this.isTouch?1.6:2;r.setPixelRatio(Math.min(devicePixelRatio||1,this.dprMax));r.setSize(this.W,this.H,false);
    r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1;
    const s=this.scene=new THREE.Scene();s.fog=new THREE.Fog(0xcfe2f2,70,290);
    this.camera=new THREE.PerspectiveCamera(50,this.W/this.H,.1,900);
    this.hemi=new THREE.HemisphereLight(0xd7eaff,0x8e8678,1);s.add(this.hemi);
    const sun=this.sun=new THREE.DirectionalLight(0xfff1da,3);sun.castShadow=true;const sm=this.isTouch?1024:2048;sun.shadow.mapSize.set(sm,sm);
    Object.assign(sun.shadow.camera,{near:1,far:90,left:-14,right:14,top:18,bottom:-18});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;s.add(sun);s.add(sun.target);
    this.rim=new THREE.DirectionalLight(0xbfd8ff,.8);this.rim.position.set(-6,5,-8);s.add(this.rim);
    this.turboLight=new THREE.PointLight(0xff7a1a,0,8,2);s.add(this.turboLight);
  }
  async loadAssets(){
    const prog={soldier:0,michelle:0,hdr:0,wood:0,brick:0},wts={soldier:3,michelle:4,hdr:2,wood:.5,brick:.5};
    const show=()=>{let s=0,t=0;for(const k in prog){s+=prog[k]*wts[k];t+=wts[k]}const p=Math.round(s/t*100);$('ld-fill').style.width=p+'%';$('ld-msg').textContent='LOADING HARBOR CITY · '+p+'%'};
    const tryLoad=async(loader,path,key)=>{let err;for(const b of BASES){try{const r=await loader.loadAsync(b+path,e=>{if(e&&e.total){prog[key]=e.loaded/e.total;show()}});prog[key]=1;show();return r}catch(e){err=e}}prog[key]=1;show();throw err};
    const gl=new GLTFLoader(),rg=new RGBELoader(),tl=new THREE.TextureLoader();
    const [sol,mic,hdr,wood,brick]=await Promise.allSettled([tryLoad(gl,'models/gltf/Soldier.glb','soldier'),tryLoad(gl,'models/gltf/Michelle.glb','michelle'),
      tryLoad(rg,'textures/equirectangular/venice_sunset_1k.hdr','hdr'),tryLoad(tl,'textures/hardwood2_diffuse.jpg','wood'),tryLoad(tl,'textures/brick_diffuse.jpg','brick')]);
    if(sol.status!=='fulfilled')throw sol.reason||new Error('Soldier model failed');
    this.gSoldier=sol.value;this.gMichelle=mic.status==='fulfilled'?mic.value:null;
    const pm=new THREE.PMREMGenerator(this.renderer);
    if(hdr.status==='fulfilled'){hdr.value.mapping=THREE.EquirectangularReflectionMapping;this.scene.environment=pm.fromEquirectangular(hdr.value).texture;hdr.value.dispose()}
    else this.scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture;pm.dispose();
    if(wood.status==='fulfilled'){const t=wood.value;t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;M.wood.map=t;M.wood.needsUpdate=true;M.woodDark.map=t;M.woodDark.needsUpdate=true}
    if(brick.status==='fulfilled'){const t=brick.value;t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,4);t.anisotropy=8;M.brick.map=t;M.brick.color.set(0xffffff);M.brick.needsUpdate=true}
  }
  buildRunners(){
    const clips=this.gSoldier.animations,find=n=>clips.find(c=>c.name.toLowerCase()===n);
    let r=null;
    if(this.gMichelle){try{const sc=this.gMichelle.scene;
      const j=new Runner('jane','JANE',sc,{idle:retarget(find('idle'),sc),run:retarget(find('run'),sc),dance:this.gMichelle.animations[0]||null});
      if(j.actions.run&&j.validate())r=j;else console.warn('Jane rig validation failed — using fallback rig')}catch(e){console.warn('Jane setup failed',e)}}
    if(!r)r=new Runner('jane','JANE',this.gSoldier.scene,{idle:find('idle'),run:find('run')});
    this.runners={jane:r};
    cleanifyModel(r.model);
    this.scene.add(r.wrapper);r.wrapper.visible=false;
    this.setRunner('jane');
    this.bubble=mesh(geo('bubble',()=>new THREE.SphereGeometry(1.15,32,20)),M.bubble,false);this.bubble.visible=false;this.scene.add(this.bubble);
  }
  setRunner(id){if(!this.runners[id])return;
    this.runnerId=id;this.runner=this.runners[id];this.runner.wrapper.visible=true;
    $('hname').textContent=this.runner.label;$('logo-name').textContent=this.runner.label;
    if(this.avatars&&this.avatars[id])$('ava').getContext('2d').drawImage(this.avatars[id],0,0,128,128)}

  buildWorld(){const s=this.scene;
    this.skyU={top:{value:new THREE.Color()},mid:{value:new THREE.Color()},bot:{value:new THREE.Color()},sunCol:{value:new THREE.Color()},sunDir:{value:new V3(0,1,0)}};
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(600,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:this.skyU,
      vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform vec3 top,mid,bot,sunCol,sunDir;varying vec3 vP;void main(){vec3 d=normalize(vP);float h=d.y;
        vec3 c=mix(mid,top,smoothstep(0.02,.6,h));c=mix(bot,c,smoothstep(-.06,.16,h));
        float s=max(dot(d,normalize(sunDir)),0.);c+=sunCol*(pow(s,900.)*6.+pow(s,24.)*.45+pow(s,4.)*.08);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`}));this.sky.frustumCulled=false;this.sky.renderOrder=-1;s.add(this.sky);
    this.clouds=[];for(let i=0;i<9;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,transparent:true,depthWrite:false,fog:false,opacity:.85}));
      const a=rand(-1.3,1.3),rr=rand(200,340);sp.position.set(Math.sin(a)*rr,rand(40,95),-Math.cos(a)*rr);const sc=rand(60,130);sp.scale.set(sc,sc*.45,1);s.add(sp);this.clouds.push(sp)}
    for(let i=0;i<60;i++){const a=rand(0,Math.PI*2),rr=rand(110,230),x=Math.cos(a)*rr,z=Math.sin(a)*rr;if(Math.abs(x)<24&&z<0)continue;
      const w=rand(10,26),d=rand(10,26),top=rand(20,95),h=top+44;const m=mesh(bgeo(w,h,d),[M.facade[pick([0,2,3,3])],M.facade[0],M.roofGravel,M.roofGravel,M.facade[3],M.facade[3]],false);
      m.position.set(x,top-h/2,z);s.add(m)}
    this.tower=this.makeTower();s.add(this.tower);
    this.tiles=[];for(let i=0;i<NTILES;i++){const t=new Tile(s);t.g.position.z=45-i*TILE;t.populate();this.tiles.push(t)}
    this.pal={};const p0=PALS.morning;for(const k of['top','mid','bot','fog','sun','hemiS','hemiG','cloud'])this.pal[k]=new THREE.Color(p0[k]);
    for(const k of['fogN','fogF','sunI','hemiI','night','exp'])this.pal[k]=p0[k];this.pal.sunDir=new V3(...p0.sunDir).normalize();this.palTarget=p0;
  }
  makeTower(){const g=new THREE.Group();const H=150;
    for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;const leg=mesh(geo('tleg',()=>new THREE.CylinderGeometry(.6,1.4,H,8)),M.tower,false);
      leg.position.set(Math.cos(a)*7,H/2,Math.sin(a)*7);leg.rotation.z=Math.cos(a)*-.045;leg.rotation.x=Math.sin(a)*.045;g.add(leg)}
    for(let y=10;y<H;y+=14){const k=1-y/H*.85;const r=mesh(geo('tring'+y,()=>new THREE.TorusGeometry(10*k,.35,6,4)),M.tower,false);r.rotation.x=Math.PI/2;r.rotation.z=Math.PI/4;r.position.y=y;g.add(r)}
    const pod=mesh(geo('tpod',()=>new THREE.CylinderGeometry(5,3.5,6,16)),M.tower,false);pod.position.y=H+2;g.add(pod);
    const spire=mesh(geo('tspire',()=>new THREE.CylinderGeometry(.25,.9,30,8)),M.tower,false);spire.position.y=H+20;g.add(spire);
    const bc=mesh(geo('tbeacon',()=>new THREE.SphereGeometry(1.6,16,12)),M.towerBeacon,false);bc.position.y=H+36;g.add(bc);
    this.beaconGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xff4a2a,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,transparent:true}));this.beaconGlow.scale.set(30,30,1);this.beaconGlow.position.y=H+36;g.add(this.beaconGlow);
    g.position.set(26,-30,-420);return g}
  applyPalette(name,instant){this.palTarget=PALS[name];this.palName=name;if(instant)this.blendPalette(1e3)}
  blendPalette(dt){const t=this.palTarget,p=this.pal,k=1-Math.exp(-1.3*dt);
    for(const c of['top','mid','bot','fog','sun','hemiS','hemiG','cloud'])p[c].lerp(_tmpC.set(t[c]),k);
    for(const c of['fogN','fogF','sunI','hemiI','night','exp'])p[c]=lerp(p[c],t[c],k);p.sunDir.lerp(_a.set(...t.sunDir).normalize(),k).normalize();
    this.skyU.top.value.copy(p.top);this.skyU.mid.value.copy(p.mid);this.skyU.bot.value.copy(p.bot);this.skyU.sunCol.value.copy(p.sun);this.skyU.sunDir.value.copy(p.sunDir);
    this.scene.fog.color.copy(p.fog);this.scene.fog.near=p.fogN;this.scene.fog.far=p.fogF;
    this.sun.color.copy(p.sun);this.sun.intensity=p.sunI;this.hemi.color.copy(p.hemiS);this.hemi.groundColor.copy(p.hemiG);this.hemi.intensity=p.hemiI;
    this.renderer.toneMappingExposure=p.exp;
    for(const m of M.facade)m.emissiveIntensity=p.night*1.6;M.lamp.emissiveIntensity=.2+p.night*4;for(const m of M.ad)m.emissiveIntensity=.25+p.night*1.4;
    for(const c of this.clouds)c.material.color.copy(p.cloud);M.towerBeacon.emissiveIntensity=2+p.night*4}

  bindUI(){
    $('btn-story').onclick=()=>{this.sfx.wake();this.startStory(this.selCh)};
    $('btn-endless').onclick=()=>{this.sfx.wake();this.startEndless()};
    $('btn-pause').onclick=()=>this.togglePause();$('btn-resume').onclick=()=>this.togglePause();
    $('btn-restart').onclick=()=>this.retry();$('btn-menu').onclick=()=>this.toTitle();$('r-menu').onclick=()=>this.toTitle();
    $('btn-sound').onclick=()=>{this.sfx.wake();this.sfx.mute(!this.sfx.muted);this.soundLabel();this.sfx.ui()};this.soundLabel();
    $('btn-dev').onclick=()=>{this.sfx.ui();try{window.open(DEV_URL,'_blank','noopener,noreferrer')}catch(e){location.href=DEV_URL}};
    $('turbo-btn').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();this.in.dash=true});
    $('turbo').addEventListener('pointerdown',e=>{e.stopPropagation();this.in.dash=true});
    $('intro').addEventListener('pointerdown',()=>{if(this.state==='intro'&&this.introT>.5)this.beginRun()});
    this.in={left:false,right:false,jump:false,jumpHeld:false,dash:false};
    addEventListener('keydown',e=>{const c=e.code;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(c)&&!e.target.closest('button'))e.preventDefault();
      if(e.repeat)return;this.sfx.wake();
      if(c==='Escape'||c==='KeyP'){this.togglePause();return}
      const jump=c==='Space'||c==='ArrowUp'||c==='KeyW',left=c==='ArrowLeft'||c==='KeyA',right=c==='ArrowRight'||c==='KeyD',down=c==='ArrowDown'||c==='KeyS',dash=c==='ShiftLeft'||c==='ShiftRight'||c==='KeyE';
      if(this.state==='title'&&(c==='Enter')){this.startStory(this.selCh);return}
      if(this.state==='intro'&&(jump||c==='Enter')){if(this.introT>.3)this.beginRun();return}
      if(this.state==='pause'&&jump){this.togglePause();return}
      if(this.state!=='run')return;
      if(jump){this.in.jump=true;this.in.jumpHeld=true}if(left)this.in.left=true;if(right)this.in.right=true;
      if(down){this.hero.slideHold=true;this.hero.slideT=Math.max(this.hero.slideT,.5)}if(dash)this.in.dash=true});
    addEventListener('keyup',e=>{const c=e.code;if(c==='Space'||c==='ArrowUp'||c==='KeyW')this.in.jumpHeld=false;if((c==='ArrowDown'||c==='KeyS')&&this.hero)this.hero.slideHold=false});
    addEventListener('blur',()=>{this.in.jumpHeld=false;if(this.hero)this.hero.slideHold=false});
    addEventListener('resize',()=>this.onResize());if(window.visualViewport)visualViewport.addEventListener('resize',()=>this.onResize());
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.state==='run')this.togglePause()});
    let g=null;const cv=$('gl');
    cv.addEventListener('pointerdown',e=>{this.sfx.wake();if(this.state==='pause'){this.togglePause();return}if(this.state==='intro'&&this.introT>.5){this.beginRun();return}if(this.state!=='run')return;g={x:e.clientX,y:e.clientY,done:false,t:performance.now()}});
    cv.addEventListener('pointermove',e=>{if(!g||g.done||this.state!=='run')return;const dx=e.clientX-g.x,dy=e.clientY-g.y,th=Math.max(26,Math.min(this.W,this.H)*.05);if(Math.hypot(dx,dy)<th)return;g.done=true;
      if(Math.abs(dx)>Math.abs(dy)){if(dx>0)this.in.right=true;else this.in.left=true}else if(dy<0){this.in.jump=true;this.hero.jumpHoldT=.3}else this.hero.slideT=Math.max(this.hero.slideT,.75)});
    const up=()=>{if(!g)return;if(!g.done&&this.state==='run'){this.in.jump=true;this.hero.jumpHoldT=.18}g=null};
    addEventListener('pointerup',up);addEventListener('pointercancel',up);
    cv.addEventListener('contextmenu',e=>e.preventDefault());cv.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
    this.setupInstall();
  }
  soundLabel(){$('snd-label').textContent=this.sfx.muted?'SOUND OFF':'SOUND ON';$('btn-sound').style.opacity=this.sfx.muted?.6:1}
  setupInstall(){
    const standalone=matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true;
    const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    const safariMac=/^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent)&&!ios;
    let deferred=null;const show=v=>document.body.classList.toggle('can-install',v&&!standalone);
    if(ios||safariMac)show(true);
    addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;show(true)});
    addEventListener('appinstalled',()=>{deferred=null;show(false);this.toast('INSTALLED — FIND IT ON YOUR HOME SCREEN','gold')});
    $('btn-install').onclick=async()=>{this.sfx.ui();
      if(deferred){deferred.prompt();try{const r=await deferred.userChoice;if(r.outcome==='accepted')show(false)}catch(e){}deferred=null;return}
      const steps=ios?['Tap the <b>Share</b> button in Safari','Choose <b>Add to Home Screen</b>','Tap <b>Add</b> — launch it like any app']:
        safariMac?['Open the <b>File</b> menu in Safari','Choose <b>Add to Dock…</b>','Launch Rooftop Rush from your Dock']:
        ['Open your browser menu (⋮)','Choose <b>Install app</b> or <b>Add to Home screen</b>','Launch Rooftop Rush like any app'];
      $('modal-steps').innerHTML=steps.map((s,i)=>`<div><b>${i+1}</b><span>${s}</span></div>`).join('');$('modal').classList.add('on')};
    $('modal-close').onclick=()=>$('modal').classList.remove('on');
    if('serviceWorker'in navigator&&/^https?:/.test(location.protocol)){const reg=()=>navigator.serviceWorker.register('./sw.js').catch(()=>{});
      if(document.readyState==='complete')reg();else addEventListener('load',reg)}
  }
  renderTitleUI(){
    const ch=$('chapters');ch.innerHTML='';
    STORY.forEach((c,i)=>{const b=document.createElement('button');const lock=i>=this.save.unlocked;b.className='chap'+(lock?' lock':'')+(i===this.selCh?' sel':'');
      const st=this.save.stars[i]||0;b.innerHTML=`${lock?'🔒':i+1}<small>${c.title}</small><div class="st">${'★'.repeat(st)}${'☆'.repeat(lock?0:3-st)}</div>`;
      b.onclick=()=>{if(lock){this.toast('FINISH CHAPTER '+i+' TO UNLOCK');return}this.sfx.ui();this.selCh=i;this.renderTitleUI()};ch.appendChild(b)});
    $('story-label').textContent=`STORY · CH ${this.selCh+1} — ${STORY[this.selCh].title}`;
    $('logo-ch').textContent=this.save.unlocked>STORY.length?'4':String(this.selCh+1);
    $('w-coins').textContent=this.save.coins;$('w-shards').textContent=this.save.shards;$('w-stars').textContent=this.save.stars.reduce((a,b)=>a+b,0)+'/12';
    $('best-n').textContent=this.save.best?this.save.best+' m':'—';$('endless-best').textContent=this.save.best?'· BEST '+this.save.best+'m':'';
  }
  toast(msg,kind){const t=$('toast');t.textContent=msg;t.className=kind==='gold'?'gold':'';t.classList.add('show');clearTimeout(this._tt);this._tt=setTimeout(()=>t.classList.remove('show'),1700)}
  comm(text){const el=$('comms'),tx=$('cm-text');text=text.replace(/\{name\}/g,this.runner.label.charAt(0)+this.runner.label.slice(1).toLowerCase());
    clearInterval(this._ci);clearTimeout(this._ch);tx.textContent='';el.classList.add('show');this.sfx.comm();let i=0;
    this._ci=setInterval(()=>{i+=2;tx.textContent=text.slice(0,i);if(i>=text.length)clearInterval(this._ci)},28);
    this._ch=setTimeout(()=>el.classList.remove('show'),Math.max(3800,text.length*62))}
  hideComm(){clearInterval(this._ci);clearTimeout(this._ch);$('comms').classList.remove('show')}
  fxText(txt,pos,color){const v=_a.copy(pos).project(this.camera);if(v.z>1)return;const el=this.ft[this.ftI++%this.ft.length];el.textContent=txt;el.style.color=color;
    el.style.left=((v.x*.5+.5)*this.W)+'px';el.style.top=((-v.y*.5+.5)*this.H)+'px';el.classList.remove('go');void el.offsetWidth;el.classList.add('go')}
  flash(id){const f=$(id);f.classList.remove('on');void f.offsetWidth;f.classList.add('on')}
  setState(s){this.state=s;document.body.dataset.state=s;if(s!=='run'){document.body.classList.remove('turbo')}if(s!=='run'&&s!=='pause')this.hideComm()}
  onResize(){this.W=innerWidth;this.H=innerHeight;this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.dprMax));this.renderer.setSize(this.W,this.H,false);this.camera.aspect=this.W/this.H;this.camera.updateProjectionMatrix()}

  makeSnapshots(){this.avatars={};const r=this.renderer,cam=new THREE.PerspectiveCamera(28,1,.05,200),pr=r.getPixelRatio();
    this.blendPalette(1e3);
    this.sun.position.set(14,26,-22);this.sun.target.position.set(0,0,0);this.sun.target.updateMatrixWorld();
    const run=this.runner;
    try{
      run.update(.016,{mode:'idle',speed:0,x:0,alt:0});run.mixer.update(.6);run.wrapper.updateMatrixWorld(true);
      const head=run.bone('head');const hp=head?head.getWorldPosition(new V3()):new V3(0,1.6,0);
      r.setPixelRatio(1);r.setSize(128,128,false);cam.aspect=1;cam.fov=26;
      cam.position.set(hp.x+.28,hp.y+.06,hp.z-.95);cam.lookAt(hp.x,hp.y-.02,hp.z);cam.updateProjectionMatrix();
      this.sky.position.copy(cam.position);r.render(this.scene,cam);
      const a=cnv(128,128);a.getContext('2d').drawImage(r.domElement,0,0,128,128);this.avatars.jane=a;
      $('ava').getContext('2d').drawImage(a,0,0,128,128);
      r.setSize(320,272,false);cam.aspect=320/272;cam.fov=30;cam.position.set(.9,1.25,-3.7);cam.lookAt(0,.95,0);cam.updateProjectionMatrix();
      this.sky.position.copy(cam.position);r.render(this.scene,cam);
      $('snap-jane').getContext('2d').drawImage(r.domElement,0,0,320,272);
    }catch(e){console.warn('snapshots',e)}
    r.setPixelRatio(pr);this.onResize()}

  resetRun(){
    this.hero={lane:1,x:0,vx:0,alt:0,vy:0,coyote:0,jbuf:0,jumpHoldT:0,slideT:0,slideHold:false,sliding:false,hp:3,inv:0,turbo:0,laneVel:0,shield:0};
    for(const o of this.obs)this.scene.remove(o.g);this.obs.length=0;for(const p of this.picks)this.freePick(p);this.picks.length=0;
    for(const f of this.frags){this.scene.remove(f);this.fragPool.push(f)}this.frags.length=0;
    this.dist=0;this.speed=0;this.nextSpawn=6;this.firstZ=-70;this.spirit=0;this.spiritSeen=false;this.coins=0;this.shards=0;this.hits=0;this.runT=0;
    this.mult=1;this.multT=0;this.streak=0;this.taught={low:false,slide:false,tall:false};this.deadT=0;this.lastHud='';this.lineI=0;
    this.nextShard=200;this.nextShield=rand(450,700);this.clearT=0;
    if(this.in){this.in.left=this.in.right=this.in.jump=this.in.jumpHeld=this.in.dash=false}
    if(this.bubble)this.bubble.visible=false;this.hearts();this.turboUI();this.multUI();
  }
  toTitle(){this.resetRun();this.setState('title');this.titleT=0;this.applyPalette('morning');this.renderTitleUI();if(this.runner)this.runner.wrapper.visible=true;$('result').classList.remove('ending')}
  startStory(i){this.mode='story';this.ch=i;this.resetRun();this.applyPalette(STORY[i].pal);this.showIntro()}
  startEndless(){this.mode='endless';this.ch=-1;this.resetRun();this.applyPalette('morning');this.showIntro()}
  retry(){if(this.mode==='story')this.startStory(this.ch);else this.startEndless()}
  showIntro(){this.setState('intro');this.introT=0;
    if(this.mode==='story'){const c=STORY[this.ch];$('i-num').textContent='CHAPTER '+(this.ch+1);$('i-ttl').textContent=c.title;$('i-sb').textContent=c.sub;
      $('i-goal').textContent=c.goal.type==='dist'?`${c.goal.label} · ${c.goal.v} m`:`${c.goal.label} · ${c.goal.v}`}
    else{$('i-num').textContent='ENDLESS';$('i-ttl').textContent='NIGHT SHIFT';$('i-sb').textContent='HOW FAR CAN YOU RUN?';$('i-goal').textContent='Beat your best · '+(this.save.best||0)+' m'}
    this.objUI(true)}
  beginRun(){this.setState('run');this.sfx.ui();this.lineI=0;if(navigator.vibrate)navigator.vibrate(10)}
  togglePause(){if(this.state==='run'){this.setState('pause');$('pause-obj').textContent=this.mode==='story'?'Objective: '+this.objText():'Night Shift · '+Math.round(this.dist)+' m'}
    else if(this.state==='pause'){this.setState('run');this.prev=performance.now()}}

  loop(now){const rdt=Math.min(.05,(now-this.prev)/1000);this.prev=now;this.t+=rdt;
    if(this.tsHold>0){this.tsHold-=rdt;if(this.tsHold<=0)this.tsT=1}this.ts=damp(this.ts,this.tsT,10,rdt);const dt=rdt*this.ts;
    if(this.state!=='pause')this.step(dt,rdt);
    this.blendPalette(rdt);this.updateCamera(rdt);this.sky.position.copy(this.camera.position);
    this.renderer.render(this.scene,this.camera);
    if(this.frames++===3){$('loader').classList.add('hide');const e=$('ld-err');e.classList.remove('on');e.textContent=''}
    requestAnimationFrame(t=>this.loop(t))}
  step(dt,rdt){const h=this.hero,R=this.runner;
    for(const c of this.clouds){c.position.x-=dt*.8;if(c.position.x<-360)c.position.x=360}
    this.beaconGlow.material.opacity=.6+Math.sin(this.t*3)*.4;
    this.updateTower(dt);
    if(this.state==='title'){this.titleT+=dt;R.update(dt,{mode:'title',speed:0,x:0,alt:0});return}
    if(this.state==='intro'){this.introT+=rdt;R.update(dt,{mode:'idle',speed:0,x:0,alt:0});if(this.introT>3.4)this.beginRun();return}
    if(this.state==='result'){R.update(dt,{mode:this.resultKind==='clear'||this.resultKind==='ending'?'celebrate':'dead',speed:0,x:h.x,alt:0,yaw:this.resultKind==='fail'?0:0});this.updateFrags(dt);return}
    if(this.state==='dead'){this.deadT+=rdt;this.speed=damp(this.speed,0,2.4,dt);this.moveWorld(this.speed*dt,dt);this.updateFrags(dt);
      R.update(dt,{mode:'dead',speed:0,x:h.x,alt:Math.max(0,h.alt-=dt*4),z:0});if(this.deadT>1.8)this.showResult('fail');return}
    if(this.state==='clear'){this.clearT+=rdt;this.speed=damp(this.speed,0,1.6,dt);this.moveWorld(this.speed*dt,dt);this.updatePicks(dt);this.updateFrags(dt);
      h.x=damp(h.x,0,4,dt);R.update(dt,{mode:this.speed>2?'run':'celebrate',speed:this.speed,x:h.x,alt:0});if(this.clearT>2.4)this.showResult(this.mode==='story'&&this.ch===STORY.length-1?'ending':'clear');return}
    this.runT+=dt;const diff=this.difficulty();
    const base=Math.min(25,11.5+diff*1.55+Math.min(3,this.dist*.0012));this.speed=damp(this.speed||base*.7,base*(h.turbo>0?1.5:1),2.4,dt);const sp=this.speed,dz=sp*dt;
    if(this.in.dash&&this.spirit>=100&&h.turbo<=0)this.startTurbo();this.in.dash=false;
    if(h.turbo>0){h.turbo-=dt;if(h.turbo<=0){h.inv=Math.max(h.inv,.6);document.body.classList.remove('turbo')}}
    if(h.shield>0){h.shield-=dt;if(h.shield<=0){this.bubble.visible=false;$('shield-ind').classList.remove('on')}}
    if(this.in.left){this.in.left=false;if(h.lane>0){h.lane--;this.sfx.swish()}}if(this.in.right){this.in.right=false;if(h.lane<2){h.lane++;this.sfx.swish()}}
    h.vx=(h.vx||0)+(LANES[h.lane]-h.x)*LANE_STIFF*dt;
    h.vx*=Math.exp(-LANE_DAMP*dt);
    h.x+=h.vx*dt;
    if(Math.abs(h.vx)<1e-4&&Math.abs(LANES[h.lane]-h.x)<1e-4){h.x=LANES[h.lane];h.vx=0}
    h.laneVel=clamp(h.vx,-9,9);
    if(this.in.jump){h.jbuf=.13;this.in.jump=false}h.jbuf-=dt;h.coyote=h.alt<=0?.09:h.coyote-dt;h.jumpHoldT-=dt;
    const held=this.in.jumpHeld||h.jumpHoldT>0,wantSlide=h.slideHold||h.slideT>0;
    if(h.jbuf>0&&h.coyote>0){h.vy=JUMPV;h.alt=.01;h.jbuf=0;h.coyote=0;h.slideT=0;h.slideHold=false;this.sfx.jump();this.puff(h.x,8);if(navigator.vibrate)navigator.vibrate(6)}
    if(!held&&h.vy>JUMPV*.45)h.vy=JUMPV*.45;
    let g=GRAV;if(wantSlide&&h.alt>0)g*=2.8;const pa=h.alt;h.vy-=g*dt;h.alt+=h.vy*dt;
    if(h.alt<=0){if(pa>.15){this.sfx.land();this.puff(h.x,10);this.camKick=.12}h.alt=0;h.vy=0}
    h.slideT=Math.max(0,h.slideT-dt);h.sliding=h.alt<=0&&wantSlide;if(h.inv>0)h.inv-=dt;
    this.moveWorld(dz,dt);this.dist+=dz;
    if(this.dist>=this.nextSpawn)this.spawnPattern();
    this.collide();if(this.state!=='run')return;
    this.updatePicks(dt);
    if(this.multT>0){this.multT-=dt;if(this.multT<=0){this.mult=1;this.streak=0;this.multUI()}}
    const lines=this.mode==='story'?STORY[this.ch].lines:ENDLESS_LINES;if(this.lineI<lines.length&&this.dist>=lines[this.lineI][0]){this.comm(lines[this.lineI][1]);this.lineI++}
    if(this.mode==='endless'){const want=PAL_ORDER[Math.floor(this.dist/900)%4];if(want!==this.palName){this.applyPalette(want);this.toast({morning:'A NEW DAY BEGINS',golden:'GOLDEN HOUR',dusk:'DUSK FALLS',night:'NIGHT FALLS'}[want])}}
    if(this.mode==='story'){const c=STORY[this.ch];const v=c.goal.type==='dist'?this.dist:this.shards;if(v>=c.goal.v){this.clearChapter();return}}
    const mode=h.alt>.02?'jump':h.sliding?'slide':'run';
    R.update(dt,{mode,speed:sp,vy:h.vy,laneVel:h.laneVel,x:h.x,alt:h.alt});
    R.wrapper.visible=!(h.inv>0&&h.turbo<=0&&Math.floor(performance.now()/80)%2===0);
    this.turboLight.position.set(h.x,h.alt+1.2,.6);this.turboLight.intensity=damp(this.turboLight.intensity,h.turbo>0?5:0,8,dt);
    if(h.shield>0){this.bubble.position.set(h.x,h.alt+(h.sliding?.55:.95),0);const s=1+Math.sin(this.t*6)*.03;this.bubble.scale.set(s,h.sliding?.6*s:s,s);this.bubble.rotation.y+=dt}
    this.updateFrags(dt);this.hud();
  }
  difficulty(){return this.mode==='story'?STORY[this.ch].diff+this.dist/900:this.dist/750}
  updateTower(dt){let z=-420,y=-30;if(this.mode==='story'&&this.state!=='title'){const c=STORY[this.ch];const prog=c.goal.type==='dist'?this.dist/c.goal.v:this.shards/c.goal.v;z=-430+(this.ch+clamp(prog,0,1))/STORY.length*250}
    this.tower.position.z=damp(this.tower.position.z,z,1.5,dt);this.tower.position.y=y}
  moveWorld(dz,dt){
    for(const t of this.tiles){t.g.position.z+=dz;if(t.g.position.z-TILE/2>KILL_Z){t.g.position.z-=TILE*this.tiles.length;t.populate()}}
    for(const o of this.obs){if(o.gone)continue;o.g.position.z+=dz+(o.move||0)*dt;const z=o.g.position.z;
      if(o.g.userData.fan)o.g.userData.fan.rotation.y+=dt*14;
      if(o.g.userData.drone){o.g.userData.drone.position.y=1.68+Math.sin(this.t*3+o.ph)*.06;o.g.userData.drone.rotation.y=Math.sin(this.t*1.4+o.ph)*.25;for(const r of o.g.userData.rotors)r.rotation.z+=dt*40}
      if(o.type==='bot')o.g.rotation.z=Math.sin(this.t*12)*.025;
      if(z>-34&&this.state==='run'){const cat=OBS[o.type].cat;if(!this.taught[cat]){this.taught[cat]=true;
        this.toast(cat==='low'?(this.isTouch?'TAP / SWIPE UP — JUMP':'SPACE — JUMP'):cat==='slide'?(this.isTouch?'SWIPE DOWN — SLIDE':'▼ — SLIDE UNDER'):(this.isTouch?'SWIPE ◀ ▶ — CHANGE LANE':'◀ ▶ — CHANGE LANE'))}}
      if(z>KILL_Z){this.scene.remove(o.g);o.gone=true}}
    if(this.obs.some(o=>o.gone))this.obs=this.obs.filter(o=>!o.gone);
    for(const p of this.picks)p.z+=dz;
  }

  spawnPattern(){
    const d=this.difficulty(),drones=this.mode==='endless'?this.dist>500:this.ch>=1;
    const pool=[['low',6],['coins',3]];
    if(d>=.4)pool.push(['tall',4],['pipe',3]);if(drones&&d>=.8)pool.push(['drone',4]);
    if(d>=1.4)pool.push(['twoTall',4],['lowDouble',3],['bot',3],['scaffold',2]);
    if(d>=2.3)pool.push(['tallLow',4],['pipeDouble',3],['wallsSlide',3]);if(drones&&d>=2.3)pool.push(['droneLow',3]);
    if(d>=3.2)pool.push(['gauntlet',4],['bots2',2]);
    let tot=0;for(const p of pool)tot+=p[1];let r=Math.random()*tot,kind='low';for(const p of pool){r-=p[1];if(r<=0){kind=p[0];break}}
    const z=this.firstZ??SPAWN_Z;this.firstZ=null;const L=()=>rint(0,2),other=l=>pick([0,1,2].filter(x=>x!==l)),sh=[0,1,2].sort(()=>Math.random()-.5);
    const LOW=['barrier','crates','hvac'],TALL=['billboard','tank','stair'];let extra=0,free=null;
    switch(kind){
      case'low':{const l=L(),t=pick(LOW);this.addObs(t,l,z);if(Math.random()<.6)this.coinArc(l,z,OBS[t].hits[0].y1);else{free=other(l);this.coinLine(free,z-4,6)}break}
      case'coins':{free=L();this.coinLine(free,z,9);break}
      case'tall':{const l=L();this.addObs(pick(TALL),l,z);free=other(l);this.coinLine(free,z+2,6);break}
      case'pipe':{const l=L();this.addObs('pipe',l,z);this.coinLine(l,z-2,5,.55);break}
      case'drone':{const l=L();this.addObs('drone',l,z);this.coinLine(l,z-1,5,.55);break}
      case'twoTall':{const open=L();for(const l of[0,1,2])if(l!==open)this.addObs(pick(TALL),l,z);free=open;this.coinLine(open,z+3,7);break}
      case'lowDouble':{const open=L();for(const l of[0,1,2])if(l!==open)this.addObs(pick(LOW),l,z);free=open;this.coinLine(open,z+2,6);break}
      case'bot':{this.addObs('bot',L(),z);break}
      case'scaffold':{this.addObs('scaffold',1,z);this.coinLine(L(),z-2,5,.55);break}
      case'tallLow':{this.addObs(pick(TALL),sh[0],z);const t=pick(LOW);this.addObs(t,sh[1],z);this.coinArc(sh[1],z,OBS[t].hits[0].y1);free=sh[2];break}
      case'pipeDouble':{this.addObs('pipe',sh[0],z);this.addObs('pipe',sh[1],z);free=sh[2];this.coinLine(sh[2],z+2,5);break}
      case'wallsSlide':{const mid=L();for(const l of[0,1,2])if(l!==mid)this.addObs(pick(TALL),l,z);this.addObs(drones?'drone':'pipe',mid,z);this.coinLine(mid,z-3,5,.55);extra=4;break}
      case'droneLow':{this.addObs('drone',sh[0],z);this.addObs(pick(LOW),sh[1],z-9);free=sh[2];extra=9;break}
      case'gauntlet':{this.addObs(pick(TALL),sh[0],z);this.addObs(pick(LOW),sh[1],z-10);this.addObs(drones?'drone':'pipe',sh[2],z-20);this.coinLine(sh[2],z-24,5,.55);extra=20;break}
      case'bots2':{this.addObs('bot',sh[0],z);this.addObs('bot',sh[1],z-7);extra=7;break}
    }
    const fl=free??other(this.obs.length?this.obs[this.obs.length-1].lane:1);
    if(this.mode==='story'&&STORY[this.ch].goal.type==='shards'&&this.shards+this.picks.filter(p=>p.type==='shard').length<3&&this.dist>=this.nextShard){this.addPick('shard',fl,z-5,1.3);this.nextShard=this.dist+rand(230,300)}
    else if(this.dist>=this.nextShield){this.addPick('shield',fl,z-5,1.2);this.nextShield=this.dist+rand(650,950)}
    this.nextSpawn=this.dist+clamp(this.speed*1.15,16,30)+extra;
  }
  addObs(type,lane,z){const g=makeObstacle(type);g.position.set(type==='scaffold'?0:LANES[lane],0,z);this.scene.add(g);
    this.obs.push({g,type,lane,hits:OBS[type].hits,move:OBS[type].move||0,passed:false,dead:false,gone:false,minGap:9,ph:rand(0,6)})}
  getPick(type){let p=this.pool[type].pop();if(!p)p={g:makePickup(type),type};this.scene.add(p.g);p.taken=false;p.mag=false;return p}
  freePick(p){this.scene.remove(p.g);this.pool[p.type].push(p)}
  addPick(type,lane,z,y){const p=this.getPick(type);p.x=LANES[lane];p.y=y;p.z=z;p.ph=rand(0,6);p.g.position.set(p.x,p.y,p.z);this.picks.push(p)}
  coinLine(lane,z,n,y=.9,sp=1.4){for(let i=0;i<n;i++)this.addPick('coin',lane,z-i*sp,y)}
  coinArc(lane,z,y1){const apex=y1+1.05;for(let i=0;i<7;i++){const t=i/6;this.addPick('coin',lane,z+4.6-t*9.2,.9+Math.sin(t*Math.PI)*(apex-.9))}}
  updatePicks(dt){const h=this.hero,hx=h.x,hy=h.alt+.95,mag=h.turbo>0;let w=0;
    for(const p of this.picks){if(p.taken){this.freePick(p);continue}p.ph+=dt;
      if(mag&&p.type==='coin'){const dx=hx-p.x,dy=hy-p.y,dz=-p.z;if(Math.hypot(dx,dy,dz)<10)p.mag=true;if(p.mag){const k=Math.min(1,dt*10);p.x+=dx*k;p.y+=dy*k;p.z+=dz*k}}
      p.g.position.set(p.x,p.y+Math.sin(p.ph*2.4)*.07,p.z);p.g.rotation.y+=dt*(p.type==='coin'?4.2:1.6);if(p.g.userData.ring)p.g.userData.ring.rotation.z+=dt*3;
      if(this.state==='run'&&Math.abs(p.z)<.75&&Math.abs(p.x-hx)<.85&&p.y>h.alt-.3&&p.y<h.alt+(h.sliding?1.1:2)){this.collect(p);this.freePick(p);continue}
      if(p.z>8){this.freePick(p);continue}this.picks[w++]=p}this.picks.length=w}

  collide(){const h=this.hero,px=h.x,p0=h.alt,p1=h.alt+(h.sliding?SHH:PH),safe=h.turbo>0||h.inv>0;
    for(const o of this.obs){if(o.dead||o.gone)continue;const oz=o.g.position.z,ox=o.g.position.x;
      for(const hb of o.hits){const dzz=Math.abs(oz),dx=Math.abs(ox-px);
        if(dzz<hb.d/2+PD/2){if(dx<hb.w/2+PW/2){
            if(p0<hb.y1-.03&&p1>hb.y0+.03){if(safe)this.smash(o,true);else if(h.shield>0){h.shield=0;this.bubble.visible=false;$('shield-ind').classList.remove('on');this.smash(o,false);this.sfx.shield();this.toast('SHIELD ABSORBED THE HIT');h.inv=.8}
              else{this.hurt(o);if(this.state!=='run')return}break}
            const gap=p0>=hb.y1-.03?p0-hb.y1:hb.y0-p1;if(gap<o.minGap)o.minGap=gap}
          else{const lat=dx-(hb.w/2+PW/2);if(lat<.4&&lat<o.minGap)o.minGap=lat}}}
      if(!o.dead&&!o.passed&&oz>PD/2+o.hits[0].d/2+.1){o.passed=true;this.onPass(o)}}}
  onPass(o){this.streak++;const m=Math.min(5,1+Math.floor(this.streak/4));if(m!==this.mult){this.mult=m;this.multUI()}this.multT=5;
    if(o.minGap<.34){this.spirit=Math.min(100,this.spirit+9);this.sfx.tick();this.fxText('CLOSE CALL',_b.set(this.hero.x,this.hero.alt+2.1,0),'#13b5c8');this.turboUI();this.checkReady()}}
  collect(p){const h=this.hero;
    if(p.type==='coin'){this.coins+=this.mult;this.spirit=Math.min(100,this.spirit+(h.turbo>0?4:10));this.sfx.coin(this.coins);if(Math.random()<.4)this.burst(p.g.position,3,[M.coinEdge],.25)}
    else if(p.type==='shard'){this.shards++;this.save.shards++;store.s('rr_shards',this.save.shards);this.spirit=Math.min(100,this.spirit+50);this.sfx.shard();this.flash('flash');
      this.burst(p.g.position,14,[M.shard,M.cyanE],.5);this.fxText('LANTERN SHARD',p.g.position,'#13b5c8');
      if(this.mode==='story'&&STORY[this.ch].goal.type==='shards')this.comm(this.shards>=3?'That is all three shards! The Key is whole again.':`Shard secured. ${this.shards} of 3 — keep looking!`)}
    else if(p.type==='shield'){h.shield=14;this.bubble.visible=true;$('shield-ind').classList.add('on');this.sfx.shield();this.fxText('SHIELD',p.g.position,'#13b5c8')}
    this.turboUI();this.checkReady()}
  checkReady(){if(this.spirit>=100&&!this.spiritSeen){this.spiritSeen=true;this.sfx.ready();this.toast(this.isTouch?'TURBO READY — TAP TURBO':'TURBO READY — PRESS SHIFT','gold')}}
  startTurbo(){const h=this.hero;h.turbo=3.2;this.spirit=0;this.spiritSeen=false;document.body.classList.add('turbo');
    this.sfx.dash();this.burst(_b.set(h.x,1,0),16,[M.orangeE,M.white],.55);this.tsT=.35;this.tsHold=.1;this.shake=.5;this.turboUI();this.toast('TURBO DASH!','gold');if(navigator.vibrate)navigator.vibrate(20)}
  smash(o,bonus){if(o.dead)return;o.dead=true;o.gone=true;this.scene.remove(o.g);const p=o.g.position.clone();p.y+=1;
    this.burst(p,12,[M.white,M.steel,M.concrete,M.wood,M.darkSteel],1.1);this.sfx.smash();this.shake=Math.max(this.shake,.35);if(bonus){this.coins+=5;this.fxText('+5',p,'#ff6b1a')}}
  hurt(o){const h=this.hero;h.hp--;this.hits++;this.hearts(true);this.smash(o,false);this.sfx.hurt();this.shake=1;this.tsT=.15;this.tsHold=.16;this.mult=1;this.streak=0;this.multUI();
    this.flash('hurtfx');if(navigator.vibrate)navigator.vibrate(40);if(h.hp<=0){this.die();return}h.inv=1.6;this.toast(h.hp===1?'LAST HEART!':'OUCH! '+h.hp+' HEARTS LEFT')}
  die(){this.setState('dead');this.hero.turbo=0;this.tsT=.4;this.tsHold=.7;this.sfx.over();this.deadT=0;this.bubble.visible=false;this.runner.wrapper.visible=true;this.turboLight.intensity=0}
  clearChapter(){this.setState('clear');this.clearT=0;this.sfx.win();this.flash('flash');this.toast('CHAPTER CLEAR!','gold');this.runner.wrapper.visible=true;this.bubble.visible=false;
    for(const o of this.obs)if(o.g.position.z<-2){this.scene.remove(o.g);o.gone=true}for(const p of this.picks)p.taken=true}
  showResult(kind){this.resultKind=kind;this.setState('result');const res=$('result');res.classList.toggle('ending',kind==='ending');
    const m=Math.round(this.dist);this.save.coins+=this.coins;store.s('rr_coins',this.save.coins);
    let stars=0,title='',kick='',primary='',secondary='RETRY';
    if(kind==='fail'){kick=this.mode==='story'?'MISSION FAILED':'SHIFT OVER';title=this.mode==='story'?STORY[this.ch].title:'NIGHT SHIFT';primary='TRY AGAIN';secondary='MENU'}
    else{const c=STORY[this.ch];stars=1+(this.coins>=c.coinGoal?1:0)+(this.hits===0?1:0);this.save.stars[this.ch]=Math.max(this.save.stars[this.ch]||0,stars);store.s('rr_stars',JSON.stringify(this.save.stars));
      if(this.ch+2>this.save.unlocked&&this.ch+1<STORY.length){this.save.unlocked=this.ch+2;store.s('rr_unlocked',this.save.unlocked)}
      kick=kind==='ending'?'STORY COMPLETE':'CHAPTER '+(this.ch+1)+' CLEAR';title=kind==='ending'?'Harbor City is lit':c.title;primary=kind==='ending'?'PLAY NIGHT SHIFT':'NEXT CHAPTER'}
    let best=this.save.best;if(this.mode==='endless'&&m>best){best=m;this.save.best=m;store.s('rr_best',m);kick='NEW BEST RUN'}
    $('r-kick').textContent=kick;$('r-title').textContent=title;$('r-story').textContent=ENDING;$('r-coins').textContent=this.coins;$('r-hits').textContent=this.hits;$('r-time').textContent=Math.round(this.runT)+'s';
    $('r-sub').innerHTML=this.mode==='endless'?`BEST <b>${best} m</b>`:kind==='fail'?`OBJECTIVE <b>${this.objText()}</b>`:`COIN GOAL <b>${STORY[this.ch].coinGoal}</b> · NO-HIT RUN ★`;
    const big=$('r-big');const t0=performance.now();const tick=n=>{const p=Math.min(1,(n-t0)/900),e=1-Math.pow(1-p,3);big.innerHTML=Math.round(m*e)+'<small> M</small>';if(p<1&&this.state==='result')requestAnimationFrame(tick)};requestAnimationFrame(tick);
    const wrap=$('r-stars');wrap.replaceChildren();if(kind!=='fail'){for(let i=0;i<3;i++){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');
      s.innerHTML='<path d="M12 2l2.6 6.2 6.7.5-5.1 4.4 1.6 6.5L12 16.1 6.2 19.6l1.6-6.5L2.7 8.7l6.7-.5z" fill="'+(i<stars?'#f5b324':'#cfd8e2')+'"/>';wrap.appendChild(s);
      setTimeout(()=>{s.classList.add(i<stars?'earn':'dud');if(i<stars)this.sfx.coin(i)},350+i*220)}}
    $('r-primary').textContent=primary;$('r-secondary').textContent=secondary;
    $('r-menu').style.display=secondary==='MENU'?'none':'';
    $('r-primary').onclick=()=>{this.sfx.ui();if(kind==='fail')this.retry();else if(kind==='ending')this.startEndless();else{this.selCh=Math.min(this.ch+1,STORY.length-1);this.startStory(this.selCh)}};
    $('r-secondary').onclick=()=>{this.sfx.ui();if(secondary==='MENU')this.toTitle();else this.retry()};
    this.renderTitleUI()}

  burst(pos,n,mats,size){for(let i=0;i<n;i++){let f=this.fragPool.pop();if(!f){f=new THREE.Mesh(geo('frag',()=>new THREE.BoxGeometry(.16,.16,.16)),M.white);f.castShadow=true}
      f.material=pick(mats);f.position.copy(pos).add(_a.set(rand(-.5,.5),rand(-.3,.6),rand(-.3,.3)));f.scale.setScalar(size*rand(.5,1.4));
      f.userData={v:new V3(rand(-4,4),rand(3,8),rand(1,6)),r:new V3(rand(-9,9),rand(-9,9),rand(-9,9)),t:0,life:rand(.7,1.2),b:true};this.scene.add(f);this.frags.push(f)}}
  puff(x,n){for(let i=0;i<n;i++){let f=this.fragPool.pop();if(!f){f=new THREE.Mesh(geo('frag',()=>new THREE.BoxGeometry(.16,.16,.16)),M.dust);f.castShadow=false}
      f.material=M.dust;f.position.set(x+rand(-.35,.35),.08,rand(-.2,.3));f.scale.setScalar(rand(.4,.9));
      f.userData={v:new V3(rand(-1.5,1.5),rand(.8,2.2),rand(1,3)),r:new V3(rand(-3,3),rand(-3,3),0),t:0,life:rand(.35,.6),b:false};this.scene.add(f);this.frags.push(f)}}
  updateFrags(dt){let w=0;for(const f of this.frags){const u=f.userData;u.t+=dt;if(u.t>=u.life){this.scene.remove(f);this.fragPool.push(f);continue}
      u.v.y-=(u.b?20:3)*dt;f.position.addScaledVector(u.v,dt);f.position.z+=this.speed*dt;f.rotation.x+=u.r.x*dt;f.rotation.y+=u.r.y*dt;f.rotation.z+=u.r.z*dt;
      if(u.b&&f.position.y<.09){f.position.y=.09;u.v.y*=-.35;u.v.x*=.8;u.v.z*=.8}if(!u.b)f.scale.multiplyScalar(1+dt*1.6);this.frags[w++]=f}this.frags.length=w}

  updateCamera(rdt){const h=this.hero,cam=this.camera,asp=this.W/this.H;
    let fov=52;if(asp<1.25){const hf=64*Math.PI/180;fov=clamp(2*Math.atan(Math.tan(hf/2)/asp)*180/Math.PI,52,86)}
    const P=_a,L=_b;const st=this.state;
    if(st==='title'||st==='result'&&(this.resultKind==='clear'||this.resultKind==='ending')||st==='clear'&&this.clearT>.8){
      const a=Math.sin((this.titleT||this.t)*.25)*.35;const r=st==='title'?3.9:4.6;P.set(Math.sin(a)*r+.3,1.35,-Math.cos(a)*r);L.set(h.x*.3,1.0,0);fov=asp<1?clamp(fov*.85,38,62):36}
    else if(st==='dead'||st==='result'){P.set(h.x*.4+1.8,3.4,3.8);L.set(h.x*.3,.6,-1)}
    else if(st==='intro'){const k=sstep(clamp(this.introT/3,0,1));P.set(lerp(2.6,0,k),lerp(1.8,3.0,k),lerp(-3.2,6.4,k));L.set(0,lerp(1.2,1.3,k),lerp(0,-8,k))}
    else{const back=asp<.8?7.2:6.4;P.set(h.x*.55,3.05+h.alt*.22-this.camKick,back);L.set(h.x*.35,1.3,-8);if(h.turbo>0)fov+=10}
    this.camPos.x=damp(this.camPos.x,P.x,st==='run'?7:3.5,rdt);this.camPos.y=damp(this.camPos.y,P.y,st==='run'?7:3.5,rdt);this.camPos.z=damp(this.camPos.z,P.z,st==='run'?7:3.5,rdt);
    this.camLook.lerp(L,1-Math.exp(-(st==='run'?9:4)*rdt));this.fov=damp(this.fov,fov,4,rdt);cam.fov=this.fov;cam.position.copy(this.camPos);
    if(this.shake>0){cam.position.x+=rand(-1,1)*this.shake*.22;cam.position.y+=rand(-1,1)*this.shake*.18;this.shake=Math.max(0,this.shake-rdt*1.8)}
    if(this.camKick>0)this.camKick=Math.max(0,this.camKick-rdt*.7);cam.lookAt(this.camLook);
    const sd=this.pal.sunDir,front=st==='title'||st==='intro'&&this.introT<1.2||st==='clear'||st==='result';
    const sz=front?-Math.abs(sd.z)-.35:sd.z;this.sun.position.set(h.x+sd.x*40,Math.max(sd.y,.35)*40,(front?0:-6)+sz*40);this.sun.target.position.set(h.x,0,front?0:-6);this.sun.target.updateMatrixWorld();
    if(st==='title'){
      if(asp>1.05)cam.clearViewOffset();
      else if(this.H<=520&&asp>1)cam.setViewOffset(this.W,this.H,this.W*.22,0,this.W,this.H);
      else cam.setViewOffset(this.W,this.H,0,this.H*.2,this.W,this.H)}
    else if(st==='result'&&this.W<=900)cam.setViewOffset(this.W,this.H,0,this.H*.22,this.W,this.H);else cam.clearViewOffset();cam.updateProjectionMatrix()}

  objText(){if(this.mode!=='story')return'';const c=STORY[this.ch];return c.goal.type==='dist'?`${Math.min(Math.round(this.dist),c.goal.v)} / ${c.goal.v} m`:`${this.shards} / ${c.goal.v} shards`}
  objUI(force){let label,val,prog,icon;
    if(this.mode==='story'){const c=STORY[this.ch];label=c.goal.label;val=this.objText();prog=c.goal.type==='dist'?this.dist/c.goal.v:this.shards/c.goal.v;
      icon=c.goal.type==='dist'?'<svg viewBox="0 0 24 24"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="#ff6b1a"/></svg>':'<svg viewBox="0 0 24 24"><path d="M12 2l6 7-6 13L6 9z" fill="#13b5c8"/></svg>'}
    else{label='Night Shift · Best '+(this.save.best||0)+' m';val=Math.round(this.dist)+' m';prog=this.save.best?this.dist/this.save.best:0;icon='<svg viewBox="0 0 24 24"><path d="M20 15A8 8 0 1 1 9 4a6.5 6.5 0 0 0 11 11z" fill="#5a6fd6"/></svg>'}
    const sig=label+val;if(!force&&sig===this._objSig)return;this._objSig=sig;$('obj-t').textContent=label;$('obj-v').textContent=val;$('obj-fill').style.width=clamp(prog*100,0,100)+'%';if(force)$('obj-ic').innerHTML=icon}
  hud(){const m=Math.round(this.dist),sig=m+'|'+this.coins;if(sig!==this.lastHud){this.lastHud=sig;$('dist').innerHTML=m+'<small>M</small>';$('coins').textContent=this.coins;this.objUI(false)}this.turboUI()}
  turboUI(){const p=Math.round(clamp(this.hero.turbo>0?this.hero.turbo/3.2*100:this.spirit,0,100));if(p===this._tp)return;this._tp=p;$('tfill').style.width=p+'%';$('tpct').textContent=p+'%';
    const full=p>=100&&this.hero.turbo<=0;$('turbo').classList.toggle('full',full);$('turbo-btn').classList.toggle('ready',full);$('thint').textContent=this.isTouch?'TAP TURBO':'SHIFT · TURBO DASH'}
  multUI(){const el=$('mult');el.textContent='×'+this.mult+' COMBO';el.classList.toggle('show',this.mult>1)}
  hearts(pop){const el=$('hearts');el.replaceChildren();for(let i=0;i<3;i++){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');
      s.innerHTML='<path d="M12 20.8C6.8 16.7 3 13.4 3 9.5 3 6.6 5.2 4.6 7.8 4.6c1.7 0 3.2.9 4.2 2.3 1-1.4 2.5-2.3 4.2-2.3 2.6 0 4.8 2 4.8 4.9 0 3.9-3.8 7.2-9 11.3z" fill="#e5484d"/>';
      if(this.hero&&i>=this.hero.hp)s.classList.add('lost');if(pop&&i===this.hero.hp)s.classList.add('pop');el.appendChild(s)}}
}
const _tmpC=new THREE.Color();

try{window.game=new Game()}catch(err){console.error(err);const e=$('ld-err');e.classList.add('on');e.textContent='Could not start the 3D renderer: '+(err&&err.message||err)}
})().catch(function (err) {
  console.error('Rooftop Rush bootstrap failed', err);
  const e = document.getElementById('ld-err');
  if (e) {
    e.classList.add('on');
    e.textContent = 'Could not load. Check your internet connection and reload.' + (err && err.message ? err.message : '');
  }
});
