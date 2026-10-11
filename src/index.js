function lattice(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) >>> 0;
  h = Math.imul(h ^ h >>> 13, 1274126177); h = (h ^ h >>> 16) >>> 0;
  return h / 4294967295;
}
function noise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const top = lattice(ix, iy, seed) * (1 - sx) + lattice(ix + 1, iy, seed) * sx;
  const bottom = lattice(ix, iy + 1, seed) * (1 - sx) + lattice(ix + 1, iy + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}
export function createTerrain({ width = 80, height = 32, seed = 7, roughness = 0.5, water = 0.32 } = {}) {
  if (![width, height].every(n => Number.isInteger(n) && n >= 8 && n <= 160)) throw new Error('dimensions must be integers from 8 to 160');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('seed must be an unsigned 32-bit integer');
  if (!Number.isFinite(roughness) || roughness < 0.1 || roughness > 0.9 || !Number.isFinite(water) || water < 0 || water > 1) throw new Error('roughness must be 0.1–0.9 and water must be 0–1');
  const heights = new Float64Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const nx = x / (width - 1), ny = y / (height - 1); let total = 0, weight = 0, amplitude = 1, frequency = 3;
    for (let octave = 0; octave < 5; octave++) { total += noise(nx * frequency + 17, ny * frequency + 29, (seed + octave * 1013) >>> 0) * amplitude; weight += amplitude; amplitude *= roughness; frequency *= 2; }
    const radius = Math.hypot(nx * 2 - 1, ny * 2 - 1);
    heights[y * width + x] = Math.max(0, Math.min(1, total / weight * 0.75 + 0.35 - radius * 0.5));
  }
  return { width, height, seed, roughness, water, heights };
}
export function biome(value, water) {
  if (value <= water) return { name: 'water', char: '~', color: '#1e4c79', ansi: 34 };
  const land = (value - water) / (1 - water);
  if (land < 0.05) return { name: 'beach', char: '.', color: '#efd493', ansi: 33 };
  if (land < 0.2) return { name: 'meadow', char: ',', color: '#7acb8d', ansi: 32 };
  if (land < 0.35) return { name: 'forest', char: 't', color: '#31896b', ansi: 32 };
  if (land < 0.5) return { name: 'hill', char: 'n', color: '#82917d', ansi: 90 };
  if (land < 0.65) return { name: 'mountain', char: '^', color: '#b6bac4', ansi: 37 };
  return { name: 'snow', char: 'A', color: '#f4f6ff', ansi: 97 };
}
export function analyze(terrain) {
  const counts = { water: 0, beach: 0, meadow: 0, forest: 0, hill: 0, mountain: 0, snow: 0 };
  let min = Infinity, max = -Infinity;
  for (const value of terrain.heights) { counts[biome(value, terrain.water).name]++; min = Math.min(min, value); max = Math.max(max, value); }
  return { width: terrain.width, height: terrain.height, seed: terrain.seed, roughness: terrain.roughness, water: terrain.water, minHeight: min, maxHeight: max, landFraction: 1 - counts.water / terrain.heights.length, counts };
}
export function render(terrain, { color = false } = {}) {
  return Array.from({ length: terrain.height }, (_, y) => Array.from({ length: terrain.width }, (_, x) => { const b = biome(terrain.heights[y * terrain.width + x], terrain.water); return color ? `\x1b[${b.ansi}m${b.char}\x1b[0m` : b.char; }).join('')).join('\n');
}
export function renderSVG(terrain) {
  const size = 8, w = Math.max(640, terrain.width * size + 64), h = terrain.height * size + 146, report = analyze(terrain);
  const cells = [...terrain.heights].map((value, id) => `<rect x="${32 + id % terrain.width * size}" y="${88 + Math.floor(id / terrain.width) * size}" width="${size}" height="${size}" fill="${biome(value, terrain.water).color}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${Math.round(h * 800 / w)}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" rx="18" fill="#0d1525"/><g font-family="monospace"><text x="32" y="36" font-size="22" fill="#e8edf8">ASCII TERRAIN FORGE</text><text x="32" y="62" font-size="12" fill="#93a4bc">seed ${terrain.seed} / water ${terrain.water.toFixed(2)} / roughness ${terrain.roughness.toFixed(2)}</text>${cells}<text x="32" y="${h - 30}" font-size="12" fill="#93a4bc">${(report.landFraction * 100).toFixed(1)}% land / ~ sea . beach , meadow t forest n hills ^ mountains A snow</text><text x="32" y="${h - 12}" font-size="12" fill="#93a4bc">n new seed / +/- sea level / [ ] roughness / r reset / q quit</text></g></svg>\n`;
}
