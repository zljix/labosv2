export const defaultScale = [50, 65, 80, 90];
export function proposedGrade(points: number, max: number, thresholds: number[]) {
  return 1 + thresholds.filter((t) => points * 100 >= t * max).length;
}
