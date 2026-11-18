import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $=id=>document.getElementById(id);
const dataset=window.ANEUMO_DATA;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const state={case:dataset.cases[0],mode:'geometry',paused:reduced,rotate:false,speed:1,opacity:.18,time:0};
const speedStops=['#440154','#3b528b','#21918c','#5ec962','#fde725'].map(c=>new THREE.Color(c));
const errorStops=['#22183b','#71265d','#be4968','#f28c63','#fce9a4'].map(c=>new THREE.Color(c));
function colorAt(value,max,error=false){const stops=error?errorStops:speedStops;const n=Math.max(0,Math.min(.999999,value/Math.max(max,1e-10)))*4;return stops[Math.floor(n)].clone().lerp(stops[Math.floor(n)+1],n%1);}
function bufferGeometry(data){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));if(data.indices)g.setIndex(data.indices);g.computeVertexNormals();return g;}
function cleanup(group){group.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});group.clear();}

class VesselView {
  constructor(element){
    this.element=element;this.scene=new THREE.Scene();this.group=new THREE.Group();this.scene.add(this.group);
    this.camera=new THREE.OrthographicCamera(-2,2,2,-2,.01,100);this.camera.up.set(0,0,1);
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor(0x000000,0);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.30;
    element.appendChild(this.renderer.domElement);this.renderer.domElement.setAttribute('role','img');this.renderer.domElement.setAttribute('aria-label','Interactive vessel with blood velocity or error; drag to rotate and scroll to zoom');
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.07;
    this.controls.enablePan=false;this.controls.minZoom=.65;this.controls.maxZoom=2.8;this.controls.autoRotate=false;
    this.scene.add(new THREE.HemisphereLight(0xc6eaff,0x1b2634,2.0));
    const key=new THREE.DirectionalLight(0xdffaff,3.5);key.position.set(3,-4,6);this.scene.add(key);
    const rim=new THREE.DirectionalLight(0x39cbbf,3);rim.position.set(-3,2,1);this.scene.add(rim);
    const fill=new THREE.DirectionalLight(0x639de5,1.7);fill.position.set(1,4,-2);this.scene.add(fill);
    this.reset();new ResizeObserver(()=>this.resize()).observe(element);
  }
  reset(){this.camera.position.set(4.5,4.5,4.3);this.controls.target.set(0,0,0);this.camera.zoom=1;this.camera.updateProjectionMatrix();this.controls.update();}
  resize(){const w=this.element.clientWidth,h=this.element.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);const half=1.85*Math.max(1,h/w);this.camera.left=-half*w/h;this.camera.right=half*w/h;this.camera.top=half;this.camera.bottom=-half;this.camera.updateProjectionMatrix();}
  build(c,kind){
    cleanup(this.group);this.kind=kind;this.particles=null;this.paths=null;
    const solid=kind==='geometry';
    this.wall=new THREE.Mesh(bufferGeometry(c.surface),new THREE.MeshPhysicalMaterial({color:solid?0x48aca8:0x9bd8df,metalness:.08,roughness:solid?.25:.38,clearcoat:.7,clearcoatRoughness:.16,transparent:!solid,opacity:solid?1:state.opacity,side:THREE.DoubleSide,depthWrite:solid}));
    this.wall.renderOrder=3;this.group.add(this.wall);
    const inlet=new THREE.Mesh(bufferGeometry(c.inlet),new THREE.MeshStandardMaterial({color:0xe9b26e,metalness:.1,roughness:.4,transparent:!solid,opacity:solid?.9:.28,side:THREE.DoubleSide,depthWrite:solid}));
    inlet.renderOrder=4;this.group.add(inlet);
    if(solid)return;
    const predicted=kind!=='reference';const field=predicted?c.predicted:c.reference;
    if(kind==='error'){
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(c.positions,3));
      const colors=[];for(const v of c.predicted.error)colors.push(...colorAt(v,c.error_max,true).toArray());g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,uniforms:{size:{value:4.8*this.renderer.getPixelRatio()}},vertexShader:'attribute vec3 color; varying vec3 vColor; uniform float size; void main(){vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size;}',fragmentShader:'varying vec3 vColor; void main(){float d=length(gl_PointCoord-vec2(.5));if(d>.5)discard;gl_FragColor=vec4(vColor,(1.-smoothstep(.28,.5,d))*.92);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
      // ShaderMaterial injects color when vertexColors is true, so do not redeclare it.
      mat.vertexShader=mat.vertexShader.replace('attribute vec3 color; ','');
      this.group.add(new THREE.Points(g,mat));return;
    }
    const paths=field.paths;this.paths=paths;
    const positions=[],colors=[];
    for(let i=0;i<paths.offsets.length-1;i++)for(let j=paths.offsets[i];j<paths.offsets[i+1]-1;j++){
      for(const k of [j,j+1]){positions.push(...paths.positions.slice(k*3,k*3+3));colors.push(...colorAt(paths.speed[k],c.speed_max).toArray());}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    this.group.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.67,depthWrite:false})));
    // A very sparse velocity-colored point cloud also shows where the field was sampled.
    const pointPos=[],pointColors=[];
    for(let i=0;i<field.speed.length;i+=3){pointPos.push(...c.positions.slice(i*3,i*3+3));pointColors.push(...colorAt(field.speed[i],c.speed_max).toArray());}
    const cloud=new THREE.BufferGeometry();cloud.setAttribute('position',new THREE.Float32BufferAttribute(pointPos,3));cloud.setAttribute('color',new THREE.Float32BufferAttribute(pointColors,3));
    this.group.add(new THREE.Points(cloud,new THREE.PointsMaterial({size:.010,vertexColors:true,transparent:true,opacity:.30,depthWrite:false,sizeAttenuation:true})));
    const count=(paths.offsets.length-1)*3;const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));pg.setAttribute('color',new THREE.BufferAttribute(new Float32Array(count*3),3));
    const pm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,uniforms:{size:{value:5.5*this.renderer.getPixelRatio()}},vertexShader:'varying vec3 vColor; uniform float size; void main(){vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size;}',fragmentShader:'varying vec3 vColor; void main(){float d=length(gl_PointCoord-vec2(.5));if(d>.5)discard;gl_FragColor=vec4(vColor,1.-smoothstep(.12,.5,d));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
    this.particles=new THREE.Points(pg,pm);this.particles.renderOrder=2;this.group.add(this.particles);this.animate(state.time);
  }
  animate(time){
    if(!this.particles)return;const p=this.paths,pos=this.particles.geometry.attributes.position,col=this.particles.geometry.attributes.color;
    for(let i=0;i<p.offsets.length-1;i++){
      const a=p.offsets[i],b=p.offsets[i+1];const rate=.09+((i*17)%31)/300;
      for(let dot=0;dot<3;dot++){
        const cycle=((time*rate+dot/3+i*.6180339)%1+1)%1;
        const f=cycle*(b-a-1);const j=a+Math.floor(f),u=f%1,k=Math.min(j+1,b-1),n=i*3+dot;
        pos.setXYZ(n,...[0,1,2].map(ax=>p.positions[j*3+ax]*(1-u)+p.positions[k*3+ax]*u));
        const c=colorAt(p.speed[j],state.case.speed_max).lerp(new THREE.Color(0xffffff),.42);col.setXYZ(n,c.r,c.g,c.b);
      }
    }
    pos.needsUpdate=true;col.needsUpdate=true;
  }
  draw(){this.renderer.render(this.scene,this.camera);}
}

