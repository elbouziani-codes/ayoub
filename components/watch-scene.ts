import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export type WatchFinish = "midnight" | "azure" | "champagne";
export type WatchView = "front" | "profile" | "back";
export type WatchScene = {
  setFinish: (finish: WatchFinish) => void;
  setActive: (active: boolean) => void;
  setMotion: (motion: boolean) => void;
  setAutoRotate: (rotate: boolean) => void;
  setView: (view: WatchView) => void;
  rotate: (direction: number) => void;
  zoom: (direction: number) => void;
  reset: () => void;
  dispose: () => void;
};

const FINISHES = {
  midnight: {
    dial: "#111725",
    light: "#3d4c66",
    metal: "#b9c6da",
    accent: "#80b1ff",
  },
  azure: {
    dial: "#092f4c",
    light: "#397aa3",
    metal: "#d7dfeb",
    accent: "#a8d9f8",
  },
  champagne: {
    dial: "#8d7240",
    light: "#e4d09c",
    metal: "#bda477",
    accent: "#fff0c2",
  },
};

/** Procedural design study. This is deliberately not represented as a product SKU. */
export function createWatchScene(
  host: HTMLElement,
  onFailure: () => void,
): WatchScene {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 60);
  camera.position.set(0, 0, 11.2);
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  let environmentTarget: THREE.WebGLRenderTarget;
  try {
    environmentTarget = pmrem.fromScene(environment, 0.04);
    scene.environment = environmentTarget.texture;
  } catch (error) {
    environment.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    throw error;
  }
  environment.dispose();
  pmrem.dispose();
  scene.environmentIntensity = 0.85;

  const key = new THREE.DirectionalLight(0xf0f5ff, 2.2);
  key.position.set(-4, 6, 5);
  const rim = new THREE.DirectionalLight(0x5e91ff, 1.7);
  rim.position.set(5, 0, -2);
  const softbox = new THREE.DirectionalLight(0xffffff, 1.4);
  softbox.position.set(4, -4, 6);
  scene.add(key, rim, softbox, new THREE.AmbientLight(0xd9e5ff, 0.2));

  const watch = new THREE.Group();
  scene.add(watch);
  const metal = new THREE.MeshStandardMaterial({
    color: FINISHES.midnight.metal,
    metalness: 1,
    roughness: 0.22,
    envMapIntensity: 1.15,
  });
  const polished = new THREE.MeshStandardMaterial({
    color: "#e4eaf4",
    metalness: 1,
    roughness: 0.12,
    envMapIntensity: 1.35,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: "#3b4558",
    metalness: 0.95,
    roughness: 0.28,
  });
  const luminous = new THREE.MeshStandardMaterial({
    color: "#edf3e8",
    metalness: 0.35,
    roughness: 0.3,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: FINISHES.midnight.accent,
    metalness: 0.65,
    roughness: 0.22,
  });
  const black = new THREE.MeshStandardMaterial({
    color: "#0a101a",
    roughness: 0.4,
    metalness: 0.4,
  });
  const geometries = new Set<THREE.BufferGeometry>();
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>([
    metal,
    polished,
    darkMetal,
    luminous,
    accent,
    black,
  ]);

  function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    parent: THREE.Object3D = watch,
  ) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, material);
    parent.add(object);
    return object;
  }
  function cylinder(
    radius: number,
    depth: number,
    material: THREE.Material,
    z: number,
    parent: THREE.Object3D = watch,
  ) {
    const object = mesh(
      new THREE.CylinderGeometry(radius, radius, depth, 96),
      material,
      parent,
    );
    object.rotation.x = Math.PI / 2;
    object.position.z = z;
    return object;
  }
  function ring(
    radius: number,
    tube: number,
    z: number,
    material: THREE.Material,
    parent: THREE.Object3D = watch,
  ) {
    const object = mesh(
      new THREE.TorusGeometry(radius, tube, 8, 96),
      material,
      parent,
    );
    object.position.z = z;
    return object;
  }
  function instanced(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    matrices: THREE.Matrix4[],
    parent: THREE.Object3D = watch,
  ) {
    geometries.add(geometry);
    const object = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((matrix, i) => object.setMatrixAt(i, matrix));
    object.instanceMatrix.needsUpdate = true;
    parent.add(object);
    return object;
  }
  const transform = new THREE.Object3D();
  function matrix(x: number, y: number, z: number, rx = 0, rz = 0) {
    transform.position.set(x, y, z);
    transform.rotation.set(rx, 0, rz);
    transform.scale.set(1, 1, 1);
    transform.updateMatrix();
    return transform.matrix.clone();
  }

  // Sculpted case, mirror bevels, brushed shoulders, and sapphire-like crystal.
  cylinder(1.105, 0.3, metal, -0.005);
  cylinder(1.065, 0.065, darkMetal, -0.19);
  ring(1.083, 0.055, 0.105, polished);
  ring(1.024, 0.055, 0.174, metal);
  ring(0.969, 0.016, 0.21, polished);
  const bezel = mesh(new THREE.RingGeometry(0.979, 1.067, 96), metal);
  bezel.position.z = 0.184;
  const minuteMatrices: THREE.Matrix4[] = [];
  const bezelMatrices: THREE.Matrix4[] = [];
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * Math.PI * 2;
    if (i % 5 !== 0)
      minuteMatrices.push(
        matrix(
          Math.sin(angle) * 0.881,
          Math.cos(angle) * 0.881,
          0.228,
          0,
          -angle,
        ),
      );
    bezelMatrices.push(
      matrix(
        Math.sin(angle) * 1.035,
        Math.cos(angle) * 1.035,
        0.195,
        0,
        -angle,
      ),
    );
  }
  instanced(
    new THREE.BoxGeometry(0.009, 0.033, 0.006),
    polished,
    minuteMatrices,
  );
  instanced(
    new THREE.BoxGeometry(0.008, 0.035, 0.005),
    darkMetal,
    bezelMatrices,
  );

  // A high-resolution canvas dial provides legible typography and sunburst brushing.
  const dialCanvas = document.createElement("canvas");
  dialCanvas.width = dialCanvas.height = 1024;
  const dialContext = dialCanvas.getContext("2d");
  if (!dialContext) throw new Error("Dial canvas is unavailable");
  const dialTexture = new THREE.CanvasTexture(dialCanvas);
  dialTexture.colorSpace = THREE.SRGBColorSpace;
  dialTexture.anisotropy = Math.min(
    renderer.capabilities.getMaxAnisotropy(),
    4,
  );
  textures.add(dialTexture);
  const dialMaterial = new THREE.MeshStandardMaterial({
    map: dialTexture,
    color: "#ffffff",
    roughness: 0.38,
    metalness: 0.58,
  });
  materials.add(dialMaterial);
  const dial = mesh(new THREE.CircleGeometry(0.965, 96), dialMaterial);
  dial.position.z = 0.205;
  function paintDial(finish: WatchFinish) {
    const context = dialContext!;
    const palette = FINISHES[finish];
    context.clearRect(0, 0, 1024, 1024);
    const gradient = context.createRadialGradient(410, 380, 10, 512, 512, 700);
    gradient.addColorStop(0, palette.light);
    gradient.addColorStop(0.5, palette.dial);
    gradient.addColorStop(1, "#050a12");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1024, 1024);
    context.lineWidth = 1;
    for (let i = 0; i < 800; i++) {
      const angle = (i / 800) * Math.PI * 2;
      context.strokeStyle =
        i % 3 === 0 ? "rgba(255,255,255,.055)" : "rgba(0,0,0,.06)";
      context.beginPath();
      context.moveTo(512, 512);
      context.lineTo(512 + Math.cos(angle) * 720, 512 + Math.sin(angle) * 720);
      context.stroke();
    }
    context.textAlign = "center";
    context.fillStyle = finish === "champagne" ? "#f9f1d8" : "#e8edf7";
    context.font = "500 48px Arial, sans-serif";
    context.fillText("A Y O U B", 512, 307);
    context.font = "400 15px Arial, sans-serif";
    context.fillStyle = "#b7c6d9";
    context.fillText("A T E L I E R   /   N o .  0 0 1", 512, 343);
    context.font = "400 12px Arial, sans-serif";
    context.fillText("D E S I G N   S T U D Y", 512, 825);
    dialTexture.needsUpdate = true;
  }
  paintDial("midnight");

  const markers: THREE.Matrix4[] = [];
  const markerLume: THREE.Matrix4[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    if (i === 3) continue;
    markers.push(
      matrix(
        Math.sin(angle) * 0.795,
        Math.cos(angle) * 0.795,
        0.237,
        0,
        -angle,
      ),
    );
    markerLume.push(
      matrix(
        Math.sin(angle) * 0.795,
        Math.cos(angle) * 0.795,
        0.252,
        0,
        -angle,
      ),
    );
  }
  instanced(
    new RoundedBoxGeometry(0.055, 0.17, 0.035, 2, 0.008),
    polished,
    markers,
  );
  instanced(new THREE.BoxGeometry(0.019, 0.12, 0.006), luminous, markerLume);
  // Double twelve o'clock index.
  for (const x of [-0.05, 0.05]) {
    const index = mesh(
      new RoundedBoxGeometry(0.025, 0.15, 0.025, 2, 0.005),
      polished,
    );
    index.position.set(x, 0.795, 0.24);
  }

  const subdialHands: THREE.Group[] = [];
  for (const [x, y, radius] of [
    [-0.405, -0.02, 0.237],
    [0.405, -0.02, 0.237],
    [0, -0.43, 0.218],
  ]) {
    const subdial = new THREE.Group();
    subdial.position.set(x, y, 0.221);
    watch.add(subdial);
    const inset = mesh(new THREE.CircleGeometry(radius, 48), black, subdial);
    inset.position.z = 0.001;
    ring(radius, 0.01, 0.008, polished, subdial);
    for (let line = 1; line <= 5; line++)
      ring(radius - line * 0.027, 0.0016, 0.004, darkMetal, subdial);
    const ticks: THREE.Matrix4[] = [];
    for (let tick = 0; tick < 12; tick++) {
      const theta = (tick / 12) * Math.PI * 2;
      ticks.push(
        matrix(
          Math.sin(theta) * (radius - 0.035),
          Math.cos(theta) * (radius - 0.035),
          0.012,
          0,
          -theta,
        ),
      );
    }
    instanced(new THREE.BoxGeometry(0.006, 0.025, 0.005), polished, ticks, subdial);
    const smallHand = new THREE.Group();
    const hand = mesh(
      new THREE.BoxGeometry(0.012, radius * 0.8, 0.008),
      accent,
      smallHand,
    );
    hand.position.set(0, radius * 0.26, 0.025);
    subdial.add(smallHand);
    subdialHands.push(smallHand);
    cylinder(0.022, 0.014, polished, 0.025, subdial);
  }
  const datePlate = mesh(
    new RoundedBoxGeometry(0.185, 0.139, 0.015, 2, 0.012),
    polished,
  );
  datePlate.position.set(0.77, 0.005, 0.239);
  const dateCanvas = document.createElement("canvas");
  dateCanvas.width = 128;
  dateCanvas.height = 96;
  const dateContext = dateCanvas.getContext("2d");
  if (dateContext) {
    dateContext.fillStyle = "#e8edf4";
    dateContext.fillRect(0, 0, 128, 96);
    dateContext.fillStyle = "#111827";
    dateContext.font = "bold 62px Arial, sans-serif";
    dateContext.textAlign = "center";
    dateContext.fillText(String(new Date().getDate()).padStart(2, "0"), 64, 72);
  }
  const dateTexture = new THREE.CanvasTexture(dateCanvas);
  dateTexture.colorSpace = THREE.SRGBColorSpace;
  textures.add(dateTexture);
  const dateMaterial = new THREE.MeshBasicMaterial({ map: dateTexture });
  materials.add(dateMaterial);
  const dateFace = mesh(new THREE.PlaneGeometry(0.149, 0.107), dateMaterial);
  dateFace.position.set(0.77, 0.005, 0.25);

  function hand(
    length: number,
    width: number,
    material: THREE.Material,
    z: number,
  ) {
    const group = new THREE.Group();
    group.position.z = z;
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, -0.13);
    shape.lineTo(-width / 2, length * 0.72);
    shape.lineTo(0, length);
    shape.lineTo(width / 2, length * 0.72);
    shape.lineTo(width / 2, -0.13);
    shape.closePath();
    mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.012,
        bevelEnabled: true,
        bevelThickness: 0.004,
        bevelSize: 0.003,
        bevelSegments: 1,
        steps: 1,
      }),
      material,
      group,
    );
    watch.add(group);
    return group;
  }
  const hourHand = hand(0.49, 0.064, polished, 0.275);
  const minuteHand = hand(0.718, 0.043, polished, 0.303);
  const secondHand = hand(0.78, 0.013, accent, 0.327);
  const hourLume = mesh(
    new THREE.BoxGeometry(0.021, 0.31, 0.005),
    luminous,
    hourHand,
  );
  hourLume.position.set(0, 0.245, 0.017);
  const minuteLume = mesh(
    new THREE.BoxGeometry(0.014, 0.47, 0.005),
    luminous,
    minuteHand,
  );
  minuteLume.position.set(0, 0.34, 0.017);
  ring(0.037, 0.01, 0.343, polished);
  cylinder(0.027, 0.017, accent, 0.348);

  const crystalMaterial = new THREE.MeshPhysicalMaterial({
    color: "#c9dfff",
    transparent: true,
    opacity: 0.055,
    roughness: 0.055,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.045,
    depthWrite: false,
  });
  materials.add(crystalMaterial);
  const crystal = mesh(new THREE.CircleGeometry(0.966, 96), crystalMaterial);
  crystal.position.z = 0.382;

  // Crown and pushers extend along the case's right edge.
  function sideCylinder(radius: number, depth: number, x: number, y: number) {
    const object = mesh(
      new THREE.CylinderGeometry(radius, radius, depth, 32),
      polished,
    );
    object.rotation.z = Math.PI / 2;
    object.position.set(x, y, 0.005);
    return object;
  }
  sideCylinder(0.125, 0.215, 1.15, 0);
  sideCylinder(0.143, 0.06, 1.265, 0);
  const crownGrooves: THREE.Matrix4[] = [];
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    crownGrooves.push(
      matrix(1.2, Math.sin(angle) * 0.125, Math.cos(angle) * 0.125, -angle),
    );
  }
  instanced(new THREE.BoxGeometry(0.14, 0.014, 0.014), darkMetal, crownGrooves);
  for (const y of [-0.49, 0.49]) {
    sideCylinder(0.074, 0.22, 1.044, y);
    sideCylinder(0.092, 0.055, 1.17, y);
  }
  for (const y of [-1, 1])
    for (const x of [-0.5, 0.5]) {
      const lug = mesh(
        new RoundedBoxGeometry(0.215, 0.53, 0.285, 3, 0.06),
        metal,
      );
      lug.position.set(x, y * 1.015, -0.015);
      lug.rotation.z = -Math.sign(x * y) * 0.13;
    }

  // Each bracelet row follows a real elliptical loop around the wrist.
  const outerLinks: THREE.Matrix4[] = [];
  const centerLinks: THREE.Matrix4[] = [];
  const braceletPins: THREE.Matrix4[] = [];
  const linkCount = 38;
  for (let i = 0; i < linkCount; i++) {
    const theta = 0.59 + (i / (linkCount - 1)) * (Math.PI * 2 - 1.18);
    const y = Math.sin(theta) * 1.91;
    const z = -0.91 + Math.cos(theta) * 1.075;
    const tilt = Math.atan2(-1.075 * Math.sin(theta), 1.91 * Math.cos(theta));
    outerLinks.push(matrix(-0.389, y, z, tilt), matrix(0.389, y, z, tilt));
    centerLinks.push(matrix(0, y, z + Math.cos(tilt) * 0.025, tilt));
    braceletPins.push(matrix(-0.553, y, z, tilt), matrix(0.553, y, z, tilt));
  }
  instanced(
    new RoundedBoxGeometry(0.306, 0.211, 0.117, 3, 0.036),
    metal,
    outerLinks,
  );
  instanced(
    new RoundedBoxGeometry(0.457, 0.195, 0.14, 3, 0.044),
    polished,
    centerLinks,
  );
  instanced(new THREE.SphereGeometry(0.018, 6, 4), darkMetal, braceletPins);

  // The exhibition caseback includes an engraved medallion and visible screws.
  cylinder(0.88, 0.045, polished, -0.211);
  const back = mesh(new THREE.RingGeometry(0.59, 0.83, 80), darkMetal);
  back.position.z = -0.239;
  back.rotation.y = Math.PI;
  ring(0.595, 0.012, -0.245, metal);
  cylinder(0.56, 0.018, metal, -0.246);
  const emblem = mesh(new THREE.TorusGeometry(0.32, 0.014, 6, 3), polished);
  emblem.position.z = -0.265;
  emblem.rotation.z = Math.PI / 2;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const screw = cylinder(0.035, 0.015, polished, -0.251);
    screw.position.x = Math.sin(angle) * 0.742;
    screw.position.y = Math.cos(angle) * 0.742;
    const slot = mesh(new THREE.BoxGeometry(0.041, 0.007, 0.006), darkMetal);
    slot.position.set(screw.position.x, screw.position.y, -0.263);
    slot.rotation.z = angle;
  }

  let disposed = false;
  let active = true;
  let motion = true;
  let autoRotate = true;
  let frame = 0;
  let frameTimer: ReturnType<typeof setTimeout> | null = null;
  let previousFrame = 0;
  let lastTime = 0;
  let targetX = -0.16;
  let targetY = -0.3;
  let targetZ = -0.38;
  let zoomLevel = 11.2;
  let targetZoom = 11.2;
  let currentFinish: WatchFinish = "midnight";
  let renderWidth = 0;
  let renderHeight = 0;
  let renderRatio = 0;
  let pointer: {
    id: number;
    x: number;
    y: number;
    rotationX: number;
    rotationY: number;
    dragging: boolean;
    touch: boolean;
  } | null = null;
  watch.rotation.set(targetX, targetY, targetZ);

  // Only the watch and hands change transforms; keep decorative geometry static.
  const animatedObjects = new Set<THREE.Object3D>([
    watch, hourHand, minuteHand, secondHand, ...subdialHands,
  ]);
  watch.traverse((object) => {
    if (animatedObjects.has(object)) return;
    object.updateMatrix();
    object.matrixAutoUpdate = false;
  });

  function updateTime() {
    const date = new Date();
    const seconds = date.getSeconds() + date.getMilliseconds() / 1000;
    const minutes = date.getMinutes() + seconds / 60;
    hourHand.rotation.z =
      -(((date.getHours() % 12) + minutes / 60) / 12) * Math.PI * 2;
    minuteHand.rotation.z = -(minutes / 60) * Math.PI * 2;
    secondHand.rotation.z = -(seconds / 60) * Math.PI * 2;
    subdialHands[0].rotation.z = -(date.getHours() / 24) * Math.PI * 2;
    subdialHands[1].rotation.z = -((minutes % 30) / 30) * Math.PI * 2;
    subdialHands[2].rotation.z = -(seconds / 60) * Math.PI * 2;
  }
  function requestRender() {
    if (disposed || !active || frame || frameTimer !== null) return;
    // Schedule the next displayed frame at 30 fps instead of waking at 60–144 Hz
    // only to discard most callbacks before drawing.
    // Leave a short window for the browser's next vsync, avoiding a missed frame
    // when a 33 ms timer fires just after a 60 Hz display refresh.
    const delay = Math.max(0, 1000 / 30 - 8 - (performance.now() - previousFrame));
    if (delay > 0) {
      frameTimer = setTimeout(() => {
        frameTimer = null;
        if (!disposed && active) frame = requestAnimationFrame(render);
      }, delay);
    } else frame = requestAnimationFrame(render);
  }
  function cancelRender() {
    if (frame) cancelAnimationFrame(frame);
    if (frameTimer !== null) clearTimeout(frameTimer);
    frame = 0;
    frameTimer = null;
  }
  function render(time: number) {
    frame = 0;
    if (disposed || !active) return;
    if (motion && time - previousFrame < 32) {
      requestRender();
      return;
    }
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.06) : 1 / 30;
    lastTime = time;
    if (motion && autoRotate && !pointer?.dragging) targetY += delta * 0.065;
    if (motion) {
      const easing = 1 - Math.pow(0.86, delta * 60);
      watch.rotation.x += (targetX - watch.rotation.x) * easing;
      watch.rotation.y += (targetY - watch.rotation.y) * easing;
      watch.rotation.z += (targetZ - watch.rotation.z) * easing;
      zoomLevel += (targetZoom - zoomLevel) * easing;
    } else {
      watch.rotation.set(targetX, targetY, targetZ);
      zoomLevel = targetZoom;
    }
    camera.position.z = zoomLevel;
    if (motion) updateTime();
    try {
      renderer.render(scene, camera);
    } catch {
      active = false;
      onFailure();
      return;
    }
    previousFrame = time;
    if (motion) requestRender();
  }
  function resize() {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const mobile = width < 600 && window.matchMedia("(pointer: coarse)").matches;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
    if (width === renderWidth && height === renderHeight && pixelRatio === renderRatio)
      return;
    renderWidth = width;
    renderHeight = height;
    renderRatio = pixelRatio;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Maintain the whole bracelet at narrow viewport ratios.
    camera.fov = width < 500 ? 34 : 31;
    camera.updateProjectionMatrix();
    requestRender();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  function pointerDown(event: PointerEvent) {
    if (event.button !== 0 || disposed) return;
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      rotationX: targetX,
      rotationY: targetY,
      dragging: event.pointerType !== "touch",
      touch: event.pointerType === "touch",
    };
    if (!pointer.touch) renderer.domElement.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (
      !pointer.dragging &&
      Math.abs(dx) > 7 &&
      Math.abs(dx) > Math.abs(dy) * 1.15
    ) {
      pointer.dragging = true;
      renderer.domElement.setPointerCapture(event.pointerId);
    }
    if (!pointer.dragging) return;
    targetY = pointer.rotationY + dx * 0.009;
    targetX = THREE.MathUtils.clamp(pointer.rotationX + dy * 0.004, -0.9, 0.9);
    watch.rotation.x = targetX;
    watch.rotation.y = targetY;
    requestRender();
  }
  function pointerUp(event: PointerEvent) {
    if (pointer?.id !== event.pointerId) return;
    if (renderer.domElement.hasPointerCapture(event.pointerId))
      renderer.domElement.releasePointerCapture(event.pointerId);
    pointer = null;
  }
  function contextLost(event: Event) {
    event.preventDefault();
    active = false;
    cancelRender();
    onFailure();
  }
  renderer.domElement.addEventListener("pointerdown", pointerDown);
  renderer.domElement.addEventListener("pointermove", pointerMove);
  renderer.domElement.addEventListener("pointerup", pointerUp);
  renderer.domElement.addEventListener("pointercancel", pointerUp);
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  updateTime();
  resize();
  requestRender();

  return {
    setFinish(finish) {
      if (finish === currentFinish) return;
      currentFinish = finish;
      paintDial(finish);
      metal.color.set(FINISHES[finish].metal);
      polished.color.set(finish === "champagne" ? "#e5d3a7" : "#e4eaf4");
      accent.color.set(FINISHES[finish].accent);
      requestRender();
    },
    setActive(value) {
      if (active === value) return;
      active = value;
      lastTime = 0;
      if (!active) cancelRender();
      if (active) requestRender();
    },
    setMotion(value) {
      if (motion === value) return;
      motion = value;
      lastTime = 0;
      if (!value) cancelRender();
      requestRender();
    },
    setAutoRotate(value) {
      autoRotate = value;
      requestRender();
    },
    setView(view) {
      targetX = view === "profile" ? -0.12 : -0.03;
      targetY =
        view === "front" ? 0 : view === "profile" ? -Math.PI / 2.5 : Math.PI;
      targetZ = view === "profile" ? -0.28 : -0.13;
      requestRender();
    },
    rotate(direction) {
      targetY += (direction * Math.PI) / 6;
      requestRender();
    },
    zoom(direction) {
      targetZoom = THREE.MathUtils.clamp(targetZoom - direction * 0.8, 8, 14);
      requestRender();
    },
    reset() {
      targetX = -0.16;
      targetY = -0.3;
      targetZ = -0.38;
      targetZoom = 11.2;
      requestRender();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelRender();
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerUp);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      scene.environment = null;
      environmentTarget.dispose();
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
