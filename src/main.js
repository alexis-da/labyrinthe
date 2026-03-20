import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { createProceduralMaze } from "./labyrinthe.js";
import {
  buildWallBoundingBoxes,
  resolvePlayerCollisions,
  setBoxFromPosition,
  updatePlayerBoundingBoxFromCamera,
} from "./player-collisions.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createTrollController } from "./troll-controller.js";

const scene = new THREE.Scene();

const startScreen = document.getElementById("start-screen");
const victoryScreen = document.getElementById("victory-screen");
const gameOverScreen = document.getElementById("gameover-screen");
const startButton = document.getElementById("start-button");
const replayButton = document.getElementById("replay-button");
const replayButtonGameOver = document.getElementById("replay-button-gameover");
const damageOverlay = document.getElementById("damage-overlay");
const hud = document.getElementById("hud");
const healthFill = document.getElementById("health-fill");

let gameStarted = false;
let hasWon = false;
let hasLost = false;
const maxHealth = 100;
const contactDamagePerSecond = 26;
let playerHealth = maxHealth;

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);

const audioListener = new THREE.AudioListener();
camera.add(audioListener);

const bgMusic = new THREE.Audio(audioListener);
const audioLoader = new THREE.AudioLoader();
let isMusicReady = false;
let hasTriedToStartMusic = false;

audioLoader.load(
  "/assets/musique_horreur.mp3",
  (buffer) => {
    bgMusic.setBuffer(buffer);
    bgMusic.setLoop(true);
    bgMusic.setVolume(0.35);
    isMusicReady = true;
  },
  undefined,
  () => {
    console.warn(
      "Musique non trouvée: ajoute un fichier /assets/musique_horreur.mp3",
    );
  },
);

function startMusicIfPossible() {
  if (hasTriedToStartMusic || !isMusicReady) return;

  hasTriedToStartMusic = true;
  bgMusic.play();
}

startButton?.addEventListener("click", () => {
  if (gameStarted) return;

  gameStarted = true;
  startScreen?.classList.add("hidden");
  hud?.classList.remove("hidden");
  controls.lock();
  startMusicIfPossible();
});

const mazeSettings = {
  size: 31,
  blockSize: 3,
  wallHeight: 5,
  playerEyeHeight: 1.8,
};

const {
  maze,
  end,
  group: mazeGroup,
  spawnPoint,
} = await createProceduralMaze(mazeSettings);
scene.add(mazeGroup);
camera.position.copy(spawnPoint);
const wallBoxes = buildWallBoundingBoxes(mazeGroup);
const mazeOffset = (maze.length - 1) / 2;
const endWorldPosition = new THREE.Vector3(
  (end.x - mazeOffset) * mazeSettings.blockSize,
  camera.position.y,
  (end.z - mazeOffset) * mazeSettings.blockSize,
);
const endReachDistanceSq = (mazeSettings.blockSize * 0.55) ** 2;
console.log(`Murs pour collisions: ${wallBoxes.length}`);
console.log("Labyrinthe procédural chargé");

const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

const flashLight = new THREE.SpotLight(
  0xffffff,
  12,
  40,
  Math.PI / 8,
  0.35,
  1.8,
);
flashLight.castShadow = false;
scene.add(flashLight);

const flashTarget = new THREE.Object3D();
scene.add(flashTarget);
flashLight.target = flashTarget;

const textureLoaderSky = new THREE.TextureLoader();
const textureSky = await textureLoaderSky.loadAsync("/assets/ciel.jpg");
textureSky.mapping = THREE.EquirectangularReflectionMapping;
textureSky.colorSpace = THREE.SRGBColorSpace;
scene.background = textureSky;

const lightLoader = new GLTFLoader();
const light = await lightLoader.loadAsync("/assets/flashlight/scene.gltf");
light.scene.position.copy(camera.position);
light.scene.scale.set(1.5, 1.5, 1.5);
scene.add(light.scene);

