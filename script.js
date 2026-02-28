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

float hash(vec3 p){
  p = fract(p * 0.3183099 + vec3(.1,.2,.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x){
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 57.0 + i.z * 113.0;
  return mix(mix(mix(hash(vec3(n + 0.0)), hash(vec3(n + 1.0)), f.x),
                 mix(hash(vec3(n + 57.0)), hash(vec3(n + 58.0)), f.x), f.y),
             mix(mix(hash(vec3(n + 113.0)), hash(vec3(n + 114.0)), f.x),
                 mix(hash(vec3(n + 170.0)), hash(vec3(n + 171.0)), f.x), f.y), f.z);
}

vec3 palette(float t){
  return 0.52 + 0.48 * cos(6.28318 * (vec3(0.20,0.35,0.65) * t + vec3(0.0,0.15,0.3)));
}

float scene(vec3 p){
  p.xy *= rot(uTime * 0.14 * uSpeed);
  p.xz *= rot(uTime * 0.11 * uSpeed);
  float base = length(p.xy) - (1.25 + sin(p.z * 1.9 + uTime * uSpeed) * 0.16);
  float f = 0.0;
  vec3 q = p * 1.25;
  for (int i=0; i<5; i++) {
    f += noise(q) / pow(2.0, float(i));
    q *= 1.9;
  }
  return base + (f - 0.5) * 0.42;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.0, -3.5);
  vec3 rd = normalize(vec3(uv, 1.3));

  float t = 0.0;
  float glow = 0.0;
  float steps = uDetail;

  for (int i=0; i<140; i++) {
    if (float(i) >= steps) break;
    vec3 p = ro + rd * t;
    float d = scene(p);
    float g = exp(-8.0 * abs(d));
    glow += g;
    t += clamp(abs(d), 0.015, 0.1);
  }

  float shade = exp(-0.04 * t * t);
  vec3 col = palette(t * 0.13 + uTime * 0.1 * uSpeed) * shade;
  col += vec3(0.0, 0.95, 1.25) * glow * 0.017 * uGlow;
  col = pow(col, vec3(0.82));

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
  if (!running) {
    running = true;
    benchStatusEl.textContent = 'GPU test started.';
    last = performance.now();
    requestAnimationFrame(loop);
  }
});

benchBtn.addEventListener('click', () => {
  if (!running) {
    running = true;
    requestAnimationFrame(loop);
  }
  benchOn = true;
  benchBtn.disabled = true;
  samples = [];
  benchStart = performance.now();
  benchStatusEl.textContent = 'Benchmark starting...';
});

resize();
running = true;
requestAnimationFrame(loop);
