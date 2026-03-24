import * as THREE from "three";
import {
  resolvePlayerCollisions,
  updatePlayerBoundingBoxFromCamera,
} from "./player-collisions.js";

export function createPlayerController({
  camera,
  controls,
  playerEyeHeight,
  moveSpeed,
  playerColliderSize,
  wallBoxes,
  maxSubStep = 0.15,
}) {
  const moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  };

  const playerBox = new THREE.Box3();
  const moveForwardVector = new THREE.Vector3();
  const moveRightVector = new THREE.Vector3();
  const moveDirection = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);

  function onKeyDown(e) {
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
  }

  function onKeyUp(e) {
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
  }

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  return {
    update(delta, isActive) {
      if (!isActive || !controls.isLocked) {
        updatePlayerBoundingBoxFromCamera({
          targetBox: playerBox,
          camera,
          eyeHeight: playerEyeHeight,
          colliderSize: playerColliderSize,
        });
        return;
      }

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
          const steps = Math.max(1, Math.ceil(totalDistance / maxSubStep));
          const stepDistance = totalDistance / steps;

          for (let i = 0; i < steps; i += 1) {
            const previousPosition = camera.position.clone();
            camera.position.addScaledVector(moveDirection, stepDistance);

            resolvePlayerCollisions({
              camera,
              previousPosition,
              eyeHeight: playerEyeHeight,
              colliderSize: playerColliderSize,
              wallBoxes,
            });
          }
        }
      }

      updatePlayerBoundingBoxFromCamera({
        targetBox: playerBox,
        camera,
        eyeHeight: playerEyeHeight,
        colliderSize: playerColliderSize,
      });
    },
    reset(spawnPoint) {
      moveState.forward = false;
      moveState.backward = false;
      moveState.left = false;
      moveState.right = false;
      camera.position.copy(spawnPoint);

      updatePlayerBoundingBoxFromCamera({
        targetBox: playerBox,
        camera,
        eyeHeight: playerEyeHeight,
        colliderSize: playerColliderSize,
      });
    },
    getBoundingBox() {
      return playerBox;
    },
  };
}
