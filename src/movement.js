import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { MOVE_SPEED, RUN_MULTIPLIER } from './config.js';

export function setupMovement(camera, renderer){
  const controls = new PointerLockControls(camera, renderer.domElement);
  let moveF=false, moveB=false, moveL=false, moveR=false, isRunning=false, isPlaying=false;

  window.addEventListener('keydown', (e)=>{
    switch(e.code){
      case 'KeyW': moveF=true; break; case 'KeyS': moveB=true; break;
      case 'KeyA': moveL=true; break; case 'KeyD': moveR=true; break;
      case 'ShiftLeft': case 'ShiftRight': isRunning=true; break;
    }
  });
  window.addEventListener('keyup', (e)=>{
    switch(e.code){
      case 'KeyW': moveF=false; break; case 'KeyS': moveB=false; break;
      case 'KeyA': moveL=false; break; case 'KeyD': moveR=false; break;
      case 'ShiftLeft': case 'ShiftRight': isRunning=false; break;
    }
  });

  controls.addEventListener('lock', ()=>{ isPlaying=true; renderer.domElement.style.cursor='none'; });
  controls.addEventListener('unlock', ()=>{ isPlaying=false; renderer.domElement.style.cursor='default'; });

  function update(dt, hitXZ, EYE_HEIGHT){
    if(!isPlaying) return;
    const speed = MOVE_SPEED * (isRunning ? RUN_MULTIPLIER : 1);
    let ix=0, iz=0;
    if(moveF) iz += 1; if(moveB) iz -= 1; if(moveL) ix -= 1; if(moveR) ix += 1;
    const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y=0; if (forward.lengthSq()>0) forward.normalize();
    const up=new THREE.Vector3(0,1,0); const right=new THREE.Vector3().crossVectors(forward, up).normalize();
    if (ix !== 0 || iz !== 0) {
      const desired = new THREE.Vector3().addScaledVector(right, ix).addScaledVector(forward, iz).normalize().multiplyScalar(speed * dt);
      const start = camera.position.clone();
      const tryMove=(x,z)=>{ const h=hitXZ(x,z); if(h) camera.position.set(x, camera.position.y, z); return h; };
      const applied = tryMove(start.x + desired.x, start.z + desired.z) || tryMove(start.x + desired.x, start.z) || tryMove(start.x, start.z + desired.z) || null;
      const ground = applied || hitXZ(camera.position.x, camera.position.z);
      if (ground) camera.position.y += (ground.y + EYE_HEIGHT - camera.position.y) * 0.18;
    } else {
      const ground = hitXZ(camera.position.x, camera.position.z);
      if (ground) camera.position.y += (ground.y + EYE_HEIGHT - camera.position.y) * 0.18;
    }
  }

  return { controls, update, get isPlaying(){ return isPlaying; } };
}
