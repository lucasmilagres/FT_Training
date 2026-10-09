/* =========================================================
   Hero 3D — piso de cruzes "+" em WebGL2 puro (sem biblioteca)
   Toda a animação roda na GPU: o JS só atualiza 4 números por quadro.
   Ondula devagar e acende em amarelo ao redor do cursor / dedo.
   ========================================================= */

const VERT = `#version 300 es
in vec2 aPos;
in vec2 aOffset;
in float aSeed;
in float aAccent;
uniform mat4 uPV;
uniform vec3 uCam;
uniform float uTime;
uniform vec2 uPointer;
out float vInf;
out float vAccent;
out float vFog;
void main() {
  vec2 d = aOffset - uPointer;
  float inf = exp(-dot(d, d) / 5.5);
  float wave = sin(aOffset.x * .45 + uTime * .9) * .18 + cos(aOffset.y * .38 + uTime * .7 + aSeed * .15) * .18;
  float ang = aSeed + inf * 2.2 + uTime * .05 * aAccent;
  float sc = .75 + inf * 1.25 + aAccent * .25;
  vec2 p = aPos * sc;
  float c = cos(ang), s = sin(ang);
  vec2 r = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  vec3 world = vec3(aOffset.x + r.x, wave + inf * 1.4, aOffset.y + r.y);
  gl_Position = uPV * vec4(world, 1.0);
  vInf = inf;
  vAccent = aAccent;
  vFog = smoothstep(9.0, 30.0, distance(world, uCam));
}`;

const FRAG = `#version 300 es
precision mediump float;
in float vInf;
in float vAccent;
in float vFog;
out vec4 outColor;
void main() {
  vec3 gray = vec3(.227);
  vec3 accent = vec3(.48, .38, .02);
  vec3 yellow = vec3(1.0, .796, .235);
  vec3 hot = vec3(1.0, .95, .7);
  vec3 col = mix(mix(gray, accent, vAccent), yellow, clamp(vInf * 1.6, 0.0, 1.0));
  col = mix(col, hot, clamp((vInf - .75) * 2.0, 0.0, 1.0));
  float a = .95 * (1.0 - vFog);
  outColor = vec4(col * a, a);
}`;

/* --- matemática mínima de matrizes (coluna-maior, como o WebGL espera) --- */
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function lookAt(eye, target) {
  const z = norm(sub(eye, target));
  const x = norm(cross([0, 1, 0], z));
  const y = cross(z, x);
  return { m: [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1], x, y, z };
}
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

export function initHero3D(canvas, { reduced = false } = {}) {
  const host = canvas.parentElement;
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' });
  if (!gl) { canvas.remove(); return null; }

  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { canvas.remove(); return null; }
  gl.useProgram(prog);

  const mobile = window.innerWidth < 760;
  const COLS = mobile ? 30 : 58, ROWS = mobile ? 28 : 34, GAP = 0.62;
  const COUNT = COLS * ROWS;

  // "+" feito de 3 retângulos sem sobreposição
  const s = 0.15, t = 0.04;
  const rect = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y0, x1, y1, x0, y1];
  const shape = new Float32Array([...rect(-s, -t, s, t), ...rect(-t, t, t, s), ...rect(-t, -s, t, -t)]);

  const inst = new Float32Array(COUNT * 4);
  let i = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      inst[i++] = (c - COLS / 2) * GAP + (r % 2 ? GAP / 2 : 0);
      inst[i++] = (r - ROWS + 6) * GAP;
      inst[i++] = Math.random() * Math.PI * 2;
      inst[i++] = Math.random() < 0.06 ? 1 : 0;
    }
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const bShape = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bShape);
  gl.bufferData(gl.ARRAY_BUFFER, shape, gl.STATIC_DRAW);
  const locPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

  const bInst = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bInst);
  gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
  const attr = (name, size, offset) => {
    const loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 16, offset);
    gl.vertexAttribDivisor(loc, 1);
  };
  attr('aOffset', 2, 0);
  attr('aSeed', 1, 8);
  attr('aAccent', 1, 12);

  const uPV = gl.getUniformLocation(prog, 'uPV');
  const uCam = gl.getUniformLocation(prog, 'uCam');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uPointer = gl.getUniformLocation(prog, 'uPointer');

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const target = [1.5, 0, -3];
  let fov = 42 * Math.PI / 180, aspect = 1, view = lookAt([0, 7.2, 12.5], target), eye = [0, 7.2, 12.5];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
    const w = host.clientWidth, h = host.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = w / h;
    fov = (w < 760 ? 58 : 42) * Math.PI / 180;
  }
  resize();
  window.addEventListener('resize', resize);

  // cursor / dedo -> ponto no piso (y = 0)
  const pointer = [3, -2], pointerTarget = [3, -2];
  let lastMove = -1e9;
  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const th = Math.tan(fov / 2);
    const dir = [
      -view.z[0] + nx * th * aspect * view.x[0] + ny * th * view.y[0],
      -view.z[1] + nx * th * aspect * view.x[1] + ny * th * view.y[1],
      -view.z[2] + nx * th * aspect * view.x[2] + ny * th * view.y[2]
    ];
    if (dir[1] >= -0.01) return;
    const k = -eye[1] / dir[1];
    pointerTarget[0] = eye[0] + dir[0] * k;
    pointerTarget[1] = eye[2] + dir[2] * k;
    lastMove = performance.now();
  }
  host.addEventListener('pointermove', onMove, { passive: true });
  const onTouch = (e) => { if (e.touches[0]) onMove(e.touches[0]); };
  host.addEventListener('touchstart', onTouch, { passive: true });
  host.addEventListener('touchmove', onTouch, { passive: true });

  // inclinar o celular move a câmera (Android libera sem pedir permissão)
  let tiltX = 0, tiltY = 0, tx = 0, ty = 0;
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    tx = Math.max(-1, Math.min(1, e.gamma / 30));
    ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
  }, { passive: true });

  let scrollK = 0;
  const t0 = performance.now();

  function frame() {
    const time = (performance.now() - t0) / 1000;
    if (performance.now() - lastMove > 2500) {
      pointerTarget[0] = Math.sin(time * 0.35) * 6 + 2;
      pointerTarget[1] = Math.cos(time * 0.27) * 3 - 4;
    }
    pointer[0] += (pointerTarget[0] - pointer[0]) * 0.07;
    pointer[1] += (pointerTarget[1] - pointer[1]) * 0.07;
    tiltX += (tx - tiltX) * 0.05;
    tiltY += (ty - tiltY) * 0.05;

    eye = [tiltX * 2.2, 7.2 + scrollK * 3 - tiltY * 1.2, 12.5 - scrollK * 2];
    view = lookAt(eye, target);
    const pv = mul(perspective(fov, aspect, 0.1, 100), view.m);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniformMatrix4fv(uPV, false, pv);
    gl.uniform3fv(uCam, eye);
    gl.uniform1f(uTime, time);
    gl.uniform2fv(uPointer, pointer);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 18, COUNT);
  }

  let running = false;
  function loop() {
    if (!running) return;
    frame();
    requestAnimationFrame(loop);
  }

  if (reduced) {
    frame();
  } else {
    let inView = true;
    const sync = () => {
      const vis = inView && !document.hidden;
      if (vis && !running) { running = true; loop(); }
      else if (!vis) running = false;
    };
    new IntersectionObserver(([en]) => { inView = en.isIntersecting; sync(); }).observe(host);
    document.addEventListener('visibilitychange', sync);
    sync();
  }

  return { setScroll(k) { scrollK = k; if (reduced) frame(); } };
}
