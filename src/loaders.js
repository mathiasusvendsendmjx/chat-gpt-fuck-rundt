import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WORLD_URL, NAV_URL } from './config.js';

export async function loadWorld({ onProgress, onLoaded }){
  const manager = new THREE.LoadingManager();
  const loader = new GLTFLoader(manager);
  manager.onProgress = (url, loaded, total) => { if (onProgress) onProgress(total ? Math.round((loaded/total)*100) : 0); };
  let worldRoot=null, navMesh=null;
  const p1 = new Promise((res, rej)=> loader.load(WORLD_URL, g=>{ worldRoot=g.scene; res(); }, undefined, rej));
  const p2 = new Promise((res, rej)=> loader.load(NAV_URL, g=>{ navMesh=g.scene; res(); }, undefined, rej));
  await Promise.all([p1,p2]);
  if (onLoaded) onLoaded({ worldRoot, navMesh });
  return { worldRoot, navMesh };
}
