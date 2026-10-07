import { useEffect, useRef } from "react";
import L from "leaflet";
import area from "@turf/area";
import {
  getSatelliteLayer,
  getSatellitePreview,
  type SatelliteLayer,
} from "../../services/satelliteApi";

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
  type: "Polygon" | "MultiPolygon";
  coordinates: any;
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

function ringPerimeter(ring: [number, number][]): number {
  if (!ring || ring.length < 2) return 0;
  let perimeter = 0;
  for (let index = 1; index < ring.length; index += 1) {
    perimeter += distanceInMeters(ring[index - 1], ring[index]);
  }
  return perimeter;
}

function calculatePerimeter(boundary: FarmPolygonGeometry): number {
  if (boundary.type === "Polygon") {
    return boundary.coordinates.reduce(
      (sum: number, ring: [number, number][]) => sum + ringPerimeter(ring),
      0,
    );
  }

  return boundary.coordinates.reduce(
    (sum: number, polygon: [number, number][][]) =>
      sum +
      polygon.reduce(
        (polygonSum: number, ring: [number, number][]) =>
          polygonSum + ringPerimeter(ring),
        0,
      ),
    0,
  );
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
    areaAcres: Number((area(polygon as never) / 4046.8564224).toFixed(4)),
    perimeterM: Number(calculatePerimeter(boundary).toFixed(2)),
  };
}

function geometryToLeaflet(
  geometry: FarmPolygonGeometry,
): L.LatLngExpression[][] | L.LatLngExpression[][][] {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map((ring: [number, number][]) =>
      ring.map(([lng, lat]) => [lat, lng] as L.LatLngExpression),
    );
  }

  return geometry.coordinates.map((polygon: [number, number][][]) =>
    polygon.map((ring) =>
      ring.map(([lng, lat]) => [lat, lng] as L.LatLngExpression),
    ),
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
  const imageryLayerRef = useRef<L.ImageOverlay | null>(null);
  const dropPinModeRef = useRef(dropPinMode);
  const [mapLayer, setMapLayer] = useState<"street" | "true-color" | SatelliteLayer>("street");
  const [imageryLoading, setImageryLoading] = useState(false);
  const [imageryError, setImageryError] = useState("");
  const callbacksRef = useRef({
    onLocationChange,
    onBoundaryChange,
    onBoundaryMetricsChange,
    onPlotSelect,
  });

  useEffect(() => {
    dropPinModeRef.current = dropPinMode;
  }, [dropPinMode]);

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
      if (dropPinModeRef.current) {
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

    const polygon = L.polygon(geometryToLeaflet(boundary) as any, {
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
          if (
            !geometry ||
            (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")
          ) return;

          const selectedGeometry = geometry as FarmPolygonGeometry;

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
    const map = mapRef.current;
    if (!map) return;

    if (imageryLayerRef.current) {
      map.removeLayer(imageryLayerRef.current);
      imageryLayerRef.current = null;
    }

    if (mapLayer === "street") {
      setImageryLoading(false);
      setImageryError("");
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setImageryLoading(true);
    setImageryError("");

    const loadLayer = async () => {
      try {
        const input = {
          latitude: location.latitude,
          longitude: location.longitude,
          boundary: boundary || undefined,
          lookbackDays: 45,
          maxCloudPercent: 35,
        };

        const url =
          mapLayer === "true-color"
            ? await getSatellitePreview(input)
            : await getSatelliteLayer(input, mapLayer);

        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }

        objectUrl = url;
        const bounds = boundary
          ? L.geoJSON({
              type: "Feature",
              properties: {},
              geometry: boundary,
            } as GeoJSON.Feature).getBounds()
          : L.latLngBounds(
              [location.latitude - 0.0006, location.longitude - 0.0008],
              [location.latitude + 0.0006, location.longitude + 0.0008],
            );

        imageryLayerRef.current = L.imageOverlay(url, bounds, {
          opacity: 0.78,
          interactive: false,
        }).addTo(map);

        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            padding: [60, 60],
            maxZoom: 20,
            animate: true,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setImageryError(
            error instanceof Error
              ? error.message
              : "Satellite layer is temporarily unavailable.",
          );
        }
      } finally {
        if (!cancelled) setImageryLoading(false);
      }
    };

    void loadLayer();

    return () => {
      cancelled = true;
      if (imageryLayerRef.current) {
        map.removeLayer(imageryLayerRef.current);
        imageryLayerRef.current = null;
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mapLayer, location.latitude, location.longitude, boundary]);

  return (
    <div className="relative h-[620px] w-full overflow-hidden rounded-[24px]">
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute left-4 top-16 z-[500] flex flex-wrap gap-1 rounded-2xl border border-white/70 bg-white/95 p-1 shadow-lg backdrop-blur">
        {([
          ["street", "Map"],
          ["true-color", "Satellite"],
          ["ndvi", "NDVI"],
          ["ndre", "NDRE"],
          ["ndwi", "NDWI"],
          ["stress", "Stress"],
        ] as Array<["street" | "true-color" | SatelliteLayer, string]>).map(
          ([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMapLayer(value)}
              className={
                mapLayer === value
                  ? "rounded-xl bg-[#073b2a] px-3 py-2 text-[10px] font-bold text-white"
                  : "rounded-xl px-3 py-2 text-[10px] font-bold text-[#53655b] hover:bg-[#eef7f0]"
              }
            >
              {label}
            </button>
          ),
        )}
      </div>

      {imageryLoading && (
        <div className="absolute left-1/2 top-20 z-[500] -translate-x-1/2 rounded-full bg-[#073b2a]/95 px-4 py-2 text-xs font-bold text-white shadow-lg">
          Loading Sentinel-2...
        </div>
      )}

      {imageryError && (
        <div className="absolute bottom-4 right-4 z-[500] max-w-[320px] rounded-2xl border border-[#f3c7c7] bg-white/95 px-4 py-3 text-xs text-[#7a2727] shadow-lg backdrop-blur">
          <p className="font-bold">Satellite layer unavailable</p>
          <p className="mt-1">{imageryError}</p>
        </div>
      )}



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
