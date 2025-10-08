// src/finale.js
export function setupFinale(worldRoot, bloom) {
  const targets = { hjerne: null, kant1: null, kant2: null };

  // find meshes once
  worldRoot.traverse((o) => {
    if (!o.isMesh) return;
    const n = (o.name || "").toLowerCase();
    if (n in targets && !targets[n]) targets[n] = o;
  });

  console.log("[Finale] found:", {
    hjerne: !!targets.hjerne,
    kant1: !!targets.kant1,
    kant2: !!targets.kant2,
  });

  let armed = false;
  function arm() {
    if (armed) return;
    armed = true;

    // Mark for bloom + give them strong bloom color (no emissive needed)
    if (targets.kant1) {
      bloom?.setBoost(targets.kant1, { color: "#f59e0b", intensity: 1 });
      bloom?.mark(targets.kant1, true);
      targets.kant1.userData.spinSpeed = 0.8;
    }
    if (targets.kant2) {
      bloom?.setBoost(targets.kant2, { color: "#f59e0b", intensity: 1 });
      bloom?.mark(targets.kant2, true);
      targets.kant2.userData.spinSpeed = 0.8;
    }
    if (targets.hjerne) {
      bloom?.setBoost(targets.hjerne, { color: "#ef4444", intensity: 1 });
      bloom?.mark(targets.hjerne, true);
    }

    console.log("[Finale] ARMED → selective bloom + spin");
  }

  function tick(dt) {
    if (!armed) return;
    if (targets.kant1)
      targets.kant1.rotation.y +=
        (targets.kant1.userData.spinSpeed || 0.8) * dt;
    if (targets.kant2)
      targets.kant2.rotation.y +=
        (targets.kant2.userData.spinSpeed || 0.8) * dt;
  }

  return { arm, tick };
}
