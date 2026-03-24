import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createProceduralMaze } from "./labyrinthe.js";
import { buildWallBoundingBoxes } from "./player-collisions.js";
import { createTrollController } from "./troll-controller.js";
import { createBackgroundMusicManager } from "./audio-manager.js";
import { createUIManager } from "./ui-manager.js";
import { createPlayerController } from "./player-controller.js";
import { createCombatSystem } from "./combat-system.js";
import { createWinSystem } from "./win-system.js";

const scene = new THREE.Scene();

let gameStarted = false;
let hasWon = false;
let hasLost = false;

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

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const controls = new PointerLockControls(camera, renderer.domElement);

const musicManager = createBackgroundMusicManager({
  camera,
  path: "/assets/horror_music.mp3",
  volume: 0.62,
  minVolume: 0.04,
  nearDistance: 8,
  farDistance: 34,
  volumeSmoothing: 10,
  proximityExponent: 2.3,
});

function resetGameState() {
  hasWon = false;
  hasLost = false;
  gameStarted = true;
  flashBattery = flashBatteryMax;
  isFlashlightOn = true;
  flashLight.visible = true;

  playerController.reset(spawnPoint);
  troll.scene.position.copy(getRandomTrollSpawnPosition());
  combatSystem.reset();

  ui.startGameUI();
  ui.setDamageOverlay(0);
  ui.setHealthRatio(1);
  controls.lock();
  musicManager.tryStart();
}

const ui = createUIManager({
  onStart: () => {
    if (gameStarted) return;
    gameStarted = true;
    ui.startGameUI();
    controls.lock();
    musicManager.tryStart();
  },
  onReplay: () => {
    resetGameState();
  },
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

const wallBoxes = buildWallBoundingBoxes(mazeGroup);
const winSystem = createWinSystem({
  endCell: end,
  mazeSize: maze.length,
  blockSize: mazeSettings.blockSize,
  playerY: spawnPoint.y,
  reachFactor: 0.55,
});

function cellToWorldPosition(cellX, cellZ, y) {
  const mazeOffset = (maze.length - 1) / 2;
  return new THREE.Vector3(
    (cellX - mazeOffset) * mazeSettings.blockSize,
    y,
    (cellZ - mazeOffset) * mazeSettings.blockSize,
  );
}

function getRandomTrollSpawnPosition() {
  const mazeOffset = (maze.length - 1) / 2;
  const playerCellX = Math.round(
    spawnPoint.x / mazeSettings.blockSize + mazeOffset,
  );
  const playerCellZ = Math.round(
    spawnPoint.z / mazeSettings.blockSize + mazeOffset,
  );

  const minCellDistance = 3;
  const maxCellDistance = Math.max(10, Math.floor(maze.length * 0.32));
  const validCells = [];

  for (let z = 0; z < maze.length; z += 1) {
    for (let x = 0; x < maze[z].length; x += 1) {
      if (maze[z][x] !== 0) continue;

      const dx = x - playerCellX;
      const dz = z - playerCellZ;
      const dist = Math.hypot(dx, dz);

      if (dist >= minCellDistance && dist <= maxCellDistance) {
        validCells.push({ x, z });
      }
    }
  }

  if (validCells.length === 0) {
    return spawnPoint
      .clone()
      .sub(new THREE.Vector3(0, mazeSettings.playerEyeHeight, 0));
  }

  const randomCell = validCells[Math.floor(Math.random() * validCells.length)];
  return cellToWorldPosition(
    randomCell.x,
    randomCell.z,
    spawnPoint.y - mazeSettings.playerEyeHeight,
  );
}

const ambientLight = new THREE.AmbientLight(0xffffff, 0);
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

document.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  if (!gameStarted || hasWon || hasLost) return;

  musicManager.tryStart();

  if (!controls.isLocked) {
    controls.lock();
    return;
  }

  if (isFlashlightOn) {
    isFlashlightOn = false;
  } else if (flashBattery > 0) {
    isFlashlightOn = true;
  }

  flashLight.visible = isFlashlightOn;
});

