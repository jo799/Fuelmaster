import { pool } from "../db/pool.js";

export interface StrappingPoint {
  heightMm: number;
  volumeL: number;
}

/**
 * Converts a raw probe height reading to volume for a specific tank.
 *
 * If the tank has real strapping points on file (entered once by a
 * technician from the tank manufacturer's calibration certificate), this
 * linearly interpolates between the two nearest calibrated points \u2014 the
 * standard approach real fuel-measurement systems use, since a strapping
 * table is itself just a dense set of interpolation anchors.
 *
 * Without any strapping points, this falls back to treating the tank as a
 * horizontal cylinder (by far the most common shape for underground/
 * aboveground fuel storage tanks) using the tank's capacity and an assumed
 * height to back out an approximate diameter, then integrating the
 * circular cross-section at the given fill height. This is a genuine
 * geometric model \u2014 not a straight-line approximation \u2014 which matters
 * because a horizontal cylinder's volume is very much *not* linear with
 * height (the same height change near empty/full corresponds to much less
 * volume than the same change near the middle). It's still an
 * approximation without the tank's real dimensions, but it's a
 * substantially better one than assuming volume scales linearly with
 * height, and it's clearly a fallback, not a substitute for a real
 * strapping table.
 */
export async function heightToVolume(tankId: number, heightMm: number): Promise<number> {
  const { rows: points } = await pool.query(
    `SELECT height_mm::float AS "heightMm", volume_l::float AS "volumeL"
     FROM tank_strapping_points WHERE tank_id = $1 ORDER BY height_mm`,
    [tankId]
  );

  if (points.length >= 2) {
    return interpolate(points, heightMm);
  }

  const tankRow = await pool.query(`SELECT capacity_l::float AS "capacityL" FROM tanks WHERE id = $1`, [tankId]);
  const capacityL = tankRow.rows[0]?.capacityL ?? 0;
  return cylindricalFallback(capacityL, heightMm);
}

export function interpolate(points: StrappingPoint[], heightMm: number): number {
  const sorted = [...points].sort((a, b) => a.heightMm - b.heightMm);

  if (heightMm <= sorted[0].heightMm) return sorted[0].volumeL;
  if (heightMm >= sorted[sorted.length - 1].heightMm) return sorted[sorted.length - 1].volumeL;

  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (heightMm >= lo.heightMm && heightMm <= hi.heightMm) {
      const fraction = (heightMm - lo.heightMm) / (hi.heightMm - lo.heightMm);
      return lo.volumeL + fraction * (hi.volumeL - lo.volumeL);
    }
  }
  return sorted[sorted.length - 1].volumeL;
}

/**
 * Horizontal-cylinder approximation. Assumes a standard ~1.8m (1800mm)
 * diameter for a typical forecourt storage tank to back out an implied
 * length from capacity, then computes the wetted cross-sectional area at
 * the given fill height via the standard circular-segment area formula,
 * scaled by that length. This is a real geometric model, but the 1800mm
 * assumed diameter is a placeholder until the tank's actual dimensions (or
 * a real strapping table) are on file \u2014 flagged clearly as an assumption
 * wherever this fallback is used in the UI.
 */
export function cylindricalFallback(capacityL: number, heightMm: number): number {
  if (capacityL <= 0) return 0;
  const assumedDiameterMm = 1800;
  const radiusMm = assumedDiameterMm / 2;
  const fullHeightMm = assumedDiameterMm;
  const h = Math.max(0, Math.min(heightMm, fullHeightMm));

  // Circular segment area for fill height h in a circle of radius r:
  // A(h) = r^2 * acos((r-h)/r) - (r-h) * sqrt(2*r*h - h^2)
  const rMinusH = radiusMm - h;
  const areaMm2 =
    radiusMm * radiusMm * Math.acos(rMinusH / radiusMm) - rMinusH * Math.sqrt(Math.max(0, 2 * radiusMm * h - h * h));
  const fullAreaMm2 = Math.PI * radiusMm * radiusMm;
  const fillFraction = fullAreaMm2 > 0 ? areaMm2 / fullAreaMm2 : 0;

  return Math.round(capacityL * fillFraction * 100) / 100;
}

/**
 * Inverse of cylindricalFallback: given a target volume, finds the height
 * that produces it under the same geometric model, via binary search since
 * the circular-segment formula doesn't invert in closed form. Used so the
 * mock driver's synthetic height reading stays geometrically consistent
 * with whatever volume it's independently simulating, rather than the two
 * numbers drifting apart in a way a real gauge never would.
 */
export function volumeToHeightApprox(capacityL: number, volumeL: number): number {
  if (capacityL <= 0) return 0;
  const assumedDiameterMm = 1800;
  let lo = 0;
  let hi = assumedDiameterMm;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const v = cylindricalFallback(capacityL, mid);
    if (v < volumeL) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 10) / 10;
}