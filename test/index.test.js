import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTerrain, biome, analyze, render, renderSVG } from '../src/index.js';
const cli = args => spawnSync(process.execPath, ['src/cli.js', ...args], { encoding: 'utf8' });
test('same seed reproduces heights; different seeds and roughness change them', () => {
  const a = createTerrain(); assert.deepEqual(a, createTerrain()); assert.notDeepEqual(a.heights, createTerrain({ seed: 8 }).heights); assert.notDeepEqual(a.heights, createTerrain({ roughness: 0.8 }).heights);
});
test('height fields stay finite and bounded across extreme seeds and dimensions', () => {
  for (const seed of [0, 1, 4294967295]) { const t = createTerrain({ width: 8, height: 12, seed }); assert.equal(t.heights.length, 96); assert.ok(t.heights.every(h => Number.isFinite(h) && h >= 0 && h <= 1)); }
});
test('sea level changes biomes without changing the underlying landscape', () => {
  const dry = createTerrain({ water: 0 }), wet = createTerrain({ water: 1 }); assert.deepEqual(dry.heights, wet.heights);
  assert.equal(analyze(wet).landFraction, 0); assert.ok(analyze(dry).landFraction > 0.5);
  let previous = Infinity; for (const water of [0, 0.2, 0.4, 0.6, 0.8, 1]) { const r = analyze(createTerrain({ water })); assert.ok(r.landFraction <= previous); previous = r.landFraction; }
});
test('counts partition the map and biome thresholds include water equality', () => {
  const t = createTerrain(), r = analyze(t); assert.equal(Object.values(r.counts).reduce((n, x) => n + x, 0), t.width * t.height);
  assert.equal(biome(0.32, 0.32).name, 'water'); assert.equal(biome(1, 1).name, 'water'); assert.equal(biome(1, 0).name, 'snow');
  assert.ok(r.maxHeight >= r.minHeight); assert.ok(r.landFraction > 0 && r.landFraction < 1);
});
test('validates arguments and renders portable ASCII and SVG', () => {
  for (const options of [{ width: 7 }, { seed: -1 }, { roughness: 0 }, { water: 1.1 }, { water: NaN }]) assert.throws(() => createTerrain(options));
  const t = createTerrain({ width: 20, height: 8 }); assert.equal(render(t).split('\n').length, 8); assert.ok(render(t).split('\n').every(row => row.length === 20));
  assert.equal(render(t).includes('\x1b'), false); assert.ok(render(t, { color: true }).includes('\x1b[')); assert.match(renderSVG(t), /^<svg/);
});
test('CLI produces deterministic JSON, plain output, and error exit codes', () => {
  const r = cli(['--seed', '7', '--json']); assert.equal(r.status, 0); assert.equal(JSON.parse(r.stdout).seed, 7); assert.equal(r.stdout, cli(['--seed', '7', '--json']).stdout);
  const plain = cli([]); assert.equal(plain.status, 0); assert.equal(plain.stdout.includes('\x1b'), false);
  for (const args of [['--seed'], ['--seed', '-1'], ['--water', 'bad'], ['--water', '2'], ['--roughness', '0'], ['--wat']]) assert.equal(cli(args).status, 2);
});
test('CLI exports SVG and reports write errors', () => {
  const dir = mkdtempSync(join(tmpdir(), 'terrain-')); try { const file = join(dir, 'terrain.svg'); assert.equal(cli(['--svg', file]).status, 0); assert.match(readFileSync(file, 'utf8'), /TERRAIN FORGE/); assert.equal(cli(['--svg', join(dir, 'missing', 'x.svg')]).status, 2); } finally { rmSync(dir, { recursive: true, force: true }); }
});
