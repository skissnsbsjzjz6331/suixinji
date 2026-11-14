// Red and green encode how far the lens samples away from each backdrop pixel.
export function createDockRefractionMap() {
  const width = 96;
  const height = 64;
  const radius = 27;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return '';

  const pixels = context.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x + .5 - width / 2;
      const dy = y + .5 - height / 2;
      const edgeX = Math.max(0, Math.abs(dx) - (width / 2 - radius));
      const edgeY = Math.max(0, Math.abs(dy) - (height / 2 - radius));
      const distance = Math.hypot(edgeX, edgeY);
      const rim = Math.max(0, 1 - Math.abs(radius - distance) / 13);
      const bend = distance ? 104 * rim ** 1.5 / distance : 0;
      const offset = (y * width + x) * 4;
      pixels.data[offset] = 128 - Math.sign(dx) * edgeX * bend;
      pixels.data[offset + 1] = 128 - Math.sign(dy) * edgeY * bend;
      pixels.data[offset + 2] = 128;
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL();
}