let left,right,syncing=false;
try{left=new VesselView($('canvasA'));right=new VesselView($('canvasB'));}
catch(error){$('webglError').hidden=false;throw error;}
for(const [a,b] of [[left,right],[right,left]]){
  a.controls.addEventListener('change',()=>{
    if(syncing)return;
    syncing=true;
    b.camera.position.copy(a.camera.position);b.camera.quaternion.copy(a.camera.quaternion);
    b.camera.zoom=a.camera.zoom;b.controls.target.copy(a.controls.target);b.camera.updateProjectionMatrix();
    syncing=false;
  });
}
function setMode(value){
  if(!['geometry','prediction','reference','error','compare'].includes(value))return;
  state.mode=value;
  document.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.mode===value)));
  $('viewB').hidden=value!=='compare';$('labelA').hidden=value!=='compare';
  $('viewport').classList.toggle('comparison',value==='compare');
  left.build(state.case,value==='compare'?'prediction':value);
  if(value==='compare')right.build(state.case,'reference');
  $('legend').hidden=value==='geometry';$('legendTitle').textContent=value==='error'?'Velocity error':'Speed';
  const max=value==='error'?state.case.error_max:state.case.speed_max;
  $('legendMid').textContent=(max/2).toFixed(3);$('legendMax').textContent=max.toFixed(3);
  $('colorbar').style.background=value==='error'?'linear-gradient(90deg,#22183b,#71265d,#be4968,#f28c63,#fce9a4)':'linear-gradient(90deg,#440154,#3b528b,#21918c,#5ec962,#fde725)';
  left.resize();right.resize();
}
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
document.addEventListener('keydown',event=>{
  const key=event.key.toLowerCase();
  if(key===' '){event.preventDefault();state.paused=!state.paused;}
  else if(key==='r')left.reset();
  else if('12345'.includes(key)&&key.length===1)setMode(['geometry','prediction','reference','error','compare'][Number(key)-1]);
});
// Aggregate relative L2 over the full saved field, not the display subsample.
$('relativeError').innerHTML=(state.case.predicted.relative_l2*100).toFixed(2)+'<span>%</span>';
setMode('geometry');
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.max(0,Math.min((now-last)/1000,.1));last=now;
  if(!state.paused)state.time+=dt;
  left.controls.update();left.animate(state.time);left.draw();
  if(state.mode==='compare'){right.animate(state.time);right.draw();}
}
requestAnimationFrame(frame);
window.aneumoViewer={state,setMode,views:[left,right]};

