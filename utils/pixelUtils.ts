
import { AnchorType, PixelateMode, PixelateSettings } from '../types';

export const createEmptyGrid = (width: number, height: number): string[][] => {
  return Array(height).fill(null).map(() => Array(width).fill('transparent'));
};

export const getAnchorOffsets = (
  containerW: number,
  containerH: number,
  contentW: number,
  contentH: number,
  anchor: AnchorType
): { x: number, y: number } => {
  const dw = containerW - contentW;
  const dh = containerH - contentH;

  switch (anchor) {
    case AnchorType.TOP_LEFT: return { x: 0, y: 0 };
    case AnchorType.TOP_CENTER: return { x: dw / 2, y: 0 };
    case AnchorType.TOP_RIGHT: return { x: dw, y: 0 };
    case AnchorType.MIDDLE_LEFT: return { x: 0, y: dh / 2 };
    case AnchorType.CENTER: return { x: dw / 2, y: dh / 2 };
    case AnchorType.MIDDLE_RIGHT: return { x: dw, y: dh / 2 };
    case AnchorType.BOTTOM_LEFT: return { x: 0, y: dh };
    case AnchorType.BOTTOM_CENTER: return { x: dw / 2, y: dh };
    case AnchorType.BOTTOM_RIGHT: return { x: dw, y: dh };
    default: return { x: 0, y: 0 };
  }
};

// Simple Color Distance (Euclidean in RGB)
const colorDistance = (c1: number[], c2: number[]) => {
  return Math.sqrt(
    Math.pow(c1[0] - c2[0], 2) +
    Math.pow(c1[1] - c2[1], 2) +
    Math.pow(c1[2] - c2[2], 2) +
    Math.pow((c1[3] || 255) - (c2[3] || 255), 2)
  );
};

const findClosestPaletteColor = (rgba: number[], palette: number[][]) => {
  let minDistance = Infinity;
  let closest = palette[0];
  for (const p of palette) {
    const d = colorDistance(rgba, p);
    if (d < minDistance) {
      minDistance = d;
      closest = p;
    }
  }
  return closest;
};

// Median-Cut implementation
const medianCut = (pixels: number[][], depth: number): number[][] => {
  if (depth === 0 || pixels.length === 0) {
    const avg = [0, 0, 0, 0];
    for (const p of pixels) {
      avg[0] += p[0]; avg[1] += p[1]; avg[2] += p[2]; avg[3] += p[3];
    }
    const count = pixels.length || 1;
    return [[
      Math.round(avg[0] / count),
      Math.round(avg[1] / count),
      Math.round(avg[2] / count),
      Math.round(avg[3] / count)
    ]];
  }

  // Find channel with largest range
  let mins = [255, 255, 255, 255], maxs = [0, 0, 0, 0];
  for (const p of pixels) {
    for (let i = 0; i < 4; i++) {
      if (p[i] < mins[i]) mins[i] = p[i];
      if (p[i] > maxs[i]) maxs[i] = p[i];
    }
  }
  const ranges = maxs.map((v, i) => v - mins[i]);
  const channelToSplit = ranges.indexOf(Math.max(...ranges));

  pixels.sort((a, b) => a[channelToSplit] - b[channelToSplit]);
  const mid = Math.floor(pixels.length / 2);
  
  return [
    ...medianCut(pixels.slice(0, mid), depth - 1),
    ...medianCut(pixels.slice(mid), depth - 1)
  ];
};

export const pixelateImage = async (
  img: HTMLImageElement,
  settings: PixelateSettings
): Promise<string[][]> => {
  const { width, height, mode, anchor, paletteSize, dither, bgColor } = settings;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas not supported");

  canvas.width = width;
  canvas.height = height;

  // 1. Geometry phase
  ctx.imageSmoothingEnabled = false;
  
  // Fill background
  if (bgColor === 'transparent') {
    ctx.clearRect(0, 0, width, height);
  } else {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
  }

  let sw = img.width, sh = img.height;
  let sx = 0, sy = 0;
  let dx = 0, dy = 0, dw = width, dh = height;

  if (mode === PixelateMode.STRETCH) {
    ctx.drawImage(img, 0, 0, sw, sh, 0, 0, width, height);
  } else if (mode === PixelateMode.COVER) {
    const srcRatio = sw / sh;
    const dstRatio = width / height;
    if (srcRatio > dstRatio) {
      sw = sh * dstRatio;
      const offsets = getAnchorOffsets(img.width, img.height, sw, sh, anchor);
      sx = offsets.x;
    } else {
      sh = sw / dstRatio;
      const offsets = getAnchorOffsets(img.width, img.height, sw, sh, anchor);
      sy = offsets.y;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
  } else if (mode === PixelateMode.CONTAIN) {
    const srcRatio = sw / sh;
    const dstRatio = width / height;
    if (srcRatio > dstRatio) {
      dh = width / srcRatio;
    } else {
      dw = height * srcRatio;
    }
    const offsets = getAnchorOffsets(width, height, dw, dh, anchor);
    dx = offsets.x;
    dy = offsets.y;
    ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh);
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 2. Quantization phase
  let palette: number[][] = [];
  if (paletteSize > 0) {
    const pixels: number[][] = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 10) { // Only sample non-transparent colors
        pixels.push([data[i], data[i+1], data[i+2], data[i+3]]);
      }
    }
    
    const depth = Math.ceil(Math.log2(paletteSize));
    palette = medianCut(pixels, depth);
  }

  // 3. Color mapping & Dithering phase
  const grid: string[][] = createEmptyGrid(width, height);

  if (paletteSize > 0 && dither) {
    // Floyd-Steinberg error diffusion
    const errorBuffer = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) errorBuffer[i] = data[i];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (errorBuffer[i+3] < 128) continue;

        const oldR = errorBuffer[i];
        const oldG = errorBuffer[i+1];
        const oldB = errorBuffer[i+2];

        const closest = findClosestPaletteColor([oldR, oldG, oldB, 255], palette);
        
        const errR = oldR - closest[0];
        const errG = oldG - closest[1];
        const errB = oldB - closest[2];

        const hex = "#" + ((1 << 24) + (closest[0] << 16) + (closest[1] << 8) + closest[2]).toString(16).slice(1);
        grid[y][x] = hex;

        // Spread error
        const distribute = (nx: number, ny: number, weight: number) => {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const ni = (ny * width + nx) * 4;
            errorBuffer[ni] += errR * weight;
            errorBuffer[ni+1] += errG * weight;
            errorBuffer[ni+2] += errB * weight;
          }
        };

        distribute(x + 1, y, 7/16);
        distribute(x - 1, y + 1, 3/16);
        distribute(x, y + 1, 5/16);
        distribute(x + 1, y + 1, 1/16);
      }
    }
  } else {
    // No dither or Full Color
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const a = data[i + 3];
        if (a < 128) continue;
        
        let r, g, b;
        if (paletteSize > 0) {
          const closest = findClosestPaletteColor([data[i], data[i+1], data[i+2], a], palette);
          r = closest[0]; g = closest[1]; b = closest[2];
        } else {
          // Full color mode
          r = data[i]; g = data[i+1]; b = data[i+2];
        }
        
        const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        grid[y][x] = hex;
      }
    }
  }

  return grid;
};

