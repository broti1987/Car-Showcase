const container = document.getElementById("hero-car");

// --------------------
// LOADER UI
// --------------------
const sceneLoader = createSceneLoader();

// --------------------
// SCENE
// --------------------
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  42,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);

const scrollState = {
  current: 0,
  target: 0
};

const cameraPath = {
  from: new THREE.Vector3(),
  to: new THREE.Vector3(),
  lookFrom: new THREE.Vector3(0, 1.2, 0),
  lookTo: new THREE.Vector3(0.2, 1.4, -0.8),
  currentLook: new THREE.Vector3()
};

// zoom completes in the first part of page scroll only
let heroScrollDistance = 280;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function refreshScrollMetrics() {
  heroScrollDistance = window.innerWidth <= 767 ? 180 : 280;
}

function setCameraForViewport() {
  const isMobile = window.innerWidth <= 767;

  if (isMobile) {
    camera.fov = 50;

    cameraPath.from.set(36, 12, 16);
    cameraPath.to.set(30, 11, 14.2);

    cameraPath.lookFrom.set(0, 1.2, 0);
    cameraPath.lookTo.set(0.15, 1.3, -0.2);
  } else {
    camera.fov = 42;

    cameraPath.from.set(30, 10, 12.5);
    cameraPath.to.set(24, 8.8, 11.1);

    cameraPath.lookFrom.set(0, 1.2, 0);
    cameraPath.lookTo.set(0.15, 1.35, -0.35);
  }

  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();

  updateCameraFromScroll(scrollState.current);
}

function updateCameraFromScroll(progress) {
  const eased = easeInOutCubic(clamp(progress, 0, 1));

  camera.position.lerpVectors(cameraPath.from, cameraPath.to, eased);
  cameraPath.currentLook.lerpVectors(
    cameraPath.lookFrom,
    cameraPath.lookTo,
    eased
  );

  camera.lookAt(cameraPath.currentLook);
}

function updateScrollTarget() {
  const traveled = clamp(window.scrollY, 0, heroScrollDistance);
  const rawProgress = traveled / heroScrollDistance;

  scrollState.target = clamp(rawProgress, 0, 1);
}

setCameraForViewport();
refreshScrollMetrics();
updateScrollTarget();

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.physicallyCorrectLights = true;
renderer.domElement.style.opacity = "0";
renderer.domElement.style.transition = "opacity 900ms ease";
container.appendChild(renderer.domElement);

// --------------------
// FILM GRAIN OVERLAY
// --------------------
const filmGrain = createFilmGrainOverlay(container);

// --------------------
// LOADING MANAGER
// --------------------
const loadingManager = new THREE.LoadingManager();

loadingManager.onStart = function () {
  updateSceneLoader(0.02);
};

loadingManager.onProgress = function (_url, itemsLoaded, itemsTotal) {
  const progress = itemsTotal > 0 ? itemsLoaded / itemsTotal : 0;
  updateSceneLoader(Math.max(0.02, Math.min(progress, 0.98)));
};

loadingManager.onLoad = function () {
  updateSceneLoader(1);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      finishSceneLoader();
    });
  });
};

loadingManager.onError = function (url) {
  console.warn("Failed loading:", url);
};

// --------------------
// ENVIRONMENT
// --------------------
const cubeMap = new THREE.CubeTextureLoader(loadingManager).load([
  "data/env/cubemap/posx.jpg",
  "data/env/cubemap/negx.jpg",
  "data/env/cubemap/posy.jpg",
  "data/env/cubemap/negy.jpg",
  "data/env/cubemap/posz.jpg",
  "data/env/cubemap/negz.jpg"
]);
cubeMap.encoding = THREE.sRGBEncoding;
scene.environment = cubeMap;

// --------------------
// LIGHTS
// --------------------
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x040404, 0.9);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
keyLight.position.set(-8, 9, 10);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 1.15);
fillLight.position.set(8, 5, 6);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 2.1);
rimLight.position.set(0, 8, -12);
scene.add(rimLight);

const backGlow = new THREE.PointLight(0x88aaff, 6, 45);
backGlow.position.set(0, 3, -10);
scene.add(backGlow);

