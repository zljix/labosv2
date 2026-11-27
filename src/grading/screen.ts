import oledFont from './oledFont.json';
import displayData from '../../school/grader/display-oracles.json';
import type { Stage } from './replay';

type Glyphs = Record<string, number[]>;
interface Screen {
  width: number;
  height: number;
  pixel: (x: number, y: number) => number;
  font: Glyphs;
  glyphHeight: number;
}
export function screen(stage: Stage, tft = false): Screen | undefined {
  if (tft) {
    const d = Object.values(stage.frame?.tfts ?? {})[0];
    if (d?.powered && d.on && d.backlight)
      return {
        width: d.width,
        height: d.height,
        pixel: (x, y) => d.pixels[y * d.width + x],
        font: displayData.tftFont,
        glyphHeight: 7
      };
  } else {
    const d = Object.values(stage.frame?.displays ?? {})[0];
    if (d?.on && d.powered)
      return {
        width: 128,
        height: 32,
        pixel: (x, y) => (d.bytes[(y >> 3) * 128 + x] >> y % 8) & 1,
        font: oledFont,
        glyphHeight: 10
      };
  }
}
// Use the visible pixels of the pinned worksheet fonts. The text may move and
// may use either text size supported by the OLED adapter.
export function hasText(d: Screen | undefined, text: string, area?: [number, number, number, number]) {
  if (!d || !text) return false;
  const [left, top, right, bottom] = area ?? [0, 0, d.width, d.height];
  const glyphs = [...text].map((c) => d.font[c]);
  if (glyphs.some((g) => !g)) return false;
  for (const scale of [1, 2]) {
    const points = glyphs.flatMap((g, i) =>
      g.flatMap((bits, col) =>
        Array.from({ length: d.glyphHeight }, (_, row) => ({
          x: (i * 6 + col) * scale,
          y: row * scale,
          ink: !!(bits & (1 << row))
        }))
      )
    );
    const first = points.find((p) => p.ink),
      empty = points.find((p) => !p.ink);
    if (!first || !empty) continue;
    const xMax = Math.max(...points.map((p) => p.x)),
      yMax = Math.max(...points.filter((p) => p.ink).map((p) => p.y));
    for (let y = top; y + yMax < bottom; y++)
      for (let x = left; x + xMax < right; x++) {
        const ink = d.pixel(x + first.x, y + first.y),
          background = d.pixel(x + empty.x, y + empty.y);
        if (ink === background) continue;
        if (
          points.every((p) => y + p.y >= bottom || d.pixel(x + p.x, y + p.y) === (p.ink ? ink : background))
        )
          return true;
      }
  }
  return false;
}
export function bottomBar(d: Screen | undefined) {
  if (!d) return;
  for (let y = 20; y < 31; y++) {
    for (let x = 0; x < 90; x++) {
      if (!d.pixel(x, y)) continue;
      let right = x;
      while (right < d.width && d.pixel(right, y)) right++;
      if (right - x >= 40)
        for (let bottom = y + 2; bottom < 32; bottom++) {
          if (!d.pixel(x, bottom) || !d.pixel(right - 1, bottom)) continue;
          let columns = 0,
            closed = true;
          for (let col = x; col < right; col++) {
            if (!d.pixel(col, bottom)) closed = false;
            if (d.pixel(col, y + 1)) columns++;
          }
          if (closed && columns >= 2) return { width: right - x, fill: columns - 2 };
        }
      x = right;
    }
  }
}
