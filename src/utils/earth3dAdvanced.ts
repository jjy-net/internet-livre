// ============================================================================
// JJY · GLOBO 3D — RECURSOS AVANÇADOS (funções puras, 100% offline)
// ----------------------------------------------------------------------------
// Matemática usada pelo Earth3dMapView para: projeção inversa (tela -> lat/lon),
// terminador dia/noite real, localizador Maidenhead, anéis de alcance, rumo,
// horário solar e recorte de polígonos no limbo do planeta.
// A convenção de câmera é a mesma do project3D do componente:
//   x' = cosφ·sin(λ − rotY)
//   y' = sinφ·cos(rotX) − cosφ·cos(λ − rotY)·sin(rotX)
//   z' = sinφ·sin(rotX) + cosφ·cos(λ − rotY)·cos(rotX)   (z' > 0 = face visível)
// ============================================================================

const DEG = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

export interface LatLon {
  lat: number;
  lon: number;
}

export type Vec3 = [number, number, number];

export const normalizeLon = (lon: number): number => ((((lon + 180) % 360) + 360) % 360) - 180;

/** Vetor unitário de um ponto geográfico no espaço da câmera. */
export function viewVector(lat: number, lon: number, rotX: number, rotY: number): Vec3 {
  const phi = lat * DEG;
  const dl = lon * DEG - rotY;
  const px = Math.cos(phi) * Math.sin(dl);
  const py = Math.sin(phi);
  const pz = Math.cos(phi) * Math.cos(dl);
  return [px, py * Math.cos(rotX) - pz * Math.sin(rotX), py * Math.sin(rotX) + pz * Math.cos(rotX)];
}

/** Projeção inversa: pixel da tela -> latitude/longitude (null se fora do planeta). */
export function unproject(
  x: number,
  y: number,
  cx: number,
  cy: number,
  radius: number,
  rotX: number,
  rotY: number
): LatLon | null {
  const nx = (x - cx) / radius;
  const ny = (cy - y) / radius;
  const r2 = nx * nx + ny * ny;
  if (r2 > 1) return null;
  const nz = Math.sqrt(1 - r2);
  const py = ny * Math.cos(rotX) + nz * Math.sin(rotX);
  const pz = -ny * Math.sin(rotX) + nz * Math.cos(rotX);
  const lat = Math.asin(Math.max(-1, Math.min(1, py))) / DEG;
  const lon = normalizeLon((rotY + Math.atan2(nx, pz)) / DEG);
  return { lat, lon };
}

/**
 * Projeta um vértice de polígono; se estiver na face oculta, encosta-o na borda
 * do disco. Isso evita os continentes "rasgados" quando cruzam o horizonte.
 */
export function projectClampedToLimb(
  lat: number,
  lon: number,
  cx: number,
  cy: number,
  radius: number,
  rotX: number,
  rotY: number
): { x: number; y: number; front: boolean } {
  const [vx, vy, vz] = viewVector(lat, lon, rotX, rotY);
  if (vz >= 0) return { x: cx + vx * radius, y: cy - vy * radius, front: true };
  const len = Math.hypot(vx, vy) || 1;
  return { x: cx + (vx / len) * radius, y: cy - (vy / len) * radius, front: false };
}

/** Localizador Maidenhead (QTH locator) de 6 caracteres, ex.: GG66gk. */
export function toMaidenhead(lat: number, lon: number): string {
  const lo = Math.min(359.999999, Math.max(0, normalizeLon(lon) + 180));
  const la = Math.min(179.999999, Math.max(0, lat + 90));
  const A = 'A'.charCodeAt(0);
  const a = 'a'.charCodeAt(0);
  return (
    String.fromCharCode(A + Math.floor(lo / 20)) +
    String.fromCharCode(A + Math.floor(la / 10)) +
    Math.floor((lo % 20) / 2) +
    Math.floor(la % 10) +
    String.fromCharCode(a + Math.floor(((lo % 2) * 60) / 5)) +
    String.fromCharCode(a + Math.floor(((la % 1) * 60) / 2.5))
  );
}

/** Nome do campo Maidenhead (2 letras) a partir do canto sudoeste. */
export function maidenheadField(lat: number, lon: number): string {
  return toMaidenhead(lat + 0.001, lon + 0.001).slice(0, 2);
}

