import {
  useEffect,
  useRef,
} from "react";

import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

type FarmMapLocation = {
  latitude: number;
  longitude: number;
  label?: string;
};

type FarmPolygonGeometry = {
  type: "Polygon";
  coordinates: [number, number][][];
};

type Props = {
  accessToken: string;
  location: FarmMapLocation;
  boundary: FarmPolygonGeometry | null;
  startDrawSignal: number;
  clearDrawSignal: number;
  dropPinMode: boolean;
  onLocationChange: (
    location: FarmMapLocation
  ) => void;
  onBoundaryChange: (
    boundary: FarmPolygonGeometry | null
  ) => void;
};

const DEFAULT_ZOOM = 17.5;

export default function SatelliteMap({
  accessToken,
  location,
  boundary,
  startDrawSignal,
  clearDrawSignal,
  dropPinMode,
  onLocationChange,
  onBoundaryChange,
}: Props) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const mapRef =
    useRef<mapboxgl.Map | null>(null);

  const drawRef =
    useRef<MapboxDraw | null>(null);

  const markerRef =
    useRef<mapboxgl.Marker | null>(null);

  const boundarySyncRef =
    useRef(false);

  const initialLocationRef =
    useRef(location);

  const callbacksRef = useRef({
    onLocationChange,
    onBoundaryChange,
  });

  useEffect(() => {
    callbacksRef.current = {
      onLocationChange,
      onBoundaryChange,
    };
  }, [
    onLocationChange,
    onBoundaryChange,
  ]);

  useEffect(() => {
    if (
      !containerRef.current ||
      mapRef.current ||
      !accessToken
    ) {
      return;
    }

    mapboxgl.accessToken = accessToken;

    const firstLocation =
      initialLocationRef.current;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:
        "mapbox://styles/mapbox/standard-satellite",
      center: [
        firstLocation.longitude,
        firstLocation.latitude,
      ],
      zoom: DEFAULT_ZOOM,
      pitch: 0,
      bearing: 0,
      attributionControl: true,
    });

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
    });

    const marker = new mapboxgl.Marker({
      color: "#b8df4b",
    })
      .setLngLat([
        firstLocation.longitude,
        firstLocation.latitude,
      ])
      .addTo(map);

    map.addControl(
      new mapboxgl.NavigationControl(),
      "top-right"
    );

    map.addControl(
      new mapboxgl.FullscreenControl(),
      "top-right"
    );

    map.addControl(
      draw as unknown as mapboxgl.IControl,
      "top-right"
    );

    const syncBoundary = () => {
      if (boundarySyncRef.current) {
        return;
      }

      const collection = draw.getAll();

      const polygons =
        collection.features.filter(
          (feature) =>
            feature.geometry.type ===
            "Polygon"
        );

      if (polygons.length === 0) {
        callbacksRef.current.onBoundaryChange(
          null
        );
        return;
      }

      const latest =
        polygons[polygons.length - 1];

      if (polygons.length > 1) {
        polygons
          .slice(0, -1)
          .forEach((feature) => {
            if (feature.id !== undefined) {
              draw.delete(
                String(feature.id)
              );
            }
          });
      }

      if (
        latest.geometry.type !==
        "Polygon"
      ) {
        return;
      }

      callbacksRef.current.onBoundaryChange({
        type: "Polygon",
        coordinates:
          latest.geometry.coordinates as [
            number,
            number
          ][][],
      });
    };

    const drawEventMap = map as unknown as {
      on: (
        type: string,
        listener: () => void
      ) => void;
    };

    drawEventMap.on(
      "draw.create",
      syncBoundary
    );
    drawEventMap.on(
      "draw.update",
      syncBoundary
    );
    drawEventMap.on(
      "draw.delete",
      syncBoundary
    );

    map.on("click", (event) => {
      if (
        map.getCanvas().dataset.dropPin !==
        "true"
      ) {
        return;
      }

      callbacksRef.current.onLocationChange({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      });
    });

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
  }, [accessToken]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;

    if (!map || !marker) {
      return;
    }

    const next: [number, number] = [
      location.longitude,
      location.latitude,
    ];

    marker.setLngLat(next);

    map.easeTo({
      center: next,
      zoom: Math.max(
        map.getZoom(),
        DEFAULT_ZOOM
      ),
      duration: 800,
    });
  }, [
    location.latitude,
    location.longitude,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (dropPinMode) {
      map.getCanvas().dataset.dropPin =
        "true";
      map.getCanvas().style.cursor =
        "crosshair";
    } else {
      delete map.getCanvas().dataset.dropPin;
      map.getCanvas().style.cursor = "";
    }
  }, [dropPinMode]);

  useEffect(() => {
    if (startDrawSignal === 0) {
      return;
    }

    const draw = drawRef.current;

    if (!draw) {
      return;
    }

    draw.deleteAll();
    callbacksRef.current.onBoundaryChange(
      null
    );
    draw.changeMode("draw_polygon");
  }, [startDrawSignal]);

  useEffect(() => {
    if (clearDrawSignal === 0) {
      return;
    }

    const draw = drawRef.current;

    if (!draw) {
      return;
    }

    draw.deleteAll();
    callbacksRef.current.onBoundaryChange(
      null
    );
  }, [clearDrawSignal]);

  useEffect(() => {
    const draw = drawRef.current;

    if (!draw) {
      return;
    }

    const current = draw.getAll();

    if (
      boundary === null &&
      current.features.length > 0
    ) {
      boundarySyncRef.current = true;
      draw.deleteAll();
      boundarySyncRef.current = false;
      return;
    }

    if (
      boundary &&
      current.features.length === 0
    ) {
      boundarySyncRef.current = true;

      draw.add({
        type: "Feature",
        properties: {},
        geometry: boundary,
      });

      boundarySyncRef.current = false;
    }
  }, [boundary]);

  return (
    <div
      ref={containerRef}
      className="h-[520px] w-full overflow-hidden rounded-[24px] bg-[#0b2a1e] sm:h-[610px]"
    />
  );
}