// --------------------
// GROUNDING GLOW
// --------------------
const underGlow = new THREE.Mesh(
  new THREE.CircleGeometry(64, 64),
  new THREE.MeshBasicMaterial({
    color: 0x1f292e,
    transparent: true,
    opacity: 0.1,
    depthWrite: false
  })
);
underGlow.rotation.x = -Math.PI / 2;
underGlow.position.set(0, 0.012, 0);
scene.add(underGlow);

// --------------------
// CAR GROUP
// --------------------
const carGroup = new THREE.Group();
scene.add(carGroup);

// --------------------
// LOAD MODEL
// --------------------
const loader = new THREE.GLTFLoader(loadingManager);

loader.load(
  "data/aventador/aventador.gltf",
  function (gltf) {
    const carModel = gltf.scene;

    applyCarMaterials(carModel);
    centerModel(carModel);

    carModel.position.set(0, 0.18, 0);
    carGroup.add(carModel);

    addBrakeLightGlow(carModel);
    addHeadlightGlow(carModel);

    const reflection = createMirroredReflection(carModel);
    carGroup.add(reflection);
  },
  undefined,
  function (err) {
    console.error("Failed to load car model:", err);
    finishSceneLoader();
  }
);

// --------------------
// MATERIALS
// --------------------
function applyCarMaterials(root) {
  root.traverse(function (obj) {
    if (!obj.isMesh || !obj.material) return;

    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map(function (mat) {
        return tuneMaterial(mat, obj.name);
      });
    } else {
      obj.material = tuneMaterial(obj.material, obj.name);
    }
  });
}

function tuneMaterial(material, objectName) {
  const m = material.clone();
  const name = (m.name || "").toLowerCase();
  const objName = (objectName || "").toLowerCase();

  // tail / brake lights
  const isTailObject =
    objName.includes("tail_light") || objName.includes("tail_led");

  const isTailReflector =
    name === "mt_reflector_tl" ||
    name === "mt_reflector_bl" ||
    name === "mt_reflector_rl";

  const isTailGlass =
    isTailObject &&
    (name === "mt_glass_translucent" || name === "mt_glass_lens");

  if (isTailReflector || isTailGlass) {
    m.color = new THREE.Color(isTailGlass ? 0x5a0000 : 0x8a0000);

    if (m.emissive) {
      m.emissive = new THREE.Color(0xff1a1a);
      m.emissiveIntensity = isTailGlass ? 1.8 : 2.8;
    }

    m.roughness = 0.18;
    m.metalness = 0.05;
    m.transparent = isTailGlass ? true : m.transparent;
    m.opacity = isTailGlass ? 0.92 : m.opacity;
    m.envMapIntensity = 1.2;
    m.needsUpdate = true;
    return m;
  }

  // headlights
  const isHeadlightObject =
    objName.includes("headlight") || objName.includes("head_light");

  const isHeadlightGlass =
    objName.includes("headlight_glass") ||
    (isHeadlightObject &&
      (name === "mt_glass_lens" || name === "mt_glass_translucent"));

  const isHeadlightEmitter =
    isHeadlightObject &&
    (
      name === "mt_abs_white_mat" ||
      name === "lichter5" ||
      name === "mt_chrome"
    );

  if (isHeadlightEmitter) {
    m.color = new THREE.Color(0xf5f8ff);

    if (m.emissive) {
      m.emissive = new THREE.Color(0xeef4ff);
      m.emissiveIntensity = name === "mt_chrome" ? 0.6 : 2.6;
    }

    m.roughness = name === "mt_chrome" ? 0.12 : 0.18;
    m.metalness = name === "mt_chrome" ? 0.9 : 0.15;
    m.envMapIntensity = 1.6;
    m.needsUpdate = true;
    return m;
  }

  if (isHeadlightGlass) {
    m.color = new THREE.Color(0xdfe8ff);
    m.transparent = true;
    m.opacity = 0.78;
    m.roughness = 0.02;
    m.metalness = 0.05;
    m.envMapIntensity = 2.8;
    m.side = THREE.DoubleSide;

    if (m.emissive) {
      m.emissive = new THREE.Color(0x8fa8ff);
      m.emissiveIntensity = 0.2;
    }

    m.needsUpdate = true;
    return m;
  }

  // body paint
  if (name === "mt_body" || name === "mt_mirrorcover") {
    m.color = new THREE.Color(0x1f292e);
    m.roughness = 0.34;
    m.metalness = 0.9;
    m.envMapIntensity = 2;
    m.needsUpdate = true;
    return m;
  }

  // wheels
  if (name === "mt_alloywheels") {
    m.color = new THREE.Color(0x101010);
    m.roughness = 0.5;
    m.metalness = 0.85;
    m.envMapIntensity = 0.45;
    m.needsUpdate = true;
    return m;
  }

  // tyres
  if (name === "mt_tyres") {
    m.color = new THREE.Color(0x0b0b0b);
    m.roughness = 0.92;
    m.metalness = 0.02;
    m.needsUpdate = true;
    return m;
  }

  // brake calipers
  if (name === "mt_brakecaliper") {
    m.color = new THREE.Color(0x101010);
    m.roughness = 0.58;
    m.metalness = 0.35;
    m.needsUpdate = true;
    return m;
  }

  // chrome / mirror pieces
  if (name === "mt_chrome") {
    m.color = new THREE.Color(0x1b1b1b);
    m.roughness = 0.24;
    m.metalness = 0.92;
    m.envMapIntensity = 1.0;
    m.needsUpdate = true;
    return m;
  }

  if (name === "mt_mirror" || name === "mirror") {
    m.color = new THREE.Color(0x888888);
    m.roughness = 0.06;
    m.metalness = 1.0;
    m.envMapIntensity = 1.8;
    m.needsUpdate = true;
    return m;
  }

  // windows / windshield / glass
  const isGlass =
    name === "mt_windscreens" ||
    name === "mt_glass_translucent" ||
    name === "mt_glass_lens" ||
    objName.includes("windscreen") ||
    objName.includes("windshield") ||
    objName.includes("glass") ||
    objName.includes("rear_windshield") ||
    objName.includes("orvm_shield_glass");

  if (isGlass) {
    m.color = new THREE.Color(0x1a1d22);
    m.transparent = true;
    m.opacity = 0.62;
    m.roughness = 0.04;
    m.metalness = 0.15;
    m.envMapIntensity = 2.1;
    m.side = THREE.DoubleSide;

    if (m.emissive) {
      m.emissive = new THREE.Color(0x050607);
      m.emissiveIntensity = 0.1;
    }

    m.needsUpdate = true;
    return m;
  }

  if (m.color) {
    m.color = m.color.clone().multiplyScalar(0.8);
  }

  if (typeof m.envMapIntensity === "number") {
    m.envMapIntensity = Math.max(m.envMapIntensity || 0, 0.5);
  }

  m.needsUpdate = true;
  return m;
}

