import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

// Types
type FarmMapLocation = {
  latitude: number;
  longitude: number;
  label?: string;
  accuracy?: number;
};

type FarmPolygonGeometry = {
  type: "Polygon";
  coordinates: [number, number][][];
};

type PlotSelectData = {
  geometry: FarmPolygonGeometry;
  properties?: any;
};

type Props = {
  accessToken: string;
  location: FarmMapLocation;
  boundary: FarmPolygonGeometry | null;
  startDrawSignal: number;
  clearDrawSignal: number;
  dropPinMode: boolean;
  cadastralGeoJson?: any; // Optional: GeoJSON data for overlays
  
  onLocationChange: (location: FarmMapLocation) => void;
  onBoundaryChange: (boundary: FarmPolygonGeometry | null) => void;
  onPlotSelect?: (data: PlotSelectData) => void; // NEW PROP
};

const DEFAULT_ZOOM = 18.5;
const FARM_FOCUS_ZOOM = 19.5;

function getGpsZoom(accuracy?: number) {
  if (accuracy === undefined || !Number.isFinite(accuracy)) return DEFAULT_ZOOM;
  if (accuracy <= 15) return 19;
  if (accuracy <= 40) return 18;
  return 16.5;
}

function fitFarmBoundary(map: mapboxgl.Map, boundary: FarmPolygonGeometry) {
  const ring = boundary.coordinates[0];
  if (!ring || ring.length === 0) return;

  const bounds = new mapboxgl.LngLatBounds();
  ring.forEach(([longitude, latitude]) => {
    bounds.extend([longitude, latitude]);
  });

  map.fitBounds(bounds, { padding: 70, maxZoom: 20, duration: 1000, essential: true });
}

export default function SatelliteMap({
  accessToken,
  location,
  boundary,
  startDrawSignal,
  clearDrawSignal,
  dropPinMode,
  cadastralGeoJson,
  onLocationChange,
  onBoundaryChange,
  onPlotSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const boundarySyncRef = useRef(false);
  const initialLocationRef = useRef(location);
  
  const callbacksRef = useRef({
    onLocationChange,
    onBoundaryChange,
    onPlotSelect,
  });

  useEffect(() => {
    callbacksRef.current = { onLocationChange, onBoundaryChange, onPlotSelect };
  }, [onLocationChange, onBoundaryChange, onPlotSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !accessToken) return;

    mapboxgl.accessToken = accessToken;
    const firstLocation = initialLocationRef.current;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [firstLocation.longitude, firstLocation.latitude],
      zoom: DEFAULT_ZOOM,
      pitch: 0,
      bearing: 0,
      minZoom: 10,
      maxZoom: 21,
    });

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
    });

    const marker = new mapboxgl.Marker({ color: "#b8df4b" })
      .setLngLat([firstLocation.longitude, firstLocation.latitude])
      .addTo(map);

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");
    map.addControl(draw as unknown as mapboxgl.IControl, "top-right");

    // Load Cadastral Overlay if provided
    if (cadastralGeoJson) {
      map.on("load", () => {
        map.addSource("cadastral", { type: "geojson", data: cadastralGeoJson });
        map.addLayer({
          id: "cadastral-fill",
          type: "fill",
          source: "cadastral",
          paint: { "fill-color": "#007cbf", "fill-opacity": 0.3 },
        });
        map.addLayer({
          id: "cadastral-line",
          type: "line",
          source: "cadastral",
          paint: { "line-color": "#fff", "line-width": 2 },
        });
      });
    }

    // Handle Clicks for Plot Selection
    map.on("click", (event) => {
      // If in Drop Pin Mode
      if (dropPinMode) {
        const lat = event.lngLat.lat;
        const lng = event.lngLat.lng;
        callbacksRef.current.onLocationChange({
          latitude: lat,
          longitude: lng,
          label: "Farmer selected farm centre",
        });
        map.flyTo({ center: [lng, lat], zoom: FARM_FOCUS_ZOOM, duration: 1400, essential: true });
        return;
      }

      // If in View Mode and GeoJSON exists, check for intersection
      if (cadastralGeoJson && !dropPinMode) {
         // Simplified logic: In a real app, use turf.js to check if point is inside polygon
         // For now, we assume clicking near a feature triggers selection if you add interaction layers
         // This is a placeholder for complex GIS interaction
      }
    });

    const syncBoundary = () => {
      if (boundarySyncRef.current) return;
      const collection = draw.getAll();
      const polygons = collection.features.filter((f) => f.geometry.type === "Polygon");

      if (polygons.length === 0) {
        callbacksRef.current.onBoundaryChange(null);
        return;
      }

      const latest = polygons[polygons.length - 1];
      if (polygons.length > 1) {
        polygons.slice(0, -1).forEach((f) => { if(f.id !== undefined) draw.delete(String(f.id)); });
      }

      if (latest.geometry.type !== "Polygon") return;

      const newBoundary: FarmPolygonGeometry = {
        type: "Polygon",
        coordinates: latest.geometry.coordinates as [number, number][][],
      };

      callbacksRef.current.onBoundaryChange(newBoundary);
      fitFarmBoundary(map, newBoundary);
    };

    const drawEventMap = map as unknown as { on: (type: string, listener: () => void) => void };
    drawEventMap.on("draw.create", syncBoundary);
    drawEventMap.on("draw.update", syncBoundary);
    drawEventMap.on("draw.delete", syncBoundary);

    mapRef.current = map;
    drawRef.current = draw;
    markerRef.current = marker;

    return () => {
      marker.remove();
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
      markerRef.current = null;
    };
  }, [accessToken, dropPinMode, cadastralGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    const next: [number, number] = [location.longitude, location.latitude];
    marker.setLngLat(next);
    const zoom = getGpsZoom(location.accuracy);
    map.flyTo({ center: next, zoom, pitch: 0, bearing: 0, duration: 1300, essential: true });
  }, [location.latitude, location.longitude, location.accuracy]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (dropPinMode) {
      map.getCanvas().dataset.dropPin = "true";
      map.getCanvas().style.cursor = "crosshair";
    } else {
      delete (map.getCanvas().dataset.dropPin);
      map.getCanvas().style.cursor = "";
    }
  }, [dropPinMode]);

  useEffect(() => {
    if (startDrawSignal === 0) return;
    const draw = drawRef.current;
    if (!draw) return;
    draw.deleteAll();
    callbacksRef.current.onBoundaryChange(null);
    draw.changeMode("draw_polygon");
  }, [startDrawSignal]);

  useEffect(() => {
    if (clearDrawSignal === 0) return;
    const draw = drawRef.current;
    if (!draw) return;
    draw.deleteAll();
    callbacksRef.current.onBoundaryChange(null);
  }, [clearDrawSignal]);

  useEffect(() => {
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw || !map) return;

    const current = draw.getAll();
    if (boundary === null && current.features.length > 0) {
      boundarySyncRef.current = true;
      draw.deleteAll();
      boundarySyncRef.current = false;
      return;
    }

    if (boundary && current.features.length === 0) {
      boundarySyncRef.current = true;
      draw.add({ type: "Feature", properties: {}, geometry: boundary });
      boundarySyncRef.current = false;
      fitFarmBoundary(map, boundary);
    }
  }, [boundary]);

  return (
    <div ref={containerRef} className="h-[520px] w-full overflow-hidden rounded-[24px] bg-[#0b2a1e] sm:h-[610px]" />
  );
}