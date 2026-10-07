import { useEffect, useRef } from "react";
import L from "leaflet";
import area from "@turf/area";

import "leaflet/dist/leaflet.css";

/* =========================================================
   TYPES
========================================================= */

export type FarmMapLocation = {
  latitude: number;
  longitude: number;
  label?: string;
  accuracy?: number;
};

export type FarmPolygonGeometry = {
  type: "Polygon";
  coordinates: [number, number][][];
};

export type PlotSelectData = {
  geometry: FarmPolygonGeometry;
  properties?: Record<string, unknown>;
};

export type BoundaryMetrics = {
  areaAcres: number;
  perimeterM: number;
};

type Props = {
  /* Kept for backwards compatibility with FarmLocationPage.
     Leaflet/OpenStreetMap no longer requires a Mapbox token. */
  accessToken?: string;
  location: FarmMapLocation;
  boundary: FarmPolygonGeometry | null;
  startDrawSignal: number;
  clearDrawSignal: number;
  dropPinMode: boolean;
  cadastralGeoJson?: any;
  selectedParcelId?: string | null;
  onLocationChange: (location: FarmMapLocation) => void;
  onBoundaryChange: (boundary: FarmPolygonGeometry | null) => void;
  onBoundaryMetricsChange?: (metrics: BoundaryMetrics | null) => void;
  onPlotSelect?: (data: PlotSelectData) => void;
};

const DEFAULT_ZOOM = 18;
const FARM_FOCUS_ZOOM = 19;

function getGpsZoom(accuracy?: number): number {
  if (accuracy === undefined || !Number.isFinite(accuracy)) return DEFAULT_ZOOM;
  if (accuracy <= 15) return 19;
  if (accuracy <= 40) return 18;
  return 16.5;
}

