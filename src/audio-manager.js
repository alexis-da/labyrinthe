import * as THREE from "three";

export function createBackgroundMusicManager({
  camera,
  path,
  volume = 0.35,
  loop = true,
  minVolume = 0.08,
  maxVolume = volume,
  nearDistance = 2.5,
  farDistance = 30,
  volumeSmoothing = 7,
  proximityExponent = 1,
}) {
  const listener = new THREE.AudioListener();
  camera.add(listener);

  const bgMusic = new THREE.Audio(listener);
  const loader = new THREE.AudioLoader();

  let isReady = false;
  let hasStarted = false;
  let currentVolume = volume;

  loader.load(
    path,
    (buffer) => {
      bgMusic.setBuffer(buffer);
      bgMusic.setLoop(loop);
      bgMusic.setVolume(currentVolume);
      isReady = true;
    },
    undefined,
    () => {
      console.warn(`Musique non trouvee: ${path}`);
    },
  );

  function clamp01(value) {
    return Math.min(1, Math.max(0, value));
  }

  function computeTargetVolume(distance) {
    const safeRange = Math.max(0.001, farDistance - nearDistance);
    const normalized = clamp01((distance - nearDistance) / safeRange);
    const proximity = Math.pow(
      1 - normalized,
      Math.max(0.01, proximityExponent),
    );
    return minVolume + (maxVolume - minVolume) * proximity;
  }

  return {
    tryStart() {
      if (hasStarted || !isReady) return;
      hasStarted = true;
      bgMusic.play();
    },
    updateFromDistance(distance, delta = 1 / 60) {
      const targetVolume = computeTargetVolume(distance);
      const alpha = 1 - Math.exp(-Math.max(0, volumeSmoothing) * delta);
      currentVolume += (targetVolume - currentVolume) * alpha;

      if (isReady) {
        bgMusic.setVolume(currentVolume);
      }
    },
  };
}
