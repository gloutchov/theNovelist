export interface CanvasPosition {
  x: number;
  y: number;
}

interface NearbyPositionOptions {
  emptyPosition?: CanvasPosition;
  minDistance?: number;
  radiusStep?: number;
  maxRings?: number;
}

function isValidPosition(position: CanvasPosition): boolean {
  return Number.isFinite(position.x) && Number.isFinite(position.y);
}

function distance(left: CanvasPosition, right: CanvasPosition): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return Math.hypot(dx, dy);
}

function roundPosition(position: CanvasPosition): CanvasPosition {
  return {
    x: Math.round(position.x),
    y: Math.round(position.y),
  };
}

export function getNearbyCanvasPosition(
  existingPositions: CanvasPosition[],
  options: NearbyPositionOptions = {},
): CanvasPosition {
  const emptyPosition = options.emptyPosition ?? { x: 120, y: 120 };
  const minDistance = options.minDistance ?? 170;
  const radiusStep = options.radiusStep ?? 130;
  const maxRings = options.maxRings ?? 18;
  const validPositions = existingPositions.filter(isValidPosition);

  if (validPositions.length === 0) {
    return roundPosition(emptyPosition);
  }

  const anchor = validPositions.reduce(
    (accumulator, position) => ({
      x: accumulator.x + position.x,
      y: accumulator.y + position.y,
    }),
    { x: 0, y: 0 },
  );
  anchor.x /= validPositions.length;
  anchor.y /= validPositions.length;

  const anchorRounded = roundPosition(anchor);
  const anchorIsFree = validPositions.every((position) => distance(anchorRounded, position) >= minDistance);
  if (anchorIsFree) {
    return anchorRounded;
  }

  for (let ring = 1; ring <= maxRings; ring += 1) {
    const candidatesInRing = ring * 8;
    const ringRadius = radiusStep * ring;

    for (let index = 0; index < candidatesInRing; index += 1) {
      const angle = (Math.PI * 2 * index) / candidatesInRing;
      const candidate = roundPosition({
        x: anchor.x + Math.cos(angle) * ringRadius,
        y: anchor.y + Math.sin(angle) * ringRadius,
      });
      const hasSpace = validPositions.every((position) => distance(candidate, position) >= minDistance);
      if (hasSpace) {
        return candidate;
      }
    }
  }

  return roundPosition({
    x: anchor.x + radiusStep,
    y: anchor.y + radiusStep,
  });
}
