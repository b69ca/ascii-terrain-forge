#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { createTerrain, analyze, render, renderSVG } from './index.js';
import { parse, integer, decimal, terminal } from './terminal.js';
const args = process.argv.slice(2);
if (args.includes('--help')) { console.log('Usage: ascii-terrain-forge [--seed N] [--width N] [--height N] [--water 0..1] [--roughness 0.1..0.9] [--json] [--svg FILE] [--no-color]\nControls: n new seed, +/- sea level, [/] roughness, r reset, q quit'); process.exit(0); }
try {
  const options = parse(args, ['--seed', '--width', '--height', '--water', '--roughness', '--svg']);
  const live = !!(process.stdout.isTTY && process.stdin.isTTY && !options['--json'] && !options['--svg']);
  const width = integer(options, '--width', live ? Math.max(8, Math.min(100, (process.stdout.columns || 80) - 1)) : 80, 160);
  const height = integer(options, '--height', live ? Math.max(8, Math.min(40, (process.stdout.rows || 28) - 4)) : 32, 160);
  let seed = integer(options, '--seed', 7, 0xffffffff), water = decimal(options, '--water', 0.32), roughness = decimal(options, '--roughness', 0.5);
  const initial = { seed, water, roughness }, make = () => createTerrain({ width, height, seed, water, roughness }); let terrain = make();
  if (options['--json'] || options['--svg']) {
    if (options['--svg']) await writeFile(options['--svg'], renderSVG(terrain));
    if (options['--json']) console.log(JSON.stringify(analyze(terrain), null, 2));
  } else await terminal({ live,
    onKey: key => {
      if (key === 'n') { seed = (seed + 1) >>> 0; terrain = make(); }
      else if (key === '+' || key === '=') { water = Math.min(1, water + 0.02); terrain.water = water; }
      else if (key === '-') { water = Math.max(0, water - 0.02); terrain.water = water; }
      else if (key === '[' || key === ']') { roughness = Math.max(0.1, Math.min(0.9, roughness + (key === ']' ? 0.05 : -0.05))); terrain = make(); }
      else if (key === 'r') { ({ seed, water, roughness } = initial); terrain = make(); }
    }, onTick: () => false,
    draw: () => { const r = analyze(terrain); return `TERRAIN FORGE | seed ${seed} | sea ${water.toFixed(2)} | roughness ${roughness.toFixed(2)}\n${render(terrain, { color: live && !options['--no-color'] && !process.env.NO_COLOR })}\n${(r.landFraction * 100).toFixed(1)}% land | n seed +/- sea [/] roughness r reset q quit`; }
  });
} catch (error) { console.error(`ascii-terrain-forge: ${error.message}`); process.exitCode = 2; }
