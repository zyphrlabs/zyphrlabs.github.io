import * as THREE from './vendor/three.module.min.js';
import { RGBELoader } from './vendor/RGBELoader.js';

const stage = document.getElementById('artwork-stage');
const canvas = document.getElementById('webgl');
const visuals = document.querySelector('.orb-visuals');
const motionButton = document.querySelector('.motion-toggle');
// The selected finish: Full foil, 80% iridescence.
const IRIDESCENT_BALANCE = .8;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let paused = motionPreference.matches;

function createSculpture() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .98;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 50);
  camera.position.set(0, 0, 4.4);

  // Neutral studio lights define the chrome. A separate holographic reflector
  // supplies the flowing iridescent reflections, without coloring the backdrop.
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x25262b);
  const panelGeometry = new THREE.PlaneGeometry(1, 1);
  const panelMaterials = [];
  function softbox(position, size, color, intensity, map = null) {
    const material = new THREE.MeshBasicMaterial({ color, map, side: THREE.DoubleSide });
    material.color.multiplyScalar(intensity);
    panelMaterials.push(material);
    const panel = new THREE.Mesh(panelGeometry, material);
    panel.position.set(...position);
    panel.scale.set(...size, 1);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  }
  const reflectorCanvas = document.createElement('canvas');
  reflectorCanvas.width = 512;
  reflectorCanvas.height = 512;
  const context = reflectorCanvas.getContext('2d');
  const spectrum = context.createLinearGradient(0, 0, 512, 350);
  [[0, '#7286cd'], [.18, '#9ed9db'], [.38, '#cec5e7'], [.57, '#d69fab'], [.76, '#e4d2a8'], [1, '#b2c8ed']]
    .forEach(([stop, color]) => spectrum.addColorStop(stop, color));
  context.fillStyle = spectrum;
  context.fillRect(0, 0, 512, 512);
  context.globalCompositeOperation = 'screen';
  for (let i = 0; i < 4; i++) {
    context.beginPath();
    context.moveTo(-80, 70 + i * 140);
    context.bezierCurveTo(90, -30 + i * 140, 230, 200 + i * 140, 580, 50 + i * 140);
    context.strokeStyle = 'rgba(255,255,255,.5)';
    context.lineWidth = 22;
    context.shadowColor = '#fff';
    context.shadowBlur = 35;
    context.stroke();
  }
  const reflectorTexture = new THREE.CanvasTexture(reflectorCanvas);
  reflectorTexture.colorSpace = THREE.SRGBColorSpace;
  softbox([-3.5, 2.5, 3], [3.2, 5], 0xffffff, 3);
  softbox([3.2, .5, 2.8], [.6, 5], 0xe4edff, 3.8);
  softbox([.5, 4, -.5], [5, 1.2], 0xffffff, 3.8);
  softbox([-1, -3, 2], [4, .65], 0xf2f1f7, 2.5);
  softbox([2.8, 0, 1.4], [3, 5], 0xffffff, 2.3, reflectorTexture);
  softbox([-2.2, -.6, -2.2], [3.5, 4], 0xffffff, 2, reflectorTexture);
  softbox([.2, 2, -3], [4, 2.5], 0xffffff, 1.8, reflectorTexture);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, 0);
  scene.environment = environment.texture;
  panelGeometry.dispose();
  panelMaterials.forEach(material => material.dispose());
  pmrem.dispose();
  reflectorTexture.dispose();

  const filmPixels = new Uint8Array(128 * 32 * 4);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 128; x++) {
      const thickness = .5 + .32 * Math.sin(x / 128 * Math.PI * 4) + .12 * Math.cos(y / 32 * Math.PI * 2);
      const index = (y * 128 + x) * 4;
      filmPixels[index] = filmPixels[index + 1] = filmPixels[index + 2] = Math.round(thickness * 255);
      filmPixels[index + 3] = 255;
    }
  }
  const filmTexture = new THREE.DataTexture(filmPixels, 128, 32);
  filmTexture.wrapS = filmTexture.wrapT = THREE.RepeatWrapping;
  filmTexture.magFilter = filmTexture.minFilter = THREE.LinearFilter;
  filmTexture.needsUpdate = true;
  const grainPixels = new Uint8Array(128 * 128 * 4);
  for (let i = 0; i < 128 * 128; i++) {
    const noise = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    const grain = 100 + Math.round((noise - Math.floor(noise)) * 56);
    grainPixels[i * 4] = grainPixels[i * 4 + 1] = grainPixels[i * 4 + 2] = grain;
    grainPixels[i * 4 + 3] = 255;
  }
  const grainTexture = new THREE.DataTexture(grainPixels, 128, 128);
  grainTexture.wrapS = grainTexture.wrapT = THREE.RepeatWrapping;
  grainTexture.repeat.set(3, 3);
  grainTexture.magFilter = grainTexture.minFilter = THREE.LinearFilter;
  grainTexture.needsUpdate = true;
  const foilPlaceholder = new THREE.DataTexture(new Uint8Array([200, 185, 220, 255]), 1, 1);
  foilPlaceholder.needsUpdate = true;
  const foilMap = { value: foilPlaceholder };
  const materialMix = { value: IRIDESCENT_BALANCE };
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xd5d7df,
    metalness: 1,
    roughness: .08 + materialMix.value * .14,
    iridescence: materialMix.value * .95,
    iridescenceIOR: 1.45,
    iridescenceThicknessRange: [220, 480],
    iridescenceThicknessMap: filmTexture,
    clearcoat: 0,
    bumpMap: grainTexture,
    bumpScale: materialMix.value * .0025,
    envMapIntensity: 1.05,
    side: THREE.DoubleSide,
  });
  const surfaceTime = { value: 0 };
  const hoverPoint = { value: new THREE.Vector3(0, 0, 1) };
  const hoverStrength = { value: 0 };
  material.onBeforeCompile = shader => {
    shader.uniforms.uSurfaceTime = surfaceTime;
    shader.uniforms.uHoverPoint = hoverPoint;
    shader.uniforms.uHoverStrength = hoverStrength;
    shader.uniforms.uMaterialMix = materialMix;
    shader.uniforms.uFoilMap = foilMap;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `
      #include <common>
      uniform float uSurfaceTime;
      uniform vec3 uHoverPoint;
      uniform float uHoverStrength;
      varying vec3 vMetalSurface;
      vec3 livingSurface(vec3 p) {
        vec3 n = normalize(p);
        float t = uSurfaceTime * 1.45;
        vec3 flow = n + .17 * vec3(
          sin(n.y * 3.0 + t * .27),
          sin(n.z * 3.4 - t * .23),
          sin(n.x * 3.2 + t * .19)
        );
        float wave = sin(flow.x * 4.1 + flow.y * 2.8 - t * .36)
          * sin(flow.y * 3.7 + flow.z * 3.2 + t * .29);
        float current = sin(flow.x * 6.2 - flow.z * 4.8 + t * .26)
          * sin(flow.y * 5.0 + flow.x * 2.2 - t * .17);
        float breath = sin(t * .6) * .026;
        float pulse = sin(t * .85 + dot(n, vec3(2.0, 1.0, 3.0))) * .014;
        float proximity = length(n - normalize(uHoverPoint));
        float pull = exp(-proximity * proximity * 7.0) * .065;
        float ripple = sin(proximity * 18.0 - t * 3.5) * exp(-proximity * 3.0) * .025;
        return n * (1.0 + wave * .105 + current * .042 + breath + pulse
          + uHoverStrength * (pull + ripple));
      }
    `);
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
      vec3 direction = normalize(position);
      vec3 axis = abs(direction.y) > .99 ? vec3(1.,0.,0.) : vec3(0.,1.,0.);
      vec3 tangent = normalize(cross(axis,direction));
      vec3 bitangent = normalize(cross(direction,tangent));
      vec3 center = livingSurface(position);
      vec3 a = livingSurface(normalize(direction + tangent * .001));
      vec3 b = livingSurface(normalize(direction + bitangent * .001));
      vec3 objectNormal = normalize(cross(a-center,b-center));
    `);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = livingSurface(position); vMetalSurface = transformed;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      uniform float uSurfaceTime;
      uniform vec3 uHoverPoint;
      uniform float uHoverStrength;
      uniform float uMaterialMix;
      uniform sampler2D uFoilMap;
      varying vec3 vMetalSurface;
      vec3 sampleFoil(vec3 p) {
        vec3 weights = pow(abs(normalize(p)), vec3(4.0));
        weights /= max(dot(weights, vec3(1.0)), .001);
        vec2 drift = vec2(sin(uSurfaceTime * .095), cos(uSurfaceTime * .13)) * .035;
        vec3 x = texture2D(uFoilMap, p.yz * .35 + .5 + drift).rgb;
        vec3 y = texture2D(uFoilMap, p.xz * .35 + .5 + drift).rgb;
        vec3 z = texture2D(uFoilMap, p.xy * .35 + .5 + drift).rgb;
        return x * weights.x + y * weights.y + z * weights.z;
      }
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      diffuseColor.rgb *= mix(vec3(1.0), sampleFoil(vMetalSurface), uMaterialMix * .9);
    `);
    // Model a slowly shifting prismatic reflector over the neutral studio.
    // Tint the reflected light, leaving unlit metal dark and the backdrop black.
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 reflectionDirection = reflect(-normalize(vViewPosition), normal);
      float filmPhase = dot(reflectionDirection, vec3(.4, .6, .25)) * 1.7
        + sin(dot(vMetalSurface, vec3(2.0, 1.4, 1.8)) + uSurfaceTime * .12) * .2;
      float attention = exp(-length(normalize(vMetalSurface) - normalize(uHoverPoint)) * 3.0) * uHoverStrength;
      filmPhase += attention * .16;
      float grazingAngle = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
      vec3 prism = .55 + .45 * cos(6.28318 * (filmPhase + grazingAngle * .7 + vec3(.05, .38, .70)));
      vec3 foil = sampleFoil(vMetalSurface);
      float chroma = uMaterialMix;
      vec3 reflectionTint = mix(prism, foil, .25);
      outgoingLight *= mix(vec3(1.0), reflectionTint * 1.25, chroma * .8);
      outgoingLight += reflectionTint * chroma * .12;
      #include <opaque_fragment>
    `);
  };
  const mobile = matchMedia('(max-width: 760px)').matches;
  const geometry = new THREE.SphereGeometry(1, mobile ? 128 : 224, mobile ? 128 : 224);
  const sculpture = new THREE.Mesh(geometry, material);
  sculpture.rotation.set(.12, -.3, -.12);
  scene.add(sculpture);

  let elapsed = 0;
  let raf = 0;
  let lastTime = 0;
  let visible = true;
  let disposed = false;
  let firstFrame = true;
  let lightingReady = false;
  let foilReady = false;
  let hoverTarget = 0;
  let interactionUntil = 0;
  const pointer = new THREE.Vector2();
  const smoothPointer = new THREE.Vector2();
  const hoverTargetPoint = new THREE.Vector3(0, 0, 1);
  const raycaster = new THREE.Raycaster();
  const hit = new THREE.Vector3();
  const hitSphere = new THREE.Sphere(new THREE.Vector3(), 1.13);
  function requestRender() {
    if (!raf && !disposed && visible && !document.hidden) raf = requestAnimationFrame(render);
  }
  function resize() {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Keep the complete silhouette framed on narrow screens as well.
    camera.position.z = camera.aspect < 1 ? 4.4 / Math.max(camera.aspect, .8) : 4.4;
    camera.updateProjectionMatrix();
    requestRender();
  }
  function render(now) {
    raf = 0;
    if (disposed || !lightingReady || !foilReady) return;
    const dt = Math.min((now - (lastTime || now)) / 1000, .05);
    lastTime = now;
    const ease = motionPreference.matches ? 1 : 1 - Math.exp(-dt * 5);
    hoverStrength.value = THREE.MathUtils.lerp(hoverStrength.value, hoverTarget, ease);
    hoverPoint.value.lerp(hoverTargetPoint, ease);
    smoothPointer.lerp(pointer, ease);
    if (!paused) {
      elapsed += dt;
      surfaceTime.value = elapsed;
      sculpture.rotation.x = .12 + Math.sin(elapsed * .12) * .10 + smoothPointer.y * .26;
      sculpture.rotation.y = -.3 + elapsed * .065 + smoothPointer.x * .38;
      sculpture.rotation.z = -.12 + Math.sin(elapsed * .09) * .06;
      sculpture.position.y = Math.sin(elapsed * .55) * .025;
    }
    sculpture.scale.setScalar(1 + hoverStrength.value * .035);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      stage.classList.add('is-ready');
      motionButton.hidden = false;
    }
    if (!paused || now < interactionUntil) requestRender();
  }
  function updateMotionControl() {
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', paused ? 'Play sculpture motion' : 'Pause sculpture motion');
  }
  motionButton.addEventListener('click', () => {
    paused = !paused;
    updateMotionControl();
    lastTime = 0;
    requestRender();
  });
  motionPreference.addEventListener('change', event => {
    paused = event.matches;
    if (event.matches) {
      pointer.set(0, 0);
      smoothPointer.set(0, 0);
      hoverTarget = hoverStrength.value = 0;
      stage.classList.remove('is-hovered');
    }
    updateMotionControl();
    requestRender();
  });
  stage.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || motionPreference.matches || event.target.closest('button, input')) return;
    const bounds = visuals.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width - .5, (event.clientY - bounds.top) / bounds.height - .5);
    raycaster.setFromCamera(new THREE.Vector2(pointer.x * 2, -pointer.y * 2), camera);
    hitSphere.center.copy(sculpture.position);
    hoverTarget = raycaster.ray.intersectSphere(hitSphere, hit) ? 1 : 0;
    if (hoverTarget) {
      sculpture.updateMatrixWorld();
      hoverTargetPoint.copy(hit);
      sculpture.worldToLocal(hoverTargetPoint);
    }
    stage.classList.toggle('is-hovered', Boolean(hoverTarget));
    interactionUntil = performance.now() + 1600;
    requestRender();
  }, { passive: true });
  stage.addEventListener('pointerleave', () => {
    pointer.set(0, 0);
    hoverTarget = 0;
    stage.classList.remove('is-hovered');
    interactionUntil = performance.now() + 1600;
    requestRender();
  });
  updateMotionControl();

  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(stage);
  const visibilityObserver = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    lastTime = 0;
    if (visible) requestRender();
  });
  visibilityObserver.observe(stage);
  document.addEventListener('visibilitychange', () => {
    lastTime = 0;
    if (!document.hidden) requestRender();
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    disposed = true;
    cancelAnimationFrame(raf);
    sizeObserver.disconnect();
    visibilityObserver.disconnect();
    stage.classList.remove('is-hovered');
    stage.classList.remove('is-ready');
    motionButton.hidden = true;
  });
  resize();
  new THREE.TextureLoader().load('./assets/iridescent-foil.png', texture => {
    if (disposed) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    foilMap.value = texture;
    foilPlaceholder.dispose();
    foilReady = true;
    requestRender();
  }, undefined, () => {
    foilReady = true;
    requestRender();
  });
  new RGBELoader().load('./assets/studio-small-09.hdr', texture => {
    if (disposed) { texture.dispose(); return; }
    // Preserve neutral photographic reflections so the surface reads as chrome.
    // Moderate flags control broad highlights, with a faint prismatic accent.
    const { data, width, height } = texture.image;
    for (let y = 0; y < height; y++) {
      const v = y / height;
      for (let x = 0; x < width; x++) {
        const u = x / width;
        const index = (y * width + x) * 4;
        const bands = .57 + .43 * Math.pow(Math.abs(Math.sin(v * Math.PI * 3 + Math.sin(u * Math.PI * 4) * .3)), 4);
        for (let channel = 0; channel < 3; channel++) {
          const radiance = THREE.DataUtils.fromHalfFloat(data[index + channel]);
          const hue = .9 + .1 * Math.cos(Math.PI * 2 * (u * 1.5 + v * .8 + [0, .33, .67][channel]));
          data[index + channel] = THREE.DataUtils.toHalfFloat(radiance / (1 + radiance * .12) * bands * hue);
        }
      }
    }
    texture.needsUpdate = true;
    const generator = new THREE.PMREMGenerator(renderer);
    const photographicEnvironment = generator.fromEquirectangular(texture);
    scene.environment = photographicEnvironment.texture;
    scene.environmentRotation.set(0, .55, 0);
    texture.dispose();
    environment.dispose();
    generator.dispose();
    lightingReady = true;
    requestRender();
  }, undefined, () => {
    // Retain the procedural studio if the photographic environment can't load.
    lightingReady = true;
    requestRender();
  });
}

try {
  createSculpture();
} catch (error) {
  console.warn('Interactive sculpture unavailable:', error.message);
  canvas.setAttribute('aria-label', 'Metallic sculpture preview');
}