function distanceInMeters(
  first: [number, number],
  second: [number, number],
): number {
  const [lon1, lat1] = first;
  const [lon2, lat2] = second;
  const earthRadius = 6371008.8;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculatePerimeter(coordinates: [number, number][][]): number {
  const ring = coordinates[0];
  if (!ring || ring.length < 2) return 0;
  let perimeter = 0;
  for (let index = 1; index < ring.length; index += 1) {
    perimeter += distanceInMeters(ring[index - 1], ring[index]);
  }
  return perimeter;
}

function calculateBoundaryMetrics(
  boundary: FarmPolygonGeometry,
): BoundaryMetrics {
  const polygon = {
    type: "Feature" as const,
    properties: {},
    geometry: boundary,
  };
  return {
    areaAcres: Number((area(polygon) / 4046.8564224).toFixed(4)),
    perimeterM: Number(calculatePerimeter(boundary.coordinates).toFixed(2)),
  };
}

function geometryToLeaflet(
  geometry: FarmPolygonGeometry,
): L.LatLngExpression[][] {
  return geometry.coordinates.map((ring) =>
    ring.map(([lng, lat]) => [lat, lng] as L.LatLngExpression),
  );
}

export default function SatelliteMap({
  location,
  boundary,
  startDrawSignal,
  clearDrawSignal,
  dropPinMode,
  cadastralGeoJson,
  selectedParcelId,
  onLocationChange,
  onBoundaryChange,
  onBoundaryMetricsChange,
  onPlotSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const boundaryLayerRef = useRef<L.Polygon | null>(null);
  const cadastralLayerRef = useRef<L.GeoJSON | null>(null);
  const drawingRef = useRef(false);
  const drawPointsRef = useRef<[number, number][]>([]);
  const drawPreviewRef = useRef<L.Polyline | null>(null);
  const callbacksRef = useRef({
    onLocationChange,
    onBoundaryChange,
    onBoundaryMetricsChange,
    onPlotSelect,
  });

  useEffect(() => {
    callbacksRef.current = {
      onLocationChange,
      onBoundaryChange,
      onBoundaryMetricsChange,
      onPlotSelect,
    };
  }, [
    onLocationChange,
    onBoundaryChange,
    onBoundaryMetricsChange,
    onPlotSelect,
  ]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      doubleClickZoom: false,
      preferCanvas: true,
    }).setView([location.latitude, location.longitude], DEFAULT_ZOOM);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 21,
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);
    L.control.scale({ position: "bottomright", imperial: true, metric: true }).addTo(map);

    const marker = L.circleMarker([location.latitude, location.longitude], {
      radius: 9,
      color: "#13271d",
      weight: 3,
      fillColor: "#b8df4b",
      fillOpacity: 1,
    }).addTo(map);

    marker.bindTooltip(location.label || "Farm location", {
      direction: "top",
      offset: [0, -8],
    });

    markerRef.current = marker;

    const handleMapClick = (event: L.LeafletMouseEvent) => {
      if (dropPinMode) {
        callbacksRef.current.onLocationChange({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
          label: "Farmer selected farm centre",
        });
        map.flyTo(event.latlng, FARM_FOCUS_ZOOM, {
          animate: true,
          duration: 1.2,
        });
        return;
      }

      if (!drawingRef.current) return;

      drawPointsRef.current.push([event.latlng.lng, event.latlng.lat]);

      if (drawPreviewRef.current) {
        drawPreviewRef.current.setLatLngs(
          drawPointsRef.current.map(([lng, lat]) => [lat, lng]),
        );
      } else {
        drawPreviewRef.current = L.polyline(
          drawPointsRef.current.map(([lng, lat]) => [lat, lng]),
          { color: "#146c43", weight: 4, dashArray: "8 6" },
        ).addTo(map);
      }

      if (drawPointsRef.current.length >= 3) {
        const points = drawPointsRef.current;
        const first = points[0];
        const last = points[points.length - 1];
        if (distanceInMeters(first, last) < 15) {
          finishDrawing();
        }
      }
    };

    const handleDoubleClick = (event: L.LeafletMouseEvent) => {
      if (!drawingRef.current) return;
      event.originalEvent.preventDefault();
      finishDrawing();
    };

    const finishDrawing = () => {
      if (drawPointsRef.current.length < 3) return;

      const points = [...drawPointsRef.current];
      const first = points[0];
      const last = points[points.length - 1];

      if (distanceInMeters(first, last) > 2) {
        points.push(first);
      }

      const newBoundary: FarmPolygonGeometry = {
        type: "Polygon",
        coordinates: [points],
      };

      drawingRef.current = false;
      drawPointsRef.current = [];

      if (drawPreviewRef.current) {
        map.removeLayer(drawPreviewRef.current);
        drawPreviewRef.current = null;
      }

      callbacksRef.current.onBoundaryChange(newBoundary);
      callbacksRef.current.onBoundaryMetricsChange?.(
        calculateBoundaryMetrics(newBoundary),
      );

      const ring = newBoundary.coordinates[0].map(
        ([lng, lat]) => [lat, lng] as L.LatLngExpression,
      );
      map.fitBounds(L.latLngBounds(ring), {
        padding: [70, 70],
        maxZoom: 20,
        animate: true,
      });
    };

    map.on("click", handleMapClick);
    map.on("dblclick", handleDoubleClick);

    // Store the function on the map instance so signal effects can invoke it.
    (map as L.Map & { __finishDrawing?: () => void }).__finishDrawing =
      finishDrawing;

    mapRef.current = map;

    return () => {
      if (drawPreviewRef.current) {
        map.removeLayer(drawPreviewRef.current);
        drawPreviewRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      boundaryLayerRef.current = null;
      cadastralLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    const latLng: L.LatLngExpression = [location.latitude, location.longitude];
    marker.setLatLng(latLng);
    marker.setTooltipContent(location.label || "Farm location");

    if (!drawingRef.current) {
      map.flyTo(latLng, getGpsZoom(location.accuracy), {
        animate: true,
        duration: 1,
      });
    }
  }, [location.latitude, location.longitude, location.accuracy, location.label]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (boundaryLayerRef.current) {
      map.removeLayer(boundaryLayerRef.current);
      boundaryLayerRef.current = null;
    }

    if (!boundary) return;

    const polygon = L.polygon(geometryToLeaflet(boundary), {
      color: "#146c43",
      weight: 4,
      fillColor: "#b8df4b",
      fillOpacity: 0.24,
    }).addTo(map);

    boundaryLayerRef.current = polygon;

    const bounds = polygon.getBounds();
    if (bounds.isValid() && !drawingRef.current) {
      map.fitBounds(bounds, {
        padding: [70, 70],
        maxZoom: 20,
        animate: true,
      });
    }
  }, [boundary]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (cadastralLayerRef.current) {
      map.removeLayer(cadastralLayerRef.current);
      cadastralLayerRef.current = null;
    }

    if (!cadastralGeoJson) return;

    const layer = L.geoJSON(cadastralGeoJson, {
      style: (feature) => {
        const id = String(feature?.properties?.parcel_id || "");
        const selected = Boolean(selectedParcelId && id === selectedParcelId);
        return {
          color: selected ? "#073b2a" : "#7fc97f",
          weight: selected ? 4 : 2,
          fillColor: selected ? "#b8df4b" : "#7fc97f",
          fillOpacity: selected ? 0.38 : 0.16,
        };
      },
      onEachFeature: (feature, featureLayer) => {
        featureLayer.on("click", (event: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(event);
          const geometry = feature.geometry;
          if (geometry?.type !== "Polygon") return;

          const selectedGeometry: FarmPolygonGeometry = {
            type: "Polygon",
            coordinates: geometry.coordinates as [number, number][][],
          };

          callbacksRef.current.onPlotSelect?.({
            geometry: selectedGeometry,
            properties: (feature.properties || {}) as Record<string, unknown>,
          });

          callbacksRef.current.onBoundaryChange(selectedGeometry);
          callbacksRef.current.onBoundaryMetricsChange?.(
            calculateBoundaryMetrics(selectedGeometry),
          );
        });

        featureLayer.bindTooltip(
          String(feature.properties?.parcel_id || "Farm parcel"),
          { sticky: true },
        );
      },
    }).addTo(map);

    cadastralLayerRef.current = layer;
  }, [cadastralGeoJson, selectedParcelId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (clearDrawSignal > 0) {
      drawingRef.current = false;
      drawPointsRef.current = [];
      if (drawPreviewRef.current) {
        map.removeLayer(drawPreviewRef.current);
        drawPreviewRef.current = null;
      }
    }
  }, [clearDrawSignal]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || startDrawSignal <= 0) return;

    drawingRef.current = true;
    drawPointsRef.current = [];

    if (drawPreviewRef.current) {
      map.removeLayer(drawPreviewRef.current);
      drawPreviewRef.current = null;
    }

    map.getContainer().style.cursor = "crosshair";
  }, [startDrawSignal]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getContainer().style.cursor = dropPinMode
      ? "crosshair"
      : drawingRef.current
        ? "crosshair"
        : "";
  }, [dropPinMode, startDrawSignal]);

  useEffect(() => {
    return () => {
      const map = mapRef.current;
      if (map) {
        (map as L.Map & { __finishDrawing?: () => void }).__finishDrawing?.();
      }
    };
  }, []);

  return (
    <div className="relative h-[620px] w-full overflow-hidden rounded-[24px]">
      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute left-4 bottom-4 z-[500] max-w-[300px] rounded-2xl border border-white/70 bg-white/95 px-4 py-3 text-xs text-[#53655b] shadow-lg backdrop-blur">
        <p className="font-bold text-[#13271d]">Map controls</p>
        <p className="mt-1">
          OpenStreetMap base map. Use <b>Move map pin</b> to set the farm centre.
          When boundary editing is active, click points around the farm and double-click
          to finish the polygon.
        </p>
      </div>

      {drawingRef.current && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-[500] -translate-x-1/2 rounded-full bg-[#073b2a]/95 px-4 py-2 text-xs font-bold text-white shadow-lg">
          Boundary drawing active • click points, double-click to finish
        </div>
      )}
    </div>
  );
}