/** Rumo inicial (azimute verdadeiro, 0-360°) de A para B pelo círculo máximo. */
export function initialBearing(a: LatLon, b: LatLon): number {
  const p1 = a.lat * DEG;
  const p2 = b.lat * DEG;
  const dl = (b.lon - a.lon) * DEG;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

export function greatCircleDistanceKm(a: LatLon, b: LatLon): number {
  const p1 = a.lat * DEG;
  const p2 = b.lat * DEG;
  const dp = p2 - p1;
  const dl = (b.lon - a.lon) * DEG;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ponto de destino a partir de origem, rumo e distância (círculo máximo). */
export function destinationPoint(origin: LatLon, bearingDeg: number, distanceKm: number): LatLon {
  const d = distanceKm / EARTH_RADIUS_KM;
  const b = bearingDeg * DEG;
  const p1 = origin.lat * DEG;
  const l1 = origin.lon * DEG;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: p2 / DEG, lon: normalizeLon(l2 / DEG) };
}

/** Elevação do Sol (graus acima do horizonte) num ponto, dado o ponto subsolar. */
export function sunElevationDeg(point: LatLon, subsolar: LatLon): number {
  const p1 = point.lat * DEG;
  const p2 = subsolar.lat * DEG;
  const cosZenith =
    Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos((point.lon - subsolar.lon) * DEG);
  return Math.asin(Math.max(-1, Math.min(1, cosZenith))) / DEG;
}

/** Fase do dia em linguagem simples, a partir da elevação solar. */
export function dayPhaseLabel(elevationDeg: number): string {
  if (elevationDeg > 6) return 'Dia';
  if (elevationDeg > -0.8) return 'Hora dourada';
  if (elevationDeg > -6) return 'Crepúsculo';
  if (elevationDeg > -18) return 'Anoitecer';
  return 'Noite';
}

/** Hora solar local aproximada (HH:MM) pela longitude. */
export function localSolarTime(date: Date, lon: number): string {
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes();
  const m = Math.round((((utcMin + normalizeLon(lon) * 4) % 1440) + 1440) % 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function formatLatLon(p: LatLon): string {
  const la = `${Math.abs(p.lat).toFixed(2)}°${p.lat >= 0 ? 'N' : 'S'}`;
  const lo = `${Math.abs(p.lon).toFixed(2)}°${p.lon >= 0 ? 'E' : 'W'}`;
  return `${la} ${lo}`;
}

const COMPASS_16 = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
export const compassPoint = (bearingDeg: number): string => COMPASS_16[Math.round((((bearingDeg % 360) + 360) % 360) / 22.5) % 16];

/**
 * Sombreador do terminador dia/noite. Calcula, por pixel de uma textura pequena,
 * o cosseno do ângulo zenital solar na esfera vista de frente e pinta a noite
 * com transição suave + faixa quente do crepúsculo ("grey line" do rádio HF).
 */
export interface TerminatorShader {
  draw: (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    sun: Vec3,
    strength: number,
    tint: [number, number, number]
  ) => void;
}

export function createTerminatorShader(size: number = 128): TerminatorShader | null {
  if (typeof document === 'undefined') return null;
  const buffer = document.createElement('canvas');
  buffer.width = size;
  buffer.height = size;
  const bctx = buffer.getContext('2d');
  if (!bctx) return null;
  const image = bctx.createImageData(size, size);
  const data = image.data;

  return {
    draw(ctx, cx, cy, radius, sun, strength, tint) {
      const [sx, sy, sz] = sun;
      let o = 0;
      for (let j = 0; j < size; j++) {
        const ny = 1 - ((j + 0.5) / size) * 2;
        for (let i = 0; i < size; i++, o += 4) {
          const nx = ((i + 0.5) / size) * 2 - 1;
          const r2 = nx * nx + ny * ny;
          if (r2 > 1.02) {
            data[o + 3] = 0;
            continue;
          }
          const nz = Math.sqrt(Math.max(0, 1 - r2));
          const d = nx * sx + ny * sy + nz * sz;
          // noite: 0 (dia) -> 1 (noite plena) entre +0.08 e -0.22
          let night = (0.08 - d) / 0.3;
          night = night < 0 ? 0 : night > 1 ? 1 : night;
          night = night * night * (3 - 2 * night);
          // faixa do crepúsculo centrada no terminador
          const dusk = Math.exp(-((d + 0.03) * (d + 0.03)) / 0.0022);
          const warm = dusk * 0.5;
          data[o] = tint[0] + (255 - tint[0]) * warm;
          data[o + 1] = tint[1] + (120 - tint[1]) * warm;
          data[o + 2] = tint[2] + (50 - tint[2]) * warm;
          data[o + 3] = Math.min(255, (night * strength + dusk * 0.07) * 255);
        }
      }
      bctx.putImageData(image, 0, 0);
      const smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(buffer, cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.imageSmoothingEnabled = smooth;
    },
  };
}

/** Raios de alcance típicos (km) para os anéis ao redor de uma estação. */
export const RANGE_RINGS_KM: { km: number; label: string }[] = [
  { km: 500, label: '500 km · VHF tropo / NVIS' },
  { km: 1500, label: '1.500 km · HF 1 salto' },
  { km: 3000, label: '3.000 km · HF 2 saltos' },
];
