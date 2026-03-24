import * as THREE from "three";
import { setBoxFromPosition } from "./player-collisions.js";

export function createCombatSystem({
  trollRoot,
  trollColliderSize,
  playerController,
  maxHealth = 100,
  damagePerSecond = 26,
  meleeRange = 1.2,
}) {
  const trollHitBox = new THREE.Box3();
  const trollToPlayer = new THREE.Vector3();
  const meleeRangeSq = meleeRange * meleeRange;

  let health = maxHealth;
  let damageVignetteAlpha = 0;

  function reset() {
    health = maxHealth;
    damageVignetteAlpha = 0;
  }

  function update(delta, isGameActive, cameraPosition) {
    if (isGameActive) {
      setBoxFromPosition({
        targetBox: trollHitBox,
        position: trollRoot.position,
        colliderSize: trollColliderSize,
        centerYOffset: trollColliderSize.y * 0.5,
      });

      trollToPlayer.copy(cameraPosition).sub(trollRoot.position);
      trollToPlayer.y = 0;

      const isTouching =
        playerController.getBoundingBox().intersectsBox(trollHitBox) ||
        trollToPlayer.lengthSq() <= meleeRangeSq;

      if (isTouching) {
        health = Math.max(0, health - damagePerSecond * delta);
        damageVignetteAlpha = Math.min(0.8, damageVignetteAlpha + delta * 2.8);
      } else {
        damageVignetteAlpha = Math.max(0, damageVignetteAlpha - delta * 1.6);
      }
    } else {
      damageVignetteAlpha = Math.max(0, damageVignetteAlpha - delta * 2.2);
    }

    return {
      health,
      damageVignetteAlpha,
      dead: health <= 0,
    };
  }

  return {
    reset,
    update,
    getHealth() {
      return health;
    },
    getMaxHealth() {
      return maxHealth;
    },
  };
}
