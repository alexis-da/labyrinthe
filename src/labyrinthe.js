import * as THREE from "three";

function shuffle(array) {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function generateMazeGrid(size) {
  const maze = Array.from({ length: size }, () => Array(size).fill(1));

  function carve(x, y) {
    maze[y][x] = 0;

    const directions = shuffle([
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ]);

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;

      if (ny >= 0 && ny < size && nx >= 0 && nx < size && maze[ny][nx] === 1) {
        maze[y + dy / 2][x + dx / 2] = 0;
        carve(nx, ny);
      }
    }
  }

  carve(1, 1);

  return maze;
}

export async function createProceduralMaze(options = {}) {
  const {
    size = 21,
    wallHeight = 3,
    floorThickness = 0.1,
    wallTexturePath = "/assets/wall.png",
    blockSize = 1.5,
    playerEyeHeight = 1.8,
  } = options;  

  const oddSize = size % 2 === 0 ? size + 1 : size;
  const maze = generateMazeGrid(oddSize);
  const cellSpacing = blockSize;

  const start = { x: 1, z: 1 };
  const end = { x: oddSize - 2, z: oddSize - 2 };

  maze[start.z][start.x] = 0;
  maze[end.z][end.x] = 0;

  const offset = (oddSize - 1) / 2;
  const group = new THREE.Group();

  const textureLoader = new THREE.TextureLoader();
  const wallTexture = await textureLoader.loadAsync(wallTexturePath);
  wallTexture.colorSpace = THREE.SRGBColorSpace;
  wallTexture.wrapS = THREE.RepeatWrapping;
  wallTexture.wrapT = THREE.RepeatWrapping;

  const wallGeo = new THREE.BoxGeometry(blockSize, wallHeight, blockSize);
  const floorGeo = new THREE.BoxGeometry(
    cellSpacing,
    floorThickness,
    cellSpacing,
  );

  const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2f2f2f });
  const startMat = new THREE.MeshStandardMaterial({ color: 0x00ff7f });
  const endMat = new THREE.MeshStandardMaterial({ color: 0xff5a5a });

  for (let z = 0; z < oddSize; z += 1) {
    for (let x = 0; x < oddSize; x += 1) {
      const cell = maze[z][x];
      const posX = (x - offset) * cellSpacing;
      const posZ = (z - offset) * cellSpacing;

      if (cell === 1) {
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.set(posX, wallHeight / 2, posZ);
        wall.castShadow = false;
        wall.receiveShadow = true;
        wall.userData.isWall = true;
        group.add(wall);
      } else {
        const tile = new THREE.Mesh(floorGeo, floorMat);
        tile.position.set(posX, floorThickness / 2, posZ);
        tile.receiveShadow = true;
        group.add(tile);
      }

      if (x === start.x && z === start.z) {
        const startTile = new THREE.Mesh(
          new THREE.BoxGeometry(cellSpacing * 0.9, 0.05, cellSpacing * 0.9),
          startMat,
        );
        startTile.position.set(posX, floorThickness + 0.03, posZ);
        group.add(startTile);
      }

      if (x === end.x && z === end.z) {
        const endTile = new THREE.Mesh(
          new THREE.BoxGeometry(cellSpacing * 0.9, 0.05, cellSpacing * 0.9),
          endMat,
        );
        endTile.position.set(posX, floorThickness + 0.03, posZ);
        group.add(endTile);
      }
    }
  }

  const spawnPoint = new THREE.Vector3(
    (start.x - offset) * cellSpacing,
    floorThickness + playerEyeHeight,
    (start.z - offset) * cellSpacing,
  );

  return {
    maze,
    group,
    start,
    end,
    spawnPoint,
  };
}