// --------------------
// BRAKE LIGHT GLOW
// --------------------
function addBrakeLightGlow(carModel) {
  const tailTargets = [];

  carModel.traverse(function (obj) {
    if (!obj.isMesh) return;

    const n = (obj.name || "").toLowerCase();
    if (n.includes("tail_light") || n.includes("tail_led")) {
      tailTargets.push(obj);
    }
  });

  if (!tailTargets.length) return;

  const tailBox = new THREE.Box3();
  tailTargets.forEach(function (obj) {
    tailBox.expandByObject(obj);
  });

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  tailBox.getSize(size);
  tailBox.getCenter(center);

  const glowTexture = createGlowTexture("red");
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xff2a2a,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const leftGlow = new THREE.Sprite(glowMaterial.clone());
  const rightGlow = new THREE.Sprite(glowMaterial.clone());

  const halfWidth = size.x * 0.32;
  const glowY = center.y;
  const glowZ = center.z;

  leftGlow.position.set(center.x - halfWidth, glowY, glowZ);
  rightGlow.position.set(center.x + halfWidth, glowY, glowZ);

  leftGlow.scale.set(0.9, 0.45, 1);
  rightGlow.scale.set(0.9, 0.45, 1);

  carModel.add(leftGlow);
  carModel.add(rightGlow);
}