let isFlashlightOn = true;
document.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;

  if (!gameStarted || hasWon || hasLost) {
    return;
  }

  startMusicIfPossible();

  if (!controls.isLocked) {
    controls.lock();
    return;
  }

  isFlashlightOn = !isFlashlightOn;
  flashLight.visible = isFlashlightOn;
  light.scene.visible = isFlashlightOn;
});

const trollLoader = new GLTFLoader();
const troll = await trollLoader.loadAsync("/assets/troll/scene.gltf");
scene.add(troll.scene);
troll.scene.scale.set(1.8, 1.8, 1.8);
troll.scene.position.copy(
  camera.position
    .clone()
    .sub(new THREE.Vector3(0, mazeSettings.playerEyeHeight, 0)),
);

const trollController = createTrollController({
  trollRoot: troll.scene,
  animations: troll.animations,
  wallBoxes,
  mazeGrid: maze,
  cellSpacing: mazeSettings.blockSize,
  eyeHeight: mazeSettings.playerEyeHeight,
  speed: 1.8 * mazeSettings.blockSize,
  colliderSize: new THREE.Vector3(1.1, 2.2, 1.1),
});

const trollColliderSize = new THREE.Vector3(1.1, 2.2, 1.1);
const trollHitBox = new THREE.Box3();
const trollToPlayerVector = new THREE.Vector3();
const trollMeleeRange = Math.max(1.2, mazeSettings.blockSize * 0.55);
const trollMeleeRangeSq = trollMeleeRange * trollMeleeRange;
let damageVignetteAlpha = 0;

const humanLoader = new GLTFLoader();
const human = await humanLoader.loadAsync("/assets/walking_man/scene.gltf");
scene.add(human.scene);
human.scene.scale.set(0.01, 0.01, 0.01);

human.scene.visible = false;

const boudingBoxPlayer = new THREE.Box3();
const playerColliderSize = new THREE.Vector3(0.8, 1.8, 0.8);

camera.position.copy(spawnPoint);

const moveState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

const moveSpeed = 2.5 * mazeSettings.blockSize;
const clock = new THREE.Clock();
const lookDirection = new THREE.Vector3();
const moveForwardVector = new THREE.Vector3();
const moveRightVector = new THREE.Vector3();
const moveDirection = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);

function resetMovementState() {
  moveState.forward = false;
  moveState.backward = false;
  moveState.left = false;
  moveState.right = false;
}

function resetGameState() {
  hasWon = false;
  hasLost = false;
  gameStarted = true;
  playerHealth = maxHealth;
  resetMovementState();
  damageVignetteAlpha = 0;
  if (damageOverlay) {
    damageOverlay.style.opacity = "0";
  }
  if (healthFill) {
    healthFill.style.width = "100%";
  }

  camera.position.copy(spawnPoint);
  troll.scene.position.copy(
    spawnPoint
      .clone()
      .sub(new THREE.Vector3(0, mazeSettings.playerEyeHeight, 0)),
  );

  victoryScreen?.classList.add("hidden");
  gameOverScreen?.classList.add("hidden");
  hud?.classList.remove("hidden");
  controls.lock();
  startMusicIfPossible();
}

replayButton?.addEventListener("click", () => {
  resetGameState();
});

replayButtonGameOver?.addEventListener("click", () => {
  resetGameState();
});

document.addEventListener("keydown", (e) => {
  switch (e.code) {
    case "KeyW":
      moveState.forward = true;
      break;
    case "KeyS":
      moveState.backward = true;
      break;
    case "KeyA":
      moveState.left = true;
      break;
    case "KeyD":
      moveState.right = true;
      break;
    case "Space":
      if (controls.isLocked) {
        camera.position.y += 0.5;
      }
      break;
  }
});

document.addEventListener("keyup", (e) => {
  switch (e.code) {
    case "KeyW":
      moveState.forward = false;
      break;
    case "KeyS":
      moveState.backward = false;
      break;
    case "KeyA":
      moveState.left = false;
      break;
    case "KeyD":
      moveState.right = false;
      break;
  }
});

function syncHumanWithCamera() {
  human.scene.position.set(
    camera.position.x,
    camera.position.y - mazeSettings.playerEyeHeight,
    camera.position.z,
  );
  human.scene.rotation.y = camera.rotation.y;
}

