import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { X, Check } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapPickerModalProps {
  initialLat?: string;
  initialLng?: string;
  onConfirm: (lat: string, lng: string) => void;
  onClose: () => void;
}

const LocationMarker = ({ position, setPosition }: { position: L.LatLng | null, setPosition: (pos: L.LatLng) => void }) => {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
};

export const MapPickerModal: React.FC<MapPickerModalProps> = ({ initialLat, initialLng, onConfirm, onClose }) => {
  const [position, setPosition] = useState<L.LatLng | null>(
    initialLat && initialLng ? new L.LatLng(Number(initialLat), Number(initialLng)) : null
  );

  // Default center (Okinawa)
  const defaultCenter = { lat: 26.5, lng: 127.9 };
  const center = position || defaultCenter;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white z-10">
          <h3 className="font-bold text-gray-900">地図から位置を選択</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative">
          <MapContainer
            center={center}
            zoom={initialLat ? 13 : 9}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker position={position} setPosition={setPosition} />
          </MapContainer>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg text-sm font-medium text-gray-700 pointer-events-none">
            {position ? 'OKボタンで位置を確定' : '地図をタップして位置を指定'}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-white z-10">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={() => {
              if (position) {
                onConfirm(position.lat.toFixed(6), position.lng.toFixed(6));
              } else {
                alert('地図をタップして位置を指定してください');
              }
            }}
            // disabled={!position}
            className="px-6 py-2.5 rounded-xl font-bold text-white bg-ocean-600 hover:bg-ocean-700 transition-colors shadow-lg shadow-ocean-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={18} />
            この位置に設定
          </button>
        </div>
      </div>
    </div>
  );
};
