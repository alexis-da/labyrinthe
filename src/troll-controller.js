import * as THREE from "three";
import { resolveHorizontalPositionCollision } from "./player-collisions.js";

const tmpDesired = new THREE.Vector3();
const tmpNext = new THREE.Vector3();
const tmpPlayerGround = new THREE.Vector3();

function keyOf(x, z) {
  return `${x},${z}`;
}

function worldToCell(position, offset, cellSpacing) {
  return {
    x: Math.round(position.x / cellSpacing + offset),
    z: Math.round(position.z / cellSpacing + offset),
  };
}

function cellToWorld(x, z, offset, cellSpacing, y) {
  return new THREE.Vector3(
    (x - offset) * cellSpacing,
    y,
    (z - offset) * cellSpacing,
  );
}

function isWalkable(mazeGrid, x, z) {
  if (
    !mazeGrid ||
    z < 0 ||
    z >= mazeGrid.length ||
    x < 0 ||
    x >= mazeGrid[0].length
  ) {
    return false;
  }
  return mazeGrid[z][x] === 0;
}

function buildPath(mazeGrid, start, goal) {
  if (
    !mazeGrid ||
    !isWalkable(mazeGrid, start.x, start.z) ||
    !isWalkable(mazeGrid, goal.x, goal.z)
  ) {
    return [];
  }

  const queue = [{ x: start.x, z: start.z }];
  const visited = new Set([keyOf(start.x, start.z)]);
  const parent = new Map();
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.x === goal.x && current.z === goal.z) {
      const path = [];
      let cursorKey = keyOf(goal.x, goal.z);

      while (cursorKey) {
        const [cx, cz] = cursorKey.split(",").map(Number);
        path.push({ x: cx, z: cz });
        cursorKey = parent.get(cursorKey);
      }

      path.reverse();
      return path;
    }

    for (const [dx, dz] of directions) {
      const nx = current.x + dx;
      const nz = current.z + dz;
      const nk = keyOf(nx, nz);

      if (visited.has(nk) || !isWalkable(mazeGrid, nx, nz)) {
        continue;
      }

      visited.add(nk);
      parent.set(nk, keyOf(current.x, current.z));
      queue.push({ x: nx, z: nz });
    }
  }

  return [];
}

export function createTrollController({
  trollRoot,
  animations,
  wallBoxes,
  mazeGrid,
  cellSpacing = 1,
  speed = 2.6,
  colliderSize = new THREE.Vector3(1.1, 2.2, 1.1),
}) {
  const mixer = new THREE.AnimationMixer(trollRoot);
  const clip =
    THREE.AnimationClip.findByName(animations ?? [], "Walk") ??
    (animations ?? [])[0] ??
    null;
  let action = null;

  if (clip) {
    action = mixer.clipAction(clip);
    action.play();
  }

  const trollPosition = trollRoot.position;
  const previous = new THREE.Vector3();
  const gridSize = mazeGrid?.length ?? 0;
  const offset = (gridSize - 1) / 2;
  let currentPath = [];
  let pathIndex = 0;
  let pathRefreshTimer = 0;
  let lastTargetCellKey = "";

  return {
    update(delta, playerCameraPosition) {
      mixer.update(delta);

      if (!mazeGrid || mazeGrid.length === 0) {
        return;
      }

      pathRefreshTimer -= delta;
      const trollCell = worldToCell(trollPosition, offset, cellSpacing);
      tmpPlayerGround.set(
        playerCameraPosition.x,
        trollPosition.y,
        playerCameraPosition.z,
      );
      const playerCell = worldToCell(tmpPlayerGround, offset, cellSpacing);
      const targetKey = keyOf(playerCell.x, playerCell.z);

      if (
        pathRefreshTimer <= 0 ||
        currentPath.length === 0 ||
        lastTargetCellKey !== targetKey ||
        pathIndex >= currentPath.length
      ) {
        currentPath = buildPath(
          mazeGrid,
          { x: trollCell.x, z: trollCell.z },
          { x: playerCell.x, z: playerCell.z },
        );
        pathIndex = 1;
        pathRefreshTimer = 0.35;
        lastTargetCellKey = targetKey;
      }

      if (currentPath.length <= 1 || pathIndex >= currentPath.length) {
        return;
      }

      const nextCell = currentPath[pathIndex];
      const waypoint = cellToWorld(
        nextCell.x,
        nextCell.z,
        offset,
        cellSpacing,
        trollPosition.y,
      );

      previous.copy(trollPosition);

      tmpDesired.copy(waypoint).sub(trollPosition);
      tmpDesired.y = 0;

      const distanceSq = tmpDesired.lengthSq();
      if (distanceSq < 0.0001) {
        pathIndex += 1;
        return;
      }

      if (distanceSq < (cellSpacing * 0.2) ** 2) {
        pathIndex += 1;
      }

      tmpDesired.normalize();
      const step = speed * delta;
      tmpNext.copy(trollPosition).addScaledVector(tmpDesired, step);
      tmpNext.y = trollPosition.y;

      resolveHorizontalPositionCollision({
        position: tmpNext,
        previousPosition: previous,
        colliderSize,
        wallBoxes,
        centerYOffset: colliderSize.y * 0.5,
      });
      trollPosition.copy(tmpNext);

      tmpDesired.copy(waypoint).sub(trollPosition);
      tmpDesired.y = 0;
      if (tmpDesired.lengthSq() > 0.0001) {
        trollRoot.rotation.y = Math.atan2(tmpDesired.x, tmpDesired.z);
      }
    },
    stop() {
      if (action) {
        action.stop();
      }
    },
  };
}
