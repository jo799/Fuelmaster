import { useId } from "react";

const PRODUCT_COLOR: Record<string, string> = {
  Petrol: "#f9a826",
  Diesel: "#17c964",
  Kerosene: "#a78bfa",
  LPG: "#38bdf8",
};

export default function TankCylinder({
  product,
  percent,
  size = 96,
  showLabels = false,
}: {
  product: string;
  percent: number;
  size?: number;
  showLabels?: boolean;
}) {
  const uid = useId();
  const color = PRODUCT_COLOR[product] ?? "#8b98a5";
  // A real "battery" silhouette needs room above the body for the terminal
  // nub, so the overall height is proportioned taller than the old plain
  // rounded-rect version.
  const bodyWidth = size;
  const nubWidth = size * 0.34;
  const nubHeight = size * 0.09;
  const bodyHeight = size * 1.5;
  const totalHeight = bodyHeight + nubHeight;

  const clampedPercent = Math.min(100, Math.max(0, percent));
  const fillableHeight = bodyHeight - 10;
  const fillHeight = (clampedPercent / 100) * fillableHeight;
  const bodyRx = bodyWidth / 2.6; // large radius = capsule silhouette, not a plain rounded rect

  const bodyGradId = `tank-body-${uid}`;
  const fillGradId = `tank-fill-${uid}`;
  const glossGradId = `tank-gloss-${uid}`;
  const clipId = `tank-clip-${uid}`;
  const labelGutter = showLabels ? 34 : 0;
  const totalWidth = bodyWidth + labelGutter;
  const nubX = labelGutter + (bodyWidth - nubWidth) / 2;

  return (
    <svg width={totalWidth} height={totalHeight} viewBox={`0 0 ${totalWidth} ${totalHeight}`}>
      <defs>
        <linearGradient id={bodyGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0a141d" />
          <stop offset="45%" stopColor="#1c2e3c" />
          <stop offset="55%" stopColor="#1c2e3c" />
          <stop offset="100%" stopColor="#0a141d" />
        </linearGradient>
        <linearGradient id={fillGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity={0.5} />
          <stop offset="45%" stopColor={color} stopOpacity={1} />
          <stop offset="55%" stopColor={color} stopOpacity={1} />
          <stop offset="100%" stopColor={color} stopOpacity={0.5} />
        </linearGradient>
        {/* A brighter, sharper highlight streak down one side \u2014 this is
            what actually reads as "glossy/3D" rather than a flat fill. */}
        <linearGradient id={glossGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="18%" stopColor="#ffffff" stopOpacity={0.3} />
          <stop offset="32%" stopColor="#ffffff" stopOpacity={0.05} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
      </defs>

      {showLabels && (
        <g>
          {[100, 75, 50, 25, 0].map((tick) => {
            const y = nubHeight + bodyHeight - 4 - (tick / 100) * fillableHeight;
            return (
              <text key={tick} x={0} y={y + 3} fontSize={9} fill="var(--chart-tick)" fontFamily="var(--font-mono)">
                {tick}%
              </text>
            );
          })}
        </g>
      )}

      {/* Terminal nub \u2014 the small protrusion at the top that's what
          actually makes this read as a "battery/gauge" silhouette instead
          of a plain rounded rectangle. */}
      <rect x={nubX} y={0} width={nubWidth} height={nubHeight + 6} rx={nubWidth * 0.3} fill={`url(#${bodyGradId})`} stroke="rgba(255,255,255,0.08)" />

      <g transform={`translate(${labelGutter}, ${nubHeight})`}>
        <rect x={2} y={2} width={bodyWidth - 4} height={bodyHeight - 4} rx={bodyRx} fill={`url(#${bodyGradId})`} stroke="rgba(255,255,255,0.1)" />
        <clipPath id={clipId}>
          <rect x={2} y={2} width={bodyWidth - 4} height={bodyHeight - 4} rx={bodyRx} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          <rect x={2} y={bodyHeight - 4 - fillHeight} width={bodyWidth - 4} height={fillHeight} fill={`url(#${fillGradId})`} />
          <rect x={2} y={2} width={bodyWidth - 4} height={bodyHeight - 4} fill={`url(#${glossGradId})`} />
        </g>
        {[0, 25, 50, 75, 100].map((tick) => (
          <line
            key={tick}
            x1={2}
            x2={9}
            y1={bodyHeight - 4 - (tick / 100) * fillableHeight}
            y2={bodyHeight - 4 - (tick / 100) * fillableHeight}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={1}
          />
        ))}
      </g>
    </svg>
  );
}