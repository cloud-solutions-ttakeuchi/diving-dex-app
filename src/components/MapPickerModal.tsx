import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { X, Check, Search, Loader2, MapPin } from 'lucide-react';
import clsx from 'clsx';

const libraries: ("places" | "geometry")[] = ["places"];

interface MapPickerModalProps {
  initialLat?: string;
  initialLng?: string;
  initialSearchQuery?: string;
  onConfirm: (lat: string, lng: string, placeId?: string, address?: string) => void;
  onClose: () => void;
}

export const MapPickerModal: React.FC<MapPickerModalProps> = ({
  initialLat,
  initialLng,
  initialSearchQuery,
  onConfirm,
  onClose
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || '';

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries,
    language: 'ja'
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedPos, setSelectedPos] = useState<{ lat: number, lng: number } | null>(
    initialLat && initialLng ? { lat: Number(initialLat), lng: Number(initialLng) } : null
  );
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>();
  const [formattedAddress, setFormattedAddress] = useState<string | undefined>();

  // Custom Search State
  const [searchText, setSearchText] = useState(initialSearchQuery || '');
  const [searchResults, setSearchResults] = useState<google.maps.places.Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setSelectedPos({ lat, lng });
      setSelectedPlaceId(undefined);
      setFormattedAddress(undefined);
      setShowResults(false);
    }
  };

  const handleTextSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchText.trim() || !window.google || !window.google.maps.places?.Place) return;

    setIsSearching(true);
    setSearchResults([]);
    setShowResults(true);

    try {
      // Use Text Search (New)
      // Reference: https://developers.google.com/maps/documentation/javascript/places#text_search_new
      const request = {
        textQuery: searchText,
        fields: ['id', 'location', 'displayName', 'formattedAddress'],
        isOpenNow: false,
        language: 'ja',
      };

      const { places } = await window.google.maps.places.Place.searchByText(request);

      if (places && places.length > 0) {
        setSearchResults(places);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectPlace = (place: google.maps.places.Place) => {
    const location = place.location;
    const address = place.formattedAddress;
    const placeId = place.id;
    const name = place.displayName;

    if (location) {
      const lat = location.lat();
      const lng = location.lng();

      setSelectedPos({ lat, lng });
      setSelectedPlaceId(placeId);
      setFormattedAddress(address || undefined);

      map?.panTo({ lat, lng });
      map?.setZoom(15);

      setShowResults(false);
      setSearchText(typeof name === 'string' ? name : "");
    }
  };

  const handleConfirm = () => {
    if (selectedPos) {
      onConfirm(
        String(selectedPos.lat),
        String(selectedPos.lng),
        selectedPlaceId,
        formattedAddress
      );
      onClose();
    }
  };

  if (loadError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="text-red-500" />
          </div>
          <h3 className="font-bold text-gray-900 mb-2">Google Maps エラー</h3>
          <p className="text-sm text-gray-500 mb-6">{loadError.message}</p>
          <button onClick={onClose} className="w-full py-3 bg-gray-100 font-bold rounded-xl">
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white w-full max-w-4xl h-[80vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col relative">
        {/* Header / Search Bar */}
        <div className="p-4 bg-white z-10 flex items-center gap-3 border-b border-gray-100 shrink-0 relative">
          <div className="flex-1 relative">
            <form onSubmit={handleTextSearch} className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="場所を検索（例: 伊豆海洋公園）"
                className="w-full pl-10 pr-12 py-3 bg-gray-100 border-2 border-transparent focus:bg-white focus:border-ocean rounded-xl focus:outline-none transition-all font-bold text-gray-900 placeholder-gray-400"
                disabled={!isLoaded}
              />
              <button
                type="submit"
                disabled={!searchText.trim() || isSearching}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </form>

            {/* Manual Search Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto z-50">
                {searchResults.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => selectPlace(place)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors flex items-start gap-3"
                  >
                    <MapPin size={16} className="mt-1 text-gray-400 shrink-0" />
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{place.displayName}</div>
                      <div className="text-xs text-gray-500 truncate">{place.formattedAddress}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showResults && !isSearching && searchResults.length === 0 && searchText && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-4 text-center text-gray-500 text-sm z-50">
                見つかりませんでした
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative bg-gray-50">
          {!isLoaded ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ocean"></div>
              <p className="font-bold text-sm">Google Mapsを読み込んでいます...</p>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={selectedPos || { lat: 35.6812, lng: 139.7671 }} // Default: Tokyo Station
              zoom={selectedPos ? 15 : 5}
              onLoad={onLoad}
              onUnmount={onUnmount}
              onClick={handleMapClick}
              options={{
                disableDefaultUI: false,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                zoomControl: true,
                gestureHandling: 'cooperative',
              }}
            >
              {selectedPos && (
                <Marker position={selectedPos} animation={google.maps.Animation.DROP} />
              )}
            </GoogleMap>
          )}

          {/* Floating Action Button for Confirm */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-10 flex flex-col gap-3">
            {!selectedPos && (
              <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg text-xs font-bold text-gray-500 text-center animate-bounce">
                地図をタップして位置を指定
              </div>
            )}

            <div className="flex gap-2 w-full">
              <button
                onClick={onClose}
                className="flex-1 bg-white hover:bg-gray-50 text-gray-700 py-3.5 rounded-xl font-bold shadow-lg transition-transform active:scale-95 border border-gray-100"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedPos}
                className={clsx(
                  "flex-[2] flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold shadow-lg text-white transition-all transform",
                  selectedPos
                    ? "bg-blue-600 hover:bg-blue-700 active:scale-95 hover:shadow-xl"
                    : "bg-gray-400 cursor-not-allowed opacity-80"
                )}
              >
                <Check size={18} />
                この位置に設定
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
