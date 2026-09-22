import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Pencil, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import SatelliteMap from "../components/farm/SatelliteMap";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useGeolocation } from "../hooks/useGeolocation";

// ⚠️ REPLACE WITH YOUR REAL TOKEN
const MAPBOX_TOKEN = "pk.eyJ1IjoicmF2aXByYWthc2gtYyIsImEiOiJjbXU3ZXNvN3owa2M1MnpzOW8weWI2cG8xIn0.ufdZweuqJFF1DYOumoGRtg";

type FarmPolygonGeometry = {
  type: "Polygon";
  coordinates: [number, number][][];
};

type FarmLocationData = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  boundary: FarmPolygonGeometry | null;
  selectedPlotId?: string;
  source: "gps-pin" | "drawn" | "cadastral-select";
};

export default function FarmLocationPage() {
  const navigate = useNavigate();
  const [farmProfile, setFarmProfile] = useState<any>(null);
  
  const { 
    latitude, 
    longitude, 
    accuracy, 
    loading: geoLoading, 
    error: geoError, 
    getCurrentLocation 
  } = useGeolocation();

  const [mapMode, setMapMode] = useState<"drop-pin" | "draw">("drop-pin");
  const [startDrawSignal, setStartDrawSignal] = useState(0);
  const [clearDrawSignal, setClearDrawSignal] = useState(0);
  
  const [locationData, setLocationData] = useState<FarmLocationData>({
    latitude: 9.5, 
    longitude: 77.5,
    accuracy: undefined,
    boundary: null,
    source: "gps-pin"
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("vazhaiguard_farm_profile");
    if (saved) {
      try {
        setFarmProfile(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse farm profile", e);
      }
    }
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (latitude && longitude && !locationData.boundary) {
      setLocationData(prev => ({ ...prev, latitude, longitude, accuracy }));
    }
  }, [latitude, longitude, accuracy]);

  // ✅ DEFINED: Handle Plot Selection
  const handlePlotSelect = (plotData: { 
    geometry: FarmPolygonGeometry; 
    properties?: any 
  }) => {
    setMapMode("draw"); 
    
    // Calculate rough center for camera focus
    const coords = plotData.geometry.coordinates[0][0];
    const centerLon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    const centerLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;

    setLocationData({
      latitude: centerLat,
      longitude: centerLon,
      boundary: plotData.geometry,
      selectedPlotId: plotData.properties?.id || "cadastral-plot",
      source: "cadastral-select",
      accuracy: undefined
    });
  };

  const handleBoundaryChange = (boundary: FarmPolygonGeometry | null) => {
    setLocationData(prev => ({
      ...prev,
      boundary,
      source: boundary ? "drawn" : "gps-pin",
      selectedPlotId: boundary ? undefined : prev.selectedPlotId
    }));
  };

  const handleSave = async () => {
    if (!locationData.latitude || !locationData.longitude) {
      setSaveError("தயவுசெய்து இடத்தைத் தேர்ந்தெடுக்கவும்.");
      return;
    }
    if (!locationData.boundary) {
      setSaveError("தயவுசெய்து எல்லையை வரையவும் அல்லது பார்சலைத் தேர்ந்தெடுக்கவும்.");
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      const finalData = {
        ...farmProfile,
        location: locationData,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem("vazhaiguard_farm_complete", JSON.stringify(finalData));
      navigate("/dashboard"); 
    } catch (err) {
      setSaveError("சேமிக்கும் போது பிழை ஏற்பட்டது.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (geoLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5fbf6]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#146c43] border-t-transparent"></div>
          <p className="text-[#13271d]">இடத்தைக் கண்டறிகிறது...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5fbf6] pb-20">
      <header className="sticky top-0 z-10 border-b border-[#dae7dd] bg-white/90 backdrop-blur-sm px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#13271d]">தோட்ட இடம் & எல்லை</h1>
            <p className="text-xs text-muted-foreground">நிலப்படத்தில் இடத்தைக் குறிக்கவும் அல்லது எல்லையை வரையவும்</p>
          </div>
          <span className="rounded-full bg-[#eaf5ec] px-3 py-1 text-xs font-semibold text-[#146c43]">படி 2 / 3</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {(geoError || saveError) && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
              <p className="text-sm text-red-700">{geoError || saveError}</p>
            </div>
          </div>
        )}

        <Card className="mb-6 overflow-hidden border-0 shadow-lg">
          <SatelliteMap
            accessToken={MAPBOX_TOKEN}
            location={{
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              accuracy: locationData.accuracy,
              label: locationData.source === "cadastral-select" ? "தேர்ந்தெடுக்கப்பட்ட பார்சல்" : "தோட்ட மையம்"
            }}
            boundary={locationData.boundary}
            startDrawSignal={startDrawSignal}
            clearDrawSignal={clearDrawSignal}
            dropPinMode={mapMode === "drop-pin"}
            onLocationChange={(loc) => setLocationData(prev => ({ ...prev, latitude: loc.latitude, longitude: loc.longitude }))}
            onBoundaryChange={handleBoundaryChange}
            onPlotSelect={handlePlotSelect} 
            cadastralGeoJson={null} 
          />
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Button
            variant={mapMode === "drop-pin" ? "default" : "outline"}
            onClick={() => {
              setMapMode("drop-pin");
              setClearDrawSignal(prev => prev + 1);
            }}
            className={`h-14 rounded-xl text-base ${mapMode === "drop-pin" ? "bg-[#073b2a] hover:bg-[#0b4d36]" : "bg-white text-[#13271d]"}`}
          >
            <MapPin className="mr-2 h-5 w-5" />
            {mapMode === "drop-pin" ? "தேர்ந்தெடுக்கப்பட்டது" : "இடத்தைக் குறி"}
          </Button>

          <Button
            variant={mapMode === "draw" ? "default" : "outline"}
            onClick={() => {
              setMapMode("draw");
              setStartDrawSignal(prev => prev + 1);
            }}
            className={`h-14 rounded-xl text-base ${mapMode === "draw" ? "bg-[#073b2a] hover:bg-[#0b4d36]" : "bg-white text-[#13271d]"}`}
          >
            <Pencil className="mr-2 h-5 w-5" />
            {locationData.boundary ? "எல்லை வரையப்பட்டது" : "எல்லையை வரை"}
          </Button>
        </div>

        {locationData.boundary && (
          <div className="mt-6 rounded-xl border border-[#cae5d1] bg-[#f3fbf5] p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 text-[#22a35a]" />
              <div>
                <h3 className="font-semibold text-[#13271d]">தோட்ட எல்லை உறுதி செய்யப்பட்டது</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {locationData.source === "cadastral-select" 
                    ? "நிலப் பதிவேட்டு பார்சல் தேர்ந்தெடுக்கப்பட்டது." 
                    : "கைமுறையாக வரையப்பட்ட எல்லை சேமிக்கப்பட்டது."}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" onClick={() => navigate(-1)} className="h-12 rounded-xl border-[#dae7dd] bg-white text-[#13271d] hover:bg-[#f5fbf6]">
            திரும்ப
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !locationData.boundary}
            className="flex-1 h-12 rounded-xl bg-[#073b2a] px-6 text-white hover:bg-[#0b4d36] disabled:opacity-50"
          >
            {isSaving ? "சேமிக்கிறது..." : "உறுதி செய்து அடுத்து"}
            {!isSaving && <ChevronRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </main>
    </div>
  );
}