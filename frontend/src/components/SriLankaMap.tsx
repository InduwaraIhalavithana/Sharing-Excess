/**
 * Stylised outline of Sri Lanka with pulsing markers on the main towns.
 * Pure SVG: the outline is built from approximate coastline coordinates (lon, lat)
 * and smoothed with a Catmull-Rom spline, so there is no image to download.
 */

type LonLat = [number, number];

// Approximate coastline, clockwise from Point Pedro in the far north.
const COAST: LonLat[] = [
  [80.23, 9.83], [80.45, 9.62], [80.72, 9.38], [80.82, 9.27], [81.0, 8.93], [81.23, 8.57],
  [81.35, 8.25], [81.55, 7.95], [81.7, 7.72], [81.82, 7.42], [81.85, 7.1], [81.83, 6.88],
  [81.62, 6.5], [81.31, 6.2], [81.12, 6.1], [80.8, 6.0], [80.59, 5.92], [80.3, 6.0],
  [80.2, 6.03], [80.03, 6.4], [79.88, 6.7], [79.85, 6.93], [79.84, 7.2], [79.8, 7.58],
  [79.83, 8.03], [79.75, 8.3], [79.93, 8.7], [79.9, 8.98], [79.72, 9.1], [80.05, 9.35],
  [80.2, 9.5], [80.0, 9.7], [80.1, 9.8],
];

const TOWNS: { name: string; at: LonLat; delay: number }[] = [
  { name: 'Jaffna', at: [80.0, 9.66], delay: 0 },
  { name: 'Anuradhapura', at: [80.4, 8.35], delay: 0.5 },
  { name: 'Trincomalee', at: [81.22, 8.57], delay: 1.0 },
  { name: 'Kandy', at: [80.63, 7.29], delay: 1.5 },
  { name: 'Batticaloa', at: [81.69, 7.72], delay: 0.8 },
  { name: 'Colombo', at: [79.86, 6.93], delay: 0.3 },
  { name: 'Ratnapura', at: [80.4, 6.68], delay: 1.2 },
  { name: 'Galle', at: [80.22, 6.03], delay: 0.6 },
  { name: 'Hambantota', at: [81.12, 6.12], delay: 1.4 },
];

const MIN_LON = 79.45;
const MAX_LAT = 10.0;
const SCALE = 110; // svg units per degree
const W = Math.round((82.0 - MIN_LON) * SCALE);
const H = Math.round((MAX_LAT - 5.75) * SCALE);

const project = ([lon, lat]: LonLat): [number, number] => [(lon - MIN_LON) * SCALE, (MAX_LAT - lat) * SCALE];

/** Closed Catmull-Rom spline through the points, as cubic Bezier segments. */
function smoothClosedPath(points: [number, number][]): string {
  const n = points.length;
  const p = (i: number) => points[(i + n) % n];
  let d = `M${p(0)[0].toFixed(1)} ${p(0)[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + ' Z';
}

const OUTLINE = smoothClosedPath(COAST.map(project));

export default function SriLankaMap({ label }: { label: string }) {
  return (
    <svg className="sl-map" viewBox={`-20 -20 ${W + 40} ${H + 40}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id="sl-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22c55e" stopOpacity=".55" />
          <stop offset="1" stopColor="#0d9488" stopOpacity=".35" />
        </linearGradient>
        <filter id="sl-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path className="sl-map__shape" d={OUTLINE} fill="url(#sl-fill)" stroke="#86efac" strokeWidth="2.5" strokeLinejoin="round" filter="url(#sl-glow)" />
      {TOWNS.map(({ name, at, delay }) => {
        const [x, y] = project(at);
        return (
          <g key={name} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
            <circle className="sl-map__pulse" r="7" fill="#fbbf24" style={{ animationDelay: `${delay}s` }} />
            <circle r="4.5" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
          </g>
        );
      })}
    </svg>
  );
}
