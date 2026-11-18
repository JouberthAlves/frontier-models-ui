// Cut the Magnific sprite sheets (4×3 grid on flat magenta) into trimmed transparent WebP sprites,
// and tone the ground textures. Usage: node cut-sprites.cjs <srcDir> <outDir>
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const [src, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

const SHEETS = {
  'sheet-vegetation.png': ['tree-round', 'tree-round-dark', 'oak', 'bush', 'palm', 'palm-2', 'pine', 'pine-2', 'bushes', 'hedge', 'flowers', 'rocks'],
  'sheet-village.png': ['house', 'house-square', 'house-l', 'house-long', 'church', 'umbrella-coral', 'umbrella-teal', 'sailboat', 'rowboat', 'bridge', 'stand', 'fence'],
};

async function keyMagenta(buf, w, h) {
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0, j = 0; i < buf.length; i += 3, j += 4) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    // distance from pure magenta; magenta has high r and b and low g
    const d = Math.sqrt((255 - r) ** 2 + g ** 2 + (255 - b) ** 2);
    let a = Math.min(1, Math.max(0, (d - 70) / 90));
    // Un-mix the magenta from edge pixels: c = (c - (1 - a) * magenta) / a
    let rr = r, gg = g, bb = b;
    if (a > 0 && a < 1) {
      rr = Math.min(255, Math.max(0, (r - (1 - a) * 255) / a));
      gg = Math.min(255, Math.max(0, g / a));
      bb = Math.min(255, Math.max(0, (b - (1 - a) * 255) / a));
    }
    px[j] = rr; px[j + 1] = gg; px[j + 2] = bb; px[j + 3] = Math.round(a * 255);
  }
  return px;
}

// Keep the main drawing: drop opaque islands smaller than 8% of the largest one (bits of the
// neighbouring cell that spilled in). Multi-part sprites (3 bushes, 3 rocks) keep all big parts.
function keepMainParts(px, w, h) {
  const label = new Int32Array(w * h).fill(-1);
  const sizes = [];
  const solid = i => px[i * 4 + 3] > 40;
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== -1 || !solid(i)) continue;
    const id = sizes.length; let n = 0; const stack = [i]; label[i] = id;
    while (stack.length) {
      const k = stack.pop(); n++;
      const x = k % w, y = (k / w) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx; if (label[q] === -1 && solid(q)) { label[q] = id; stack.push(q); }
      }
    }
    sizes.push(n);
  }
  const max = Math.max(0, ...sizes);
  for (let i = 0; i < w * h; i++) {
    const id = label[i];
    if (id >= 0 ? sizes[id] < max * 0.08 : px[i * 4 + 3] > 0) {
      // drop small islands, and faint pixels not attached to any kept part
      if (id >= 0 || !nearKept(i)) px[i * 4 + 3] = 0;
    }
  }
  function nearKept(i) {
    const x = i % w, y = (i / w) | 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const id = label[ny * w + nx]; if (id >= 0 && sizes[id] >= max * 0.08) return true;
    }
    return false;
  }
  return px;
}

// Cells where an object overflowed its grid cell: crop box in the 800 px preview coordinates.
const OVERRIDE = { oak: [402, 70, 628, 280], bush: [648, 120, 765, 235] };

(async () => {
  const manifest = {};
  for (const [file, names] of Object.entries(SHEETS)) {
    const img = sharp(path.join(src, file));
    const { width, height } = await img.metadata();
    const cw = Math.floor(width / 4), ch = Math.floor(height / 3);
    for (let k = 0; k < names.length; k++) {
      const col = k % 4, row = Math.floor(k / 4);
      const k8 = width / 800; const ov = OVERRIDE[names[k]]; const box = ov ? { left: Math.round(ov[0] * k8), top: Math.round(ov[1] * k8), width: Math.round((ov[2] - ov[0]) * k8), height: Math.round((ov[3] - ov[1]) * k8) } : { left: col * cw, top: row * ch, width: cw, height: ch }; const cell = await sharp(path.join(src, file)).extract(box).removeAlpha().raw().toBuffer();
      const rgba = keepMainParts(await keyMagenta(cell, box.width, box.height), box.width, box.height);
      const trimmed = await sharp(rgba, { raw: { width: box.width, height: box.height, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
      const name = names[k];
      const maxSide = 256;
      const res = await sharp(trimmed.data).resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86, alphaQuality: 90 }).toFile(path.join(out, `${name}.webp`));
      manifest[name] = { w: res.width, h: res.height, bytes: res.size };
    }
  }
  // Ground textures: tone down toward the approved pastel mockup, 512 px tiles.
  const tex = { 'tex-grass.png': ['grass', { saturation: 0.72, brightness: 1.0 }], 'tex-sand.png': ['sand', { saturation: 0.7, brightness: 1.03 }], 'tex-sea.png': ['sea', { saturation: 0.9, brightness: 1.0 }] };
  for (const [file, [name, mod]] of Object.entries(tex)) {
    const res = await sharp(path.join(src, file)).modulate(mod).resize(512, 512).webp({ quality: 80 }).toFile(path.join(out, `${name}.webp`));
    manifest[name] = { w: res.width, h: res.height, bytes: res.size, tile: true };
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const total = Object.values(manifest).reduce((s, m) => s + m.bytes, 0);
  console.log(Object.keys(manifest).length, 'files', (total / 1024).toFixed(0), 'KB');
})();