// --------------------
// HEADLIGHT GLOW
// --------------------
function addHeadlightGlow(carModel) {
  const headTargets = [];

  carModel.traverse(function (obj) {
    if (!obj.isMesh) return;

    const n = (obj.name || "").toLowerCase();
    if (n.includes("headlight") || n.includes("head_light")) {
      headTargets.push(obj);
    }
  });

  if (!headTargets.length) return;

  const headBox = new THREE.Box3();
  headTargets.forEach(function (obj) {
    headBox.expandByObject(obj);
  });

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  headBox.getSize(size);
  headBox.getCenter(center);

  const glowTexture = createGlowTexture("white");
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xf2f6ff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const leftGlow = new THREE.Sprite(glowMaterial.clone());
  const rightGlow = new THREE.Sprite(glowMaterial.clone());

  const halfWidth = size.x * 0.28;
  const glowY = center.y;
  const glowZ = center.z + 0.12;

  leftGlow.position.set(center.x - halfWidth, glowY, glowZ);
  rightGlow.position.set(center.x + halfWidth, glowY, glowZ);

  leftGlow.scale.set(0.75, 0.42, 1);
  rightGlow.scale.set(0.75, 0.42, 1);

  carModel.add(leftGlow);
  carModel.add(rightGlow);
}

// --------------------
// FAKE REFLECTION
// --------------------
function createMirroredReflection(sourceModel) {
  const reflectionRoot = sourceModel.clone(true);

  reflectionRoot.scale.set(1, -1, 1);
  reflectionRoot.position.set(0, -0.03, 0.08);

  reflectionRoot.traverse(function (obj) {
    if (!obj.isMesh || !obj.material) return;

    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map(function (mat) {
        return makeReflectionMaterial(mat);
      });
    } else {
      obj.material = makeReflectionMaterial(obj.material);
    }

    obj.frustumCulled = false;
  });

  return reflectionRoot;
}

function makeReflectionMaterial(material) {
  const m = material.clone();

  if (m.color) {
    m.color = m.color.clone().multiplyScalar(0.12);
  } else {
    m.color = new THREE.Color(0x050505);
  }

  if (m.emissive) {
    m.emissive = m.emissive.clone().multiplyScalar(0.35);
    m.emissiveIntensity = Math.min(m.emissiveIntensity || 1, 1.0);
  }

  m.transparent = true;
  m.opacity = 0.9;
  m.roughness = 0.5;
  m.metalness = 1;
  m.depthWrite = true;
  m.depthTest = true;
  m.side = THREE.DoubleSide;
  m.needsUpdate = true;

  return m;
}

// --------------------
// HELPERS
// --------------------
function centerModel(model) {
  const box = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  box.getCenter(center);

  model.position.x -= center.x;
  model.position.z -= center.z;

  const updatedBox = new THREE.Box3().setFromObject(model);
  model.position.y -= updatedBox.min.y;
}

function createShadowTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.12,
    size / 2,
    size / 2,
    size * 0.42
  );

  gradient.addColorStop(0, "rgba(0,0,0,0.85)");
  gradient.addColorStop(0.45, "rgba(0,0,0,0.36)");
  gradient.addColorStop(0.75, "rgba(0,0,0,0.10)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createGlowTexture(type) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );

  if (type === "white") {
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.18, "rgba(235,245,255,0.95)");
    gradient.addColorStop(0.42, "rgba(190,220,255,0.45)");
    gradient.addColorStop(1, "rgba(160,200,255,0)");
  } else {
    gradient.addColorStop(0, "rgba(255,70,70,1)");
    gradient.addColorStop(0.2, "rgba(255,40,40,0.9)");
    gradient.addColorStop(0.45, "rgba(255,20,20,0.45)");
    gradient.addColorStop(1, "rgba(255,0,0,0)");
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// --------------------
// FILM GRAIN
// --------------------
function createFilmGrainOverlay(container) {
  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }

  const canvas = document.createElement("canvas");
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "3";
  canvas.style.opacity = "0.3";
  canvas.style.mixBlendMode = "overlay";

  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  const noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = 240;
  noiseCanvas.height = 135;
  const noiseCtx = noiseCanvas.getContext("2d");

  return {
    canvas,
    ctx,
    noiseCanvas,
    noiseCtx,
    lastUpdate: 0
  };
}

