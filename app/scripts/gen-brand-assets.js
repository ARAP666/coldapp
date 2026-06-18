const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'assets');
const colors = {
  bg: '#08090b',
  panel: '#17191e',
  key: '#272a31',
  edge: '#3a3e48',
  blue: '#3b82f6',
  blueEdge: '#68a1ff',
  symbol: '#f6f7fb',
  muted: '#868b96',
};

function rgba(hex, alpha = 255) {
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
    a: alpha,
  };
}

function createCanvas(width, height, fill) {
  const png = new PNG({ width, height });
  const color = fill ? rgba(fill) : { r: 0, g: 0, b: 0, a: 0 };
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = color.r;
    png.data[i + 1] = color.g;
    png.data[i + 2] = color.b;
    png.data[i + 3] = color.a;
  }
  return png;
}

function setPixel(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const index = (Math.floor(y) * png.width + Math.floor(x)) * 4;
  png.data[index] = color.r;
  png.data[index + 1] = color.g;
  png.data[index + 2] = color.b;
  png.data[index + 3] = color.a;
}

function roundedRect(png, x, y, width, height, radius, fill, stroke, strokeWidth = 0) {
  const inside = (px, py, inset = 0) => {
    const left = x + inset;
    const top = y + inset;
    const right = x + width - inset;
    const bottom = y + height - inset;
    const r = Math.max(0, radius - inset);
    const cx = Math.max(left + r, Math.min(px, right - r));
    const cy = Math.max(top + r, Math.min(py, bottom - r));
    return (px - cx) ** 2 + (py - cy) ** 2 <= r ** 2;
  };
  const fillColor = rgba(fill);
  const strokeColor = stroke ? rgba(stroke) : null;
  for (let py = Math.floor(y); py < Math.ceil(y + height); py += 1) {
    for (let px = Math.floor(x); px < Math.ceil(x + width); px += 1) {
      if (!inside(px + 0.5, py + 0.5)) continue;
      const isStroke = strokeColor && strokeWidth > 0 && !inside(px + 0.5, py + 0.5, strokeWidth);
      setPixel(png, px, py, isStroke ? strokeColor : fillColor);
    }
  }
}

function circle(png, cx, cy, radius, color) {
  const fill = rgba(color);
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= radius ** 2) {
        setPixel(png, x, y, fill);
      }
    }
  }
}

function line(png, x1, y1, x2, y2, width, color) {
  const fill = rgba(color);
  const minX = Math.floor(Math.min(x1, x2) - width);
  const maxX = Math.ceil(Math.max(x1, x2) + width);
  const minY = Math.floor(Math.min(y1, y2) - width);
  const maxY = Math.ceil(Math.max(y1, y2) + width);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      if ((x - px) ** 2 + (y - py) ** 2 <= (width / 2) ** 2) {
        setPixel(png, x, y, fill);
      }
    }
  }
}

function operation(png, symbol, cx, cy, size) {
  const width = Math.max(5, size * 0.075);
  const arm = size * 0.28;
  if (symbol === '+' || symbol === '−' || symbol === '÷') {
    line(png, cx - arm, cy, cx + arm, cy, width, colors.symbol);
  }
  if (symbol === '+') {
    line(png, cx, cy - arm, cx, cy + arm, width, colors.symbol);
  }
  if (symbol === '×') {
    line(png, cx - arm, cy - arm, cx + arm, cy + arm, width, colors.symbol);
    line(png, cx + arm, cy - arm, cx - arm, cy + arm, width, colors.symbol);
  }
  if (symbol === '÷') {
    circle(png, cx, cy - arm * 1.25, width * 0.65, colors.symbol);
    circle(png, cx, cy + arm * 1.25, width * 0.65, colors.symbol);
  }
}

function drawMark(png, x, y, size, adaptive = false) {
  const panelInset = adaptive ? size * 0.255 : size * 0.175;
  roundedRect(
    png,
    x + panelInset,
    y + panelInset,
    size - panelInset * 2,
    size - panelInset * 2,
    size * 0.14,
    colors.panel
  );
  const keySize = size * (adaptive ? 0.205 : 0.24);
  const gap = size * 0.035;
  const total = keySize * 2 + gap;
  const startX = x + (size - total) / 2;
  const startY = y + (size - total) / 2;
  const keys = [
    ['+', startX, startY, false],
    ['−', startX + keySize + gap, startY, false],
    ['×', startX, startY + keySize + gap, false],
    ['÷', startX + keySize + gap, startY + keySize + gap, true],
  ];
  for (const [symbol, keyX, keyY, accent] of keys) {
    roundedRect(
      png,
      keyX,
      keyY,
      keySize,
      keySize,
      keySize * 0.27,
      accent ? colors.blue : colors.key,
      accent ? colors.blueEdge : colors.edge,
      Math.max(2, size * 0.006)
    );
    operation(png, symbol, keyX + keySize / 2, keyY + keySize / 2, keySize);
  }
}

function writePng(file, png) {
  fs.writeFileSync(file, PNG.sync.write(png, { colorType: 6 }));
}

function main() {
  const icon = createCanvas(1024, 1024, colors.bg);
  drawMark(icon, 0, 0, 1024);
  writePng(path.join(assets, 'icon.png'), icon);

  const adaptive = createCanvas(1024, 1024);
  drawMark(adaptive, 0, 0, 1024, true);
  writePng(path.join(assets, 'adaptive-icon.png'), adaptive);

  const favicon = createCanvas(192, 192, colors.bg);
  drawMark(favicon, 0, 0, 192);
  writePng(path.join(assets, 'favicon.png'), favicon);

  const splash = createCanvas(1284, 2778, colors.bg);
  drawMark(splash, 322, 880, 640);
  const muted = rgba(colors.muted);
  for (let i = 0; i < 4; i += 1) {
    circle(splash, 588 + i * 36, 1740, 5, colors.muted);
  }
  line(splash, 548, 1795, 736, 1795, 2, colors.muted);
  setPixel(splash, 642, 1795, muted);
  writePng(path.join(assets, 'splash.png'), splash);

  console.log('[brand-assets] generated icon, adaptive icon, favicon and splash');
}

main();
