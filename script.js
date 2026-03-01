const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl');

const speedEl = document.getElementById('speed');
const detailEl = document.getElementById('detail');
const glowEl = document.getElementById('glow');
const qualityEl = document.getElementById('quality');

const startBtn = document.getElementById('startBtn');
const benchBtn = document.getElementById('benchBtn');

const fpsEl = document.getElementById('fps');
const frameMsEl = document.getElementById('frameMs');
const avgFpsEl = document.getElementById('avgFps');
const lowFpsEl = document.getElementById('lowFps');
const scoreBarEl = document.getElementById('scoreBar');
const benchStatusEl = document.getElementById('benchStatus');

const gpuVendorEl = document.getElementById('gpuVendor');
const gpuRendererEl = document.getElementById('gpuRenderer');
const gpuWebglEl = document.getElementById('gpuWebgl');

if (!gl) {
  benchStatusEl.textContent = 'WebGL unavailable in this browser.';
  throw new Error('WebGL not supported');
}

const dbg = gl.getExtension('WEBGL_debug_renderer_info');
if (dbg) {
  gpuVendorEl.textContent = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || 'Unknown';
  gpuRendererEl.textContent = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || 'Unknown';
} else {
  gpuVendorEl.textContent = gl.getParameter(gl.VENDOR) || 'Unknown';
  gpuRendererEl.textContent = gl.getParameter(gl.RENDERER) || 'Unknown';
}

gpuWebglEl.textContent = `WebGL ${gl.getParameter(gl.VERSION)}`;