function updateFilmGrain(filmGrain, time) {
  if (!filmGrain) return;
  if (time - filmGrain.lastUpdate < 55) return;

  filmGrain.lastUpdate = time;

  const w = filmGrain.noiseCanvas.width;
  const h = filmGrain.noiseCanvas.height;

  const imageData = filmGrain.noiseCtx.createImageData(w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const value = Math.random() * 255;
    const alpha = 18 + Math.random() * 22;

    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = alpha;
  }

  filmGrain.noiseCtx.putImageData(imageData, 0, 0);

  filmGrain.ctx.clearRect(0, 0, filmGrain.canvas.width, filmGrain.canvas.height);
  filmGrain.ctx.imageSmoothingEnabled = true;
  filmGrain.ctx.drawImage(
    filmGrain.noiseCanvas,
    0,
    0,
    filmGrain.canvas.width,
    filmGrain.canvas.height
  );
}

// --------------------
// LOADER HELPERS
// --------------------
function createSceneLoader() {
  const style = document.createElement("style");
  style.textContent = `
    #hero-scene-loader {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.78);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      pointer-events: none;
      transition: opacity 700ms ease, visibility 700ms ease;
    }

    #hero-scene-loader.is-hidden {
      opacity: 0;
      visibility: hidden;
    }

    #hero-scene-loader .loader-line-wrap {
      position: relative;
      width: min(46vw, 560px);
      height: 2px;
      overflow: visible;
    }

    #hero-scene-loader .loader-line-core,
    #hero-scene-loader .loader-line-glow {
      position: absolute;
      left: 0;
      top: 50%;
      width: 100%;
      transform: translateY(-50%) scaleX(0.02);
      transform-origin: center center;
      will-change: transform, opacity;
      transition: transform 220ms ease-out, opacity 350ms ease-out;
    }

    #hero-scene-loader .loader-line-core {
      height: 2px;
      background: linear-gradient(
        90deg,
        rgba(255, 0, 0, 0) 0%,
        rgba(255, 45, 45, 0.95) 20%,
        rgba(255, 75, 75, 1) 50%,
        rgba(255, 45, 45, 0.95) 80%,
        rgba(255, 0, 0, 0) 100%
      );
      box-shadow:
        0 0 10px rgba(255, 40, 40, 0.95),
        0 0 18px rgba(255, 20, 20, 0.65);
    }

    #hero-scene-loader .loader-line-glow {
      height: 10px;
      background: radial-gradient(
        ellipse at center,
        rgba(255, 40, 40, 0.42) 0%,
        rgba(255, 20, 20, 0.18) 45%,
        rgba(255, 0, 0, 0) 100%
      );
      filter: blur(8px);
      opacity: 0.95;
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "hero-scene-loader";
  overlay.innerHTML = `
    <div class="loader-line-wrap">
      <div class="loader-line-glow"></div>
      <div class="loader-line-core"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  return {
    overlay,
    core: overlay.querySelector(".loader-line-core"),
    glow: overlay.querySelector(".loader-line-glow")
  };
}

function updateSceneLoader(progress) {
  const scale = Math.max(0.02, Math.min(progress, 1));
  sceneLoader.core.style.transform = `translateY(-50%) scaleX(${scale})`;
  sceneLoader.glow.style.transform = `translateY(-50%) scaleX(${scale})`;
}

function finishSceneLoader() {
  renderer.domElement.style.opacity = "1";
  sceneLoader.overlay.classList.add("is-hidden");

  setTimeout(function () {
    if (sceneLoader.overlay && sceneLoader.overlay.parentNode) {
      sceneLoader.overlay.parentNode.removeChild(sceneLoader.overlay);
    }
  }, 800);
}

// --------------------
// RESIZE
// --------------------
function onResize() {
  setCameraForViewport();
  refreshScrollMetrics();
  updateScrollTarget();

  renderer.setSize(container.clientWidth, container.clientHeight);

  if (filmGrain && filmGrain.canvas) {
    filmGrain.canvas.width = container.clientWidth;
    filmGrain.canvas.height = container.clientHeight;
  }
}

window.addEventListener("resize", onResize);
window.addEventListener("scroll", updateScrollTarget, { passive: true });
window.addEventListener("load", function () {
  refreshScrollMetrics();
  updateScrollTarget();
});

// --------------------
// ANIMATE
// --------------------
function animate(time) {
  requestAnimationFrame(animate);

  scrollState.current += (scrollState.target - scrollState.current) * 0.08;

  updateCameraFromScroll(scrollState.current);

  carGroup.rotation.y += 0.0035;

  updateFilmGrain(filmGrain, time);
  renderer.render(scene, camera);
}

animate();
