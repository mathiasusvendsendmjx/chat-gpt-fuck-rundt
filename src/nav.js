import * as THREE from 'three';
export function makeHitXZ(navMesh){
  const downRay = new THREE.Raycaster(); downRay.far = 20000;
  return function hitXZ(x,z){
    if(!navMesh) return null;
    downRay.set(new THREE.Vector3(x, 10000, z), new THREE.Vector3(0,-1,0));
    const h = downRay.intersectObject(navMesh, true);
    return h.length ? h[0].point : null;
  }
}
