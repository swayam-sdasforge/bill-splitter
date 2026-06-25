'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix for default marker icons in Next.js / Leaflet
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

const customIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

type ExpenseWithLocation = {
  id: string;
  amount: number;
  description: string;
  lat: number;
  lng: number;
  location_name?: string;
  group_name?: string;
};

export default function MapComponent({ expenses }: { expenses: ExpenseWithLocation[] }) {
  // Center map on the first expense or default to a generic oceanic center
  const center: [number, number] = expenses.length > 0 && expenses[0].lat && expenses[0].lng 
    ? [expenses[0].lat, expenses[0].lng] 
    : [20, 0];

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border-4 border-outline-variant/30 shadow-lg relative z-0">
      <MapContainer center={center} zoom={3} className="w-full h-full min-h-[60vh] z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {expenses.map((exp) => (
          <Marker key={exp.id} position={[exp.lat, exp.lng]} icon={customIcon}>
            <Popup className="font-body">
              <div className="flex flex-col gap-1 p-1">
                <span className="font-bold text-primary-container uppercase tracking-wider text-[10px]">
                  {exp.group_name || 'Voyage'}
                </span>
                <span className="font-bold text-on-surface text-sm">{exp.description}</span>
                <span className="font-display font-bold text-secondary text-lg">
                  ₹{Number(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                {exp.location_name && (
                  <span className="text-[10px] text-on-surface-variant font-mono mt-1">
                    📍 {exp.location_name}
                  </span>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
