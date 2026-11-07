const GLYPHS = '01<>{}[]/\\|=+*#◇◆△▽%&$@!?アイウエオカキクケコサシスセソ';

export function startGlyphRain(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const fontSize = 13;
  let width = 0;
  let height = 0;
  let columns = 0;
  let drops: number[] = [];
  let speeds: number[] = [];
  let raf = 0;
  let last = performance.now();

  const resize = (): void => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    columns = Math.ceil(width / fontSize);
    drops = Array.from({ length: columns }, () => Math.random() * height);
    speeds = Array.from({ length: columns }, () => 14 + Math.random() * 40);

    ctx.fillStyle = '#03050c';
    ctx.fillRect(0, 0, width, height);
  };

  const frame = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    ctx.fillStyle = 'rgba(3, 5, 12, 0.13)';
    ctx.fillRect(0, 0, width, height);
    ctx.font = `${fontSize}px ui-monospace, Consolas, monospace`;

    for (let i = 0; i < columns; i++) {
      if (Math.random() > 0.07) continue;

      const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      const roll = Math.random();
      ctx.fillStyle =
        roll > 0.965
          ? 'rgba(255, 43, 77, 0.5)'
          : roll > 0.9
            ? 'rgba(156, 201, 255, 0.42)'
            : 'rgba(111, 191, 143, 0.32)';

      ctx.fillText(glyph, i * fontSize, drops[i]);
      drops[i] += speeds[i] * dt * 4;

      if (drops[i] > height + 24) drops[i] = -Math.random() * height * 0.5;
    }

    raf = requestAnimationFrame(frame);
  };

  resize();
  window.addEventListener('resize', resize);
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
}
