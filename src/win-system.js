export function createWinSystem({
  endCell,
  mazeSize,
  blockSize,
  playerY,
  reachFactor = 0.55,
}) {
  const mazeOffset = (mazeSize - 1) / 2;
  const endWorldPosition = {
    x: (endCell.x - mazeOffset) * blockSize,
    y: playerY,
    z: (endCell.z - mazeOffset) * blockSize,
  };
  const endReachDistanceSq = (blockSize * reachFactor) ** 2;

  function isReached(playerPosition) {
    const dx = playerPosition.x - endWorldPosition.x;
    const dz = playerPosition.z - endWorldPosition.z;
    return dx * dx + dz * dz <= endReachDistanceSq;
  }

  return {
    isReached,
    getEndWorldPosition() {
      return { ...endWorldPosition };
    },
  };
}
