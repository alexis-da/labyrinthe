export function createUIManager({ onStart, onReplay }) {
  const startScreen = document.getElementById("start-screen");
  const victoryScreen = document.getElementById("victory-screen");
  const gameOverScreen = document.getElementById("gameover-screen");
  const startButton = document.getElementById("start-button");
  const replayButton = document.getElementById("replay-button");
  const replayButtonGameOver = document.getElementById(
    "replay-button-gameover",
  );
  const damageOverlay = document.getElementById("damage-overlay");
  const hud = document.getElementById("hud");
  const healthFill = document.getElementById("health-fill");

  startButton?.addEventListener("click", () => {
    onStart?.();
  });

  replayButton?.addEventListener("click", () => {
    onReplay?.();
  });

  replayButtonGameOver?.addEventListener("click", () => {
    onReplay?.();
  });

  return {
    startGameUI() {
      startScreen?.classList.add("hidden");
      victoryScreen?.classList.add("hidden");
      gameOverScreen?.classList.add("hidden");
      hud?.classList.remove("hidden");
    },
    showVictory() {
      victoryScreen?.classList.remove("hidden");
      hud?.classList.add("hidden");
    },
    showGameOver() {
      gameOverScreen?.classList.remove("hidden");
      hud?.classList.add("hidden");
    },
    setHealthRatio(ratio) {
      if (!healthFill) return;
      const clamped = Math.max(0, Math.min(1, ratio));
      healthFill.style.width = `${(clamped * 100).toFixed(2)}%`;
    },
    setDamageOverlay(alpha) {
      if (!damageOverlay) return;
      const clamped = Math.max(0, Math.min(1, alpha));
      damageOverlay.style.opacity = clamped.toFixed(3);
    },
  };
}