const vertexSrc = `
attribute vec2 aPos;
void main(){
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const fragmentSrc = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uSpeed;
uniform float uGlow;
uniform float uDetail;

mat2 rot(float a){
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float mandelbulbDE(vec3 p){
  vec3 z = p;
  float dr = 1.0;
  float r = 0.0;
  const float power = 8.0;

  for(int i = 0; i < 8; i++) {
    r = length(z);
    if (r > 2.0) break;

    float theta = acos(clamp(z.z / max(r, 0.00001), -1.0, 1.0));
    float phi = atan(z.y, z.x);
    dr = pow(r, power - 1.0) * power * dr + 1.0;

    float zr = pow(r, power);
    theta *= power;
    phi *= power;

    z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta));
    z += p;
  }

  return 0.5 * log(r) * r / dr;
}

float map(vec3 p){
  p.xz *= rot(uTime * 0.12 * uSpeed);
  p.xy *= rot(uTime * 0.08 * uSpeed);

  vec3 q = p * 1.05;
  float d = mandelbulbDE(q);

  float shell = abs(length(p) - 1.8) - 0.25;
  d = min(d, shell * 0.35);

  return d;
}

vec3 getNormal(vec3 p){
  vec2 e = vec2(0.0015, 0.0);
  float d = map(p);
  vec3 n = d - vec3(
    map(p - e.xyy),
    map(p - e.yxy),
    map(p - e.yyx)
  );
  return normalize(n);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes.xy) / uRes.y;

  vec3 ro = vec3(0.0, 0.0, -4.4);
  ro.xz *= rot(uTime * 0.18 * uSpeed);
  vec3 ta = vec3(0.0);

  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(vec3(0.0, 1.0, 0.0), ww));
  vec3 vv = cross(ww, uu);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.8 * ww);

  float t = 0.0;
  float hit = -1.0;
  float glow = 0.0;

  float maxSteps = uDetail;
  for(int i = 0; i < 140; i++) {
    if (float(i) >= maxSteps) break;

    vec3 p = ro + rd * t;
    float d = map(p);

    glow += exp(-18.0 * abs(d)) * 0.05;

    if (d < 0.0014) {
      hit = t;
      break;
    }

    t += clamp(d, 0.005, 0.08);
    if (t > 12.0) break;
  }

  vec3 col = vec3(0.0);

  if (hit > 0.0) {
    vec3 p = ro + rd * hit;
    vec3 n = getNormal(p);
    vec3 l = normalize(vec3(0.4, 0.8, -0.55));

    float diff = max(0.0, dot(n, l));
    float fres = pow(1.0 - max(0.0, dot(-rd, n)), 2.5);

    float hue = 0.2 + 0.45 * sin(2.1 * p.x + 1.3 * p.y + 1.8 * p.z) + 0.2 * sin(uTime * 0.35);
    hue = fract(hue + 0.15 * n.y + 0.1 * n.x);

    vec3 base = hsv2rgb(vec3(hue, 0.92, 0.95));
    vec3 rim = hsv2rgb(vec3(fract(hue + 0.3), 0.8, 1.0));

    col = base * (0.2 + 1.05 * diff);
    col += rim * fres * 0.95;

    float ao = clamp(1.0 - hit * 0.06, 0.0, 1.0);
    col *= ao;
  }

  col += vec3(0.12, 0.75, 1.0) * glow * uGlow;
  col = pow(max(col, vec3(0.0)), vec3(0.86));

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || 'shader compile failed');
  }
  return sh;
}

const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertexSrc));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragmentSrc));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
  throw new Error(gl.getProgramInfoLog(prog) || 'program link failed');
}

gl.useProgram(prog);

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1, -1,
  1, -1,
  -1, 1,
  -1, 1,
  1, -1,
  1, 1,
]), gl.STATIC_DRAW);

const aPos = gl.getAttribLocation(prog, 'aPos');
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const uRes = gl.getUniformLocation(prog, 'uRes');
const uTime = gl.getUniformLocation(prog, 'uTime');
const uSpeed = gl.getUniformLocation(prog, 'uSpeed');
const uGlow = gl.getUniformLocation(prog, 'uGlow');
const uDetail = gl.getUniformLocation(prog, 'uDetail');

function resize() {
  const q = parseFloat(qualityEl.value);
  const dpr = Math.min(window.devicePixelRatio || 1, 2) * q;
  canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
qualityEl.addEventListener('change', resize);

let running = false;
let last = performance.now();
let benchOn = false;
let benchStart = 0;
let samples = [];

function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (s.length - 1));
  return s[idx];
}

function loop(now) {
  const dt = now - last;
  last = now;

  const fps = 1000 / Math.max(dt, 0.0001);
  fpsEl.textContent = fps.toFixed(1);
  frameMsEl.textContent = `${dt.toFixed(2)}ms`;
  scoreBarEl.style.width = `${Math.min(100, (fps / 144) * 100).toFixed(0)}%`;

  if (benchOn) {
    samples.push(fps);
    const elapsed = (now - benchStart) / 1000;
    benchStatusEl.textContent = `Running benchmark... ${elapsed.toFixed(1)} / 10.0s`;

    if (elapsed >= 10) {
      benchOn = false;
      benchBtn.disabled = false;
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      const low = percentile(samples, 1);
      avgFpsEl.textContent = avg.toFixed(1);
      lowFpsEl.textContent = low.toFixed(1);
      benchStatusEl.textContent = `Done. ${samples.length} samples captured.`;
      samples = [];
    }
  }

  gl.uniform2f(uRes, canvas.width, canvas.height);
  gl.uniform1f(uTime, now * 0.001);
  gl.uniform1f(uSpeed, parseFloat(speedEl.value));
  gl.uniform1f(uGlow, parseFloat(glowEl.value));
  gl.uniform1f(uDetail, parseFloat(detailEl.value));

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  if (running) requestAnimationFrame(loop);
}

startBtn.addEventListener('click', () => {
  if (running) return;
  running = true;
  benchStatusEl.textContent = 'GPU test started. Rendering volume shader...';
  last = performance.now();
  requestAnimationFrame(loop);
});

benchBtn.addEventListener('click', () => {
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }
  benchOn = true;
  benchBtn.disabled = true;
  samples = [];
  benchStart = performance.now();
  benchStatusEl.textContent = 'Benchmark starting...';
});

resize();
gl.clearColor(0, 0, 0, 1);
gl.clear(gl.COLOR_BUFFER_BIT);
benchStatusEl.textContent = 'Idle — press Start GPU Test to render.';