function updatePlayerBoundingBox() {
  updatePlayerBoundingBoxFromCamera({
    targetBox: boudingBoxPlayer,
    camera,
    eyeHeight: mazeSettings.playerEyeHeight,
    colliderSize: playerColliderSize,
  });
}

function animate() {
  const delta = Math.min(clock.getDelta(), 1 / 30);

  if (gameStarted && !hasWon && !hasLost) {
    trollController.update(delta, camera.position);
  }

  if (gameStarted && !hasWon && !hasLost && controls.isLocked) {
    const inputForward =
      (moveState.forward ? 1 : 0) - (moveState.backward ? 1 : 0);
    const inputRight = (moveState.right ? 1 : 0) - (moveState.left ? 1 : 0);

    if (inputForward !== 0 || inputRight !== 0) {
      camera.getWorldDirection(moveForwardVector);
      moveForwardVector.y = 0;
      moveForwardVector.normalize();

      moveRightVector.crossVectors(moveForwardVector, worldUp).normalize();

      moveDirection
        .set(0, 0, 0)
        .addScaledVector(moveForwardVector, inputForward)
        .addScaledVector(moveRightVector, inputRight);

      if (moveDirection.lengthSq() > 0) {
        moveDirection.normalize();
        const totalDistance = moveSpeed * delta;
        const maxSubStep = Math.max(0.15, mazeSettings.blockSize * 0.12);
        const steps = Math.max(1, Math.ceil(totalDistance / maxSubStep));
        const stepDistance = totalDistance / steps;

        for (let i = 0; i < steps; i += 1) {
          const previousPosition = camera.position.clone();
          camera.position.addScaledVector(moveDirection, stepDistance);

          resolvePlayerCollisions({
            camera,
            previousPosition,
            eyeHeight: mazeSettings.playerEyeHeight,
            colliderSize: playerColliderSize,
            wallBoxes,
          });
        }
      }
    }

    const dx = camera.position.x - endWorldPosition.x;
    const dz = camera.position.z - endWorldPosition.z;
    if (dx * dx + dz * dz <= endReachDistanceSq) {
      hasWon = true;
      controls.unlock();
      victoryScreen?.classList.remove("hidden");
      hud?.classList.add("hidden");
    }
  }

  syncHumanWithCamera();
  updatePlayerBoundingBox();

  if (gameStarted && !hasWon && !hasLost) {
    setBoxFromPosition({
      targetBox: trollHitBox,
      position: troll.scene.position,
      colliderSize: trollColliderSize,
      centerYOffset: trollColliderSize.y * 0.5,
    });

    trollToPlayerVector.copy(camera.position).sub(troll.scene.position);
    trollToPlayerVector.y = 0;

    const isTrollTouchingPlayer =
      boudingBoxPlayer.intersectsBox(trollHitBox) ||
      trollToPlayerVector.lengthSq() <= trollMeleeRangeSq;

    if (isTrollTouchingPlayer) {
      playerHealth = Math.max(0, playerHealth - contactDamagePerSecond * delta);
      damageVignetteAlpha = Math.min(0.8, damageVignetteAlpha + delta * 2.8);

      if (playerHealth <= 0) {
        hasLost = true;
        controls.unlock();
        gameOverScreen?.classList.remove("hidden");
        hud?.classList.add("hidden");
      }
    } else {
      damageVignetteAlpha = Math.max(0, damageVignetteAlpha - delta * 1.6);
    }
  } else {
    damageVignetteAlpha = Math.max(0, damageVignetteAlpha - delta * 2.2);
  }

  if (healthFill) {
    healthFill.style.width = `${(playerHealth / maxHealth) * 100}%`;
  }

  if (damageOverlay) {
    damageOverlay.style.opacity = damageVignetteAlpha.toFixed(3);
  }

  camera.getWorldDirection(lookDirection);
  flashLight.position.copy(camera.position);
  flashTarget.position.copy(camera.position).addScaledVector(lookDirection, 10);

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
