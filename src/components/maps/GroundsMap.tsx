"use client";

import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import "leaflet/dist/leaflet.css";

const pinIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const userIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export interface MapGround {
  id: string;
  name: string;
  city: string;
  hourlyRate: number;
  category: string;
  avgRating: number | null;
  lat: number;
  lng: number;
}

interface Props {
  grounds: MapGround[];
  userLat?: number;
  userLng?: number;
  radiusKm?: number;
}

export default function GroundsMap({ grounds, userLat, userLng, radiusKm }: Props) {
  const center: [number, number] =
    userLat && userLng
      ? [userLat, userLng]
      : grounds.length > 0
      ? [grounds[0].lat, grounds[0].lng]
      : [7.8731, 80.7718]; // Sri Lanka center fallback

  return (
    <MapContainer
      center={center}
      zoom={userLat ? 12 : 8}
      style={{ height: "520px", width: "100%", borderRadius: "16px" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {userLat && userLng && (
        <>
          <Marker position={[userLat, userLng]} icon={userIcon}>
            <Popup>Your location</Popup>
          </Marker>
          {radiusKm && (
            <Circle
              center={[userLat, userLng]}
              radius={radiusKm * 1000}
              pathOptions={{ color: "#22c55e", fillOpacity: 0.05, weight: 1.5 }}
            />
          )}
        </>
      )}

      {grounds.map((g) => (
        <Marker key={g.id} position={[g.lat, g.lng]} icon={pinIcon}>
          <Popup>
            <div style={{ minWidth: 160 }}>
              <p style={{ fontWeight: 600, margin: "0 0 4px" }}>{g.name}</p>
              <p style={{ margin: "0 0 4px", fontSize: 12, color: "#64748b" }}>
                {g.city} · {g.category}
              </p>
              <p style={{ margin: "0 0 8px", fontWeight: 600, color: "#16a34a" }}>
                Rs. {g.hourlyRate.toLocaleString()}/hr
              </p>
              {g.avgRating && (
                <p style={{ margin: "0 0 8px", fontSize: 12 }}>⭐ {g.avgRating}</p>
              )}
              <a
                href={`/grounds/${g.id}`}
                style={{
                  display: "inline-block",
                  background: "#16a34a",
                  color: "white",
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  textDecoration: "none",
                }}
              >
                View Ground
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
