import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { locate } from '../data/sriLankaPlaces';
import { Link } from 'react-router-dom';
import type { Listing } from '../types/api';
import { qty } from '../utils/format';

interface Props {
  listings: Listing[];
}

const SRI_LANKA: [number, number] = [7.8731, 80.7718];

/** Emoji pin with a count badge - a divIcon avoids Leaflet's default-icon asset problems under Vite. */
function pin(count: number) {
  return L.divIcon({
    className: 'se-pin',
    html: `<span class="se-pin__body">🍽️</span>${count > 1 ? `<span class="se-pin__count">${count}</span>` : ''}`,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -34],
  });
}

function FitToMarkers({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 10);
    else map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 10 });
  }, [map, points]);
  return null;
}

export default function FoodMap({ listings }: Props) {
  // Group listings by the town they mention, so several in Colombo make one pin with a count
  const { groups } = useMemo(() => {
    const byPlace = new Map<string, { name: string; lat: number; lng: number; items: Listing[] }>();
    for (const l of listings) {
      const place = locate(l.area) ?? locate(l.district);
      if (!place) continue;   // every listing has a district, which is always a known place
      const g = byPlace.get(place.name) ?? { ...place, items: [] };
      g.items.push(l);
      byPlace.set(place.name, g);
    }
    return { groups: [...byPlace.values()] };
  }, [listings]);

  const points = useMemo<[number, number][]>(() => groups.map((g) => [g.lat, g.lng]), [groups]);

  return (
    <div className="fd-map-wrap">
      <MapContainer center={SRI_LANKA} zoom={7} scrollWheelZoom className="fd-map" aria-label="Map of available food">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToMarkers points={points} />
        {groups.map((g) => (
          <Marker key={g.name} position={[g.lat, g.lng]} icon={pin(g.items.length)}>
            <Popup>
              <strong className="fd-map__place">📍 {g.name}</strong>
              <ul className="fd-map__list">
                {g.items.map((l) => (
                  <li key={l.id}>
                    <Link to={`/listings/${l.id}`}><b>{l.food_name}</b></Link> · {qty(l.quantity_available)} {l.unit}
                    <div className="fd-map__where">{l.area ?? l.district}</div>
                  </li>
                ))}
              </ul>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