const trollLoader = new GLTFLoader();
const troll = await trollLoader.loadAsync("/assets/troll/scene.gltf");
scene.add(troll.scene);
troll.scene.scale.set(1.8, 1.8, 1.8);
troll.scene.position.copy(getRandomTrollSpawnPosition());

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

const humanLoader = new GLTFLoader();
const human = await humanLoader.loadAsync("/assets/walking_man/scene.gltf");
scene.add(human.scene);
human.scene.scale.set(0.01, 0.01, 0.01);
human.scene.visible = false;

const playerColliderSize = new THREE.Vector3(0.8, 1.8, 0.8);
const playerController = createPlayerController({
  camera,
  controls,
  playerEyeHeight: mazeSettings.playerEyeHeight,
  moveSpeed: 2.5 * mazeSettings.blockSize,
  playerColliderSize,
  wallBoxes,
  maxSubStep: Math.max(0.15, mazeSettings.blockSize * 0.12),
});
playerController.reset(spawnPoint);

const trollColliderSize = new THREE.Vector3(1.1, 2.2, 1.1);
const combatSystem = createCombatSystem({
  trollRoot: troll.scene,
  trollColliderSize,
  playerController,
  maxHealth: 100,
  damagePerSecond: 26,
  meleeRange: Math.max(1.2, mazeSettings.blockSize * 0.55),
});

const lookDirection = new THREE.Vector3();
const clock = new THREE.Clock();
const flashBatteryMax = 100;
const flashDrainPerSecond = 28;
const flashRechargePerSecond = 20;
let flashBattery = flashBatteryMax;
let isFlashlightOn = true;

function flashlightUpdate(delta, isGameActive) {
  if (isGameActive) {
    if (isFlashlightOn) {
      flashBattery = Math.max(0, flashBattery - flashDrainPerSecond * delta);
      if (flashBattery <= 0) {
        flashBattery = 0;
        isFlashlightOn = false;
      }
    } else {
      flashBattery = Math.min(
        flashBatteryMax,
        flashBattery + flashRechargePerSecond * delta,
      );
    }
  } else {
    flashBattery = flashBatteryMax;
    isFlashlightOn = true;
  }

  flashLight.visible = isFlashlightOn;
}

function syncHumanWithCamera() {
  human.scene.position.set(
    camera.position.x,
    camera.position.y - mazeSettings.playerEyeHeight,
    camera.position.z,
  );
  human.scene.rotation.y = camera.rotation.y;
}

function animate() {
  const delta = Math.min(clock.getDelta(), 1 / 30);
  const isGameActive = gameStarted && !hasWon && !hasLost;

  const dx = camera.position.x - troll.scene.position.x;
  const dz = camera.position.z - troll.scene.position.z;
  const trollDistance = Math.hypot(dx, dz);
  musicManager.updateFromDistance(trollDistance, delta);

  if (isGameActive) {
    trollController.update(delta, camera.position);
  }

  playerController.update(delta, isGameActive);
  flashlightUpdate(delta, isGameActive);

  if (
    isGameActive &&
    controls.isLocked &&
    winSystem.isReached(camera.position)
  ) {
    hasWon = true;
    controls.unlock();
    ui.showVictory();
  }

  syncHumanWithCamera();

  const combatState = combatSystem.update(delta, isGameActive, camera.position);
  ui.setHealthRatio(combatState.health / combatSystem.getMaxHealth());
  ui.setDamageOverlay(combatState.damageVignetteAlpha);

  if (isGameActive && combatState.dead) {
    hasLost = true;
    controls.unlock();
    ui.showGameOver();
  }

  camera.getWorldDirection(lookDirection);
  flashLight.position.copy(camera.position);
  flashTarget.position.copy(camera.position).addScaledVector(lookDirection, 10);

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
