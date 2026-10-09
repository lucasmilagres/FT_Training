/* =========================================================
   Hero 3D — piso de cruzes "+" (assinatura visual dos posts FT)
   Ondula devagar e acende em amarelo ao redor do cursor.
   ========================================================= */
import * as THREE from 'three';

export function initHero3D(canvas, { reduced = false } = {}) {
  const host = canvas.parentElement;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    canvas.remove();
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0a0a, 9, 30);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 7.2, 12.5);
  const lookTarget = new THREE.Vector3(1.5, 0, -3);
  camera.lookAt(lookTarget);

  // geometria do "+"
  const s = 0.15, t = 0.04;
  const shape = new THREE.Shape();
  shape.moveTo(-t, s); shape.lineTo(t, s); shape.lineTo(t, t); shape.lineTo(s, t); shape.lineTo(s, -t);
  shape.lineTo(t, -t); shape.lineTo(t, -s); shape.lineTo(-t, -s); shape.lineTo(-t, -t); shape.lineTo(-s, -t);
  shape.lineTo(-s, t); shape.lineTo(-t, t); shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);

  const COLS = window.innerWidth < 760 ? 34 : 60;
  const ROWS = window.innerWidth < 760 ? 30 : 34;
  const GAP = 0.62;
  const COUNT = COLS * ROWS;

  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  const base = new Float32Array(COUNT * 2);
  const seed = new Float32Array(COUNT);
  const accent = new Uint8Array(COUNT);
  let i = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      base[i * 2] = (c - COLS / 2) * GAP + (r % 2 ? GAP / 2 : 0);
      base[i * 2 + 1] = (r - ROWS + 6) * GAP;
      seed[i] = Math.random() * Math.PI * 2;
      accent[i] = Math.random() < 0.06 ? 1 : 0;
      i++;
    }
  }

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const cGray = new THREE.Color(0x3a3a3a);
  const cAccent = new THREE.Color(0x7a6000);
  const cYellow = new THREE.Color(0xffcb3c);
  const cHot = new THREE.Color(0xfff2b0);

  // cursor -> plano
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2(0.4, 0.1);
  const hit = new THREE.Vector3();
  const pointer = new THREE.Vector3(3, 0, -2);
  const pointerTarget = pointer.clone();
  let lastMove = -1e9;
  let strength = 0;

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) pointerTarget.copy(hit);
    lastMove = performance.now();
  }
  host.addEventListener('pointermove', onMove, { passive: true });
  // celular: o dedo arrasta a luz pelo piso
  const onTouch = (e) => { if (e.touches[0]) onMove(e.touches[0]); };
  host.addEventListener('touchstart', onTouch, { passive: true });
  host.addEventListener('touchmove', onTouch, { passive: true });

  // celular: inclinar o aparelho move a câmera (Android libera sem pedir permissão)
  let tiltX = 0, tiltY = 0, tx = 0, ty = 0;
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    tx = Math.max(-1, Math.min(1, e.gamma / 30));
    ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
  }, { passive: true });

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 760 ? 58 : 42;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  let running = true;
  let scrollK = 0;
  const clock = new THREE.Clock();

  function frame() {
    const time = clock.getElapsedTime();

    // sem cursor recente: o ponto de luz passeia sozinho
    if (performance.now() - lastMove > 2500) {
      pointerTarget.set(Math.sin(time * 0.35) * 6 + 2, 0, Math.cos(time * 0.27) * 3 - 4);
    }
    pointer.lerp(pointerTarget, 0.07);
    strength += (1 - strength) * 0.05;

    for (let k = 0; k < COUNT; k++) {
      const x = base[k * 2], z = base[k * 2 + 1];
      const dx = x - pointer.x, dz = z - pointer.z;
      const d2 = dx * dx + dz * dz;
      const inf = Math.exp(-d2 / 5.5) * strength;
      const wave = Math.sin(x * 0.45 + time * 0.9) * 0.18 + Math.cos(z * 0.38 + time * 0.7 + seed[k] * 0.15) * 0.18;

      dummy.position.set(x, wave + inf * 1.4, z);
      dummy.rotation.set(0, seed[k] + inf * 2.2 + time * 0.05 * accent[k], inf * 0.6);
      const sc = 0.75 + inf * 1.25 + accent[k] * 0.25;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);

      color.copy(accent[k] ? cAccent : cGray).lerp(cYellow, Math.min(1, inf * 1.6));
      if (inf > 0.75) color.lerp(cHot, (inf - 0.75) * 2);
      mesh.setColorAt(k, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;

    tiltX += (tx - tiltX) * 0.05;
    tiltY += (ty - tiltY) * 0.05;
    camera.position.x = tiltX * 2.2;
    camera.position.y = 7.2 + scrollK * 3 - tiltY * 1.2;
    camera.position.z = 12.5 - scrollK * 2;
    camera.lookAt(lookTarget);

    renderer.render(scene, camera);
  }

  function loop() {
    if (!running) return;
    frame();
    requestAnimationFrame(loop);
  }

  if (reduced) {
    frame();
  } else {
    loop();
    // pausa fora da tela / aba oculta
    let inView = true;
    const sync = () => {
      const vis = inView && !document.hidden;
      if (vis && !running) { running = true; loop(); }
      else if (!vis) running = false;
    };
    new IntersectionObserver(([en]) => { inView = en.isIntersecting; sync(); }).observe(host);
    document.addEventListener('visibilitychange', sync);
  }

  return {
    setScroll(k) { scrollK = k; if (reduced) frame(); }
  };
}
