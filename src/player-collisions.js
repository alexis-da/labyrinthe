import * as THREE from "three";

const tmpPlayerBox = new THREE.Box3();
const tmpCandidateCenter = new THREE.Vector3();
const tmpProbeX = new THREE.Vector3();
const tmpProbeZ = new THREE.Vector3();
const tmpProbeFallback = new THREE.Vector3();

// Instancie la hitbox du joueur à partir de sa position et de ses dimensions
function setPlayerBox(box, cameraPosition, eyeHeight, colliderSize) {
  tmpCandidateCenter.set(
    cameraPosition.x,
    cameraPosition.y - eyeHeight / 2,
    cameraPosition.z,
  );
  box.setFromCenterAndSize(tmpCandidateCenter, colliderSize);
}

export function setBoxFromPosition({
  targetBox,
  position,
  colliderSize,
  centerYOffset = 0,
}) {
  tmpCandidateCenter.set(position.x, position.y + centerYOffset, position.z);
  targetBox.setFromCenterAndSize(tmpCandidateCenter, colliderSize);
}

// vérifie si une hitbox entre en collision avec une des hitboxs des murs
export function intersectsAny(box, colliders) {
  for (const wallBox of colliders) {
    if (box.intersectsBox(wallBox)) {
      return true;
    }
  }

  return false;
}

// Créer hitbox des murs du labyrinthe
export function buildWallBoundingBoxes(root) {
  const boxes = [];

  root.traverse((child) => {
    if (!child.isMesh || !child.userData.isWall) return;
    boxes.push(new THREE.Box3().setFromObject(child));
  });

  return boxes;
}

// Gère les collisions du joueur avec les murs du labyrinthe
export function resolvePlayerCollisions({
  camera,
  previousPosition,
  eyeHeight,
  colliderSize,
  wallBoxes,
}) {
  resolveHorizontalPositionCollision({
    position: camera.position,
    previousPosition,
    colliderSize,
    wallBoxes,
    centerYOffset: -eyeHeight / 2,
    targetBox: tmpPlayerBox,
  });
}

export function resolveHorizontalPositionCollision({
  position,
  previousPosition,
  colliderSize,
  wallBoxes,
  centerYOffset = 0,
  targetBox = tmpPlayerBox,
}) {
  if (!wallBoxes.length) return "none";

  setBoxFromPosition({
    targetBox,
    position,
    colliderSize,
    centerYOffset,
  });
  if (!intersectsAny(targetBox, wallBoxes)) {
    return "none";
  }

  tmpProbeX.set(position.x, position.y, previousPosition.z);
  setBoxFromPosition({
    targetBox,
    position: tmpProbeX,
    colliderSize,
    centerYOffset,
  });
  const xFree = !intersectsAny(targetBox, wallBoxes);

  tmpProbeZ.set(previousPosition.x, position.y, position.z);
  setBoxFromPosition({
    targetBox,
    position: tmpProbeZ,
    colliderSize,
    centerYOffset,
  });
  const zFree = !intersectsAny(targetBox, wallBoxes);

  if (xFree) {
    position.x = tmpProbeX.x;
    position.z = tmpProbeX.z;
    return "x";
  }

  if (zFree) {
    position.x = tmpProbeZ.x;
    position.z = tmpProbeZ.z;
    return "z";
  }

  // Sur les coins, tente un déplacement réduit avant de rollback total.
  const moveX = position.x - previousPosition.x;
  const moveZ = position.z - previousPosition.z;
  let scale = 0.5;

  while (scale >= 0.125) {
    tmpProbeFallback.set(
      previousPosition.x + moveX * scale,
      position.y,
      previousPosition.z + moveZ * scale,
    );

    setBoxFromPosition({
      targetBox,
      position: tmpProbeFallback,
      colliderSize,
      centerYOffset,
    });

    if (!intersectsAny(targetBox, wallBoxes)) {
      position.x = tmpProbeFallback.x;
      position.z = tmpProbeFallback.z;
      return "partial";
    }

    scale *= 0.5;
  }

  position.x = previousPosition.x;
  position.z = previousPosition.z;
  return "rollback";
}

export function updatePlayerBoundingBoxFromCamera({
  targetBox,
  camera,
  eyeHeight,
  colliderSize,
}) {
  setPlayerBox(targetBox, camera.position, eyeHeight, colliderSize);
}
