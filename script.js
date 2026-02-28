const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl');

const speedEl = document.getElementById('speed');
const glowEl = document.getElementById('glow');
const distortEl = document.getElementById('distort');
const hueEl = document.getElementById('hue');

const benchBtn = document.getElementById('benchBtn');
const benchStatus = document.getElementById('benchStatus');
const fpsEl = document.getElementById('fps');
const avgFpsEl = document.getElementById('avgFps');
const lowFpsEl = document.getElementById('lowFps');

if (!gl) {
  benchStatus.textContent = 'WebGL is not supported in this browser.';
  throw new Error('WebGL not supported');
}

const vShader = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const fShader = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uSpeed;
uniform float uGlow;
uniform float uDistort;
uniform float uHue;

vec3 palette(float t) {
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.00 + uHue, 0.10 + uHue * 0.5, 0.20 + uHue * 0.25);
  return a + b * cos(6.28318 * (c * t + d));
}

mat2 rot(float a){
  float c = cos(a), s = sin(a);
  return mat2(c,-s,s,c);
}

float map(vec3 p){
  p.xy *= rot(uTime * 0.2 * uSpeed);
  p.xz *= rot(uTime * 0.17 * uSpeed);
  float tunnel = length(p.xy) - (1.2 + 0.2 * sin(p.z * 2.0 + uTime));
  float wave = sin(p.z * 3.0 + uTime * 2.5 * uSpeed) * 0.15 * uDistort;
  return tunnel + wave;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes.xy) / uRes.y;
  vec3 ro = vec3(0.0, 0.0, -3.5 + sin(uTime * 0.8 * uSpeed) * 0.25);
  vec3 rd = normalize(vec3(uv, 1.2));

  float t = 0.0;
  float d = 0.0;
  float glow = 0.0;

  for (int i=0; i<80; i++) {
    vec3 p = ro + rd * t;
    d = map(p);
    float g = exp(-8.0 * abs(d));
    glow += g;
    t += clamp(abs(d), 0.02, 0.12);
  }

  float shade = exp(-0.06 * t * t);
  vec3 col = palette(t * 0.08 + uTime * 0.12 * uSpeed) * shade;
  col += vec3(0.2, 0.7, 1.2) * glow * 0.015 * uGlow;
  col = pow(col, vec3(0.8));

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile error');
  }
  return shader;
}

const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER, vShader));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fShader));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  throw new Error(gl.getProgramInfoLog(program) || 'Program link error');
}

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1, -1,
   1, -1,
  -1,  1,
  -1,  1,
   1, -1,
   1,  1,
]), gl.STATIC_DRAW);

gl.useProgram(program);
const aPos = gl.getAttribLocation(program, 'aPos');
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const uRes = gl.getUniformLocation(program, 'uRes');
const uTime = gl.getUniformLocation(program, 'uTime');
const uSpeed = gl.getUniformLocation(program, 'uSpeed');
const uGlow = gl.getUniformLocation(program, 'uGlow');
const uDistort = gl.getUniformLocation(program, 'uDistort');
const uHue = gl.getUniformLocation(program, 'uHue');

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
let fps = 0;
let runningBench = false;
let benchFrames = [];
let benchStart = 0;

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a,b)=>a-b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

function tick(now) {
  const dt = now - last;
  last = now;
  fps = 1000 / Math.max(dt, 0.001);
  fpsEl.textContent = fps.toFixed(1);

  if (runningBench) {
    benchFrames.push(fps);
    const elapsed = (now - benchStart) / 1000;
    benchStatus.textContent = `Benchmark running… ${elapsed.toFixed(1)}s / 10.0s`;
    if (elapsed >= 10) {
      runningBench = false;
      const avg = benchFrames.reduce((a,b)=>a+b,0) / benchFrames.length;
      const onePercentLow = percentile(benchFrames, 1);
      avgFpsEl.textContent = avg.toFixed(1);
      lowFpsEl.textContent = onePercentLow.toFixed(1);
      benchStatus.textContent = `Done. ${benchFrames.length} frames sampled.`;
      benchFrames = [];
      benchBtn.disabled = false;
    }
  }

  gl.uniform2f(uRes, canvas.width, canvas.height);
  gl.uniform1f(uTime, now * 0.001);
  gl.uniform1f(uSpeed, parseFloat(speedEl.value));
  gl.uniform1f(uGlow, parseFloat(glowEl.value));
  gl.uniform1f(uDistort, parseFloat(distortEl.value));
  gl.uniform1f(uHue, parseFloat(hueEl.value));

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(tick);
}

benchBtn.addEventListener('click', () => {
  runningBench = true;
  benchFrames = [];
  benchStart = performance.now();
  benchBtn.disabled = true;
  benchStatus.textContent = 'Benchmark starting…';
});

requestAnimationFrame(tick);