export const getAnchorPoint = (w: number, h: number, anchor: AnchorType): { x: number, y: number } => {
  switch (anchor) {
    case AnchorType.TOP_LEFT: return { x: 0, y: 0 };
    case AnchorType.TOP_CENTER: return { x: Math.floor(w / 2), y: 0 };
    case AnchorType.TOP_RIGHT: return { x: w, y: 0 };
    case AnchorType.MIDDLE_LEFT: return { x: 0, y: Math.floor(h / 2) };
    case AnchorType.CENTER: return { x: Math.floor(w / 2), y: Math.floor(h / 2) };
    case AnchorType.MIDDLE_RIGHT: return { x: w, y: Math.floor(h / 2) };
    case AnchorType.BOTTOM_LEFT: return { x: 0, y: h };
    case AnchorType.BOTTOM_CENTER: return { x: Math.floor(w / 2), y: h };
    case AnchorType.BOTTOM_RIGHT: return { x: w, y: h };
    default: return { x: 0, y: 0 };
  }
};

export const resizeGridFix = (
  oldGrid: string[][],
  newW: number,
  newH: number,
  anchor: AnchorType
): string[][] => {
  const oldW = oldGrid[0].length;
  const oldH = oldGrid.length;
  const newGrid = createEmptyGrid(newW, newH);

  const oldA = getAnchorPoint(oldW, oldH, anchor);
  const newA = getAnchorPoint(newW, newH, anchor);

  const dx = newA.x - oldA.x;
  const dy = newA.y - oldA.y;

  for (let y = 0; y < oldH; y++) {
    for (let x = 0; x < oldW; x++) {
      const targetX = x + dx;
      const targetY = y + dy;
      if (targetX >= 0 && targetX < newW && targetY >= 0 && targetY < newH) {
        newGrid[targetY][targetX] = oldGrid[y][x];
      }
    }
  }
  return newGrid;
};

export const resizeGridRescale = (
  oldGrid: string[][],
  newW: number,
  newH: number
): string[][] => {
  const oldW = oldGrid[0].length;
  const oldH = oldGrid.length;
  const newGrid = createEmptyGrid(newW, newH);

  const sx = oldW / newW;
  const sy = oldH / newH;

  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      const oldX = Math.floor(x * sx);
      const oldY = Math.floor(y * sy);
      if (oldX < oldW && oldY < oldH) {
        newGrid[y][x] = oldGrid[oldY][oldX];
      }
    }
  }
  return newGrid;
};

export const floodFill = (
  grid: string[][],
  x: number,
  y: number,
  targetColor: string,
  replacementColor: string
): string[][] => {
  if (targetColor === replacementColor) return grid;
  
  const newGrid = grid.map(row => [...row]);
  const width = grid[0].length;
  const height = grid.length;
  const stack: [number, number][] = [[x, y]];

  while (stack.length > 0) {
    const [currX, currY] = stack.pop()!;
    if (
      currX < 0 || currX >= width || 
      currY < 0 || currY >= height || 
      newGrid[currY][currX] !== targetColor
    ) continue;

    newGrid[currY][currX] = replacementColor;
    stack.push([currX + 1, currY], [currX - 1, currY], [currX, currY + 1], [currX, currY - 1]);
  }
  return newGrid;
};

/**
 * Grids global color replacement
 */
export const globalReplaceColor = (
  grid: string[][],
  targetColor: string,
  replacementColor: string
): string[][] => {
  return grid.map(row => 
    row.map(cell => cell === targetColor ? replacementColor : cell)
  );
};

export const generateSVG = (grid: string[][], size: number): string => {
  let rects = '';
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const color = grid[y][x];
      if (color !== 'transparent') {
        rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}" />`;
      }
    }
  }
  return `
    <svg viewBox="0 0 ${grid[0].length} ${grid.length}" width="${grid[0].length * 10}" height="${grid.length * 10}" xmlns="http://www.w3.org/2000/svg">
      ${rects}
    </svg>
  `.trim();
};

export const gridToCanvas = (grid: string[][], scale: number = 1): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const width = grid[0].length;
  const height = grid.length;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  grid.forEach((row, y) => {
    row.forEach((color, x) => {
      if (color !== 'transparent') {
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    });
  });
  return canvas;
};
