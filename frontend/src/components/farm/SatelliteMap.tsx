import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import area from "@turf/area";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

/* =========================================================
   TYPES
========================================================= */

export type FarmMapLocation = {
  latitude: number;
  longitude: number;
  label?: string;
  accuracy?: number;
};

/*
 * Keep the interactive farmer-drawn boundary as Polygon.
 *
 * Cadastral APIs may contain MultiPolygon, but the current
 * FarmBoundaryEditor and FarmLocationPage are Polygon-based.
 *
 * This keeps the complete frontend flow type-safe.
 */
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
  accessToken: string;

  location: FarmMapLocation;

  boundary: FarmPolygonGeometry | null;

  startDrawSignal: number;

  clearDrawSignal: number;

  dropPinMode: boolean;

  cadastralGeoJson?: any;
  selectedParcelId?: string | null;

  onLocationChange: (
    location: FarmMapLocation
  ) => void;

  onBoundaryChange: (
    boundary: FarmPolygonGeometry | null
  ) => void;

  onBoundaryMetricsChange?: (
    metrics: BoundaryMetrics | null
  ) => void;

  onPlotSelect?: (
    data: PlotSelectData
  ) => void;
};

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_ZOOM = 18.5;

const FARM_FOCUS_ZOOM = 19.5;

/* =========================================================
   GPS ZOOM
========================================================= */

function getGpsZoom(
  accuracy?: number
): number {
  if (
    accuracy === undefined ||
    !Number.isFinite(accuracy)
  ) {
    return DEFAULT_ZOOM;
  }

  if (accuracy <= 15) {
    return 19;
  }

  if (accuracy <= 40) {
    return 18;
  }

  return 16.5;
}

/* =========================================================
   DISTANCE
========================================================= */

function distanceInMeters(
  first: [number, number],
  second: [number, number]
): number {
  const [lon1, lat1] = first;

  const [lon2, lat2] = second;

  const earthRadius = 6371008.8;

  const toRadians = (
    degrees: number
  ) =>
    (degrees * Math.PI) / 180;

  const latitudeDifference =
    toRadians(lat2 - lat1);

  const longitudeDifference =
    toRadians(lon2 - lon1);

  const latitude1 =
    toRadians(lat1);

  const latitude2 =
    toRadians(lat2);

  const a =
    Math.sin(
      latitudeDifference / 2
    ) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(
        longitudeDifference / 2
      ) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
}

/* =========================================================
   PERIMETER
========================================================= */

function calculatePerimeter(
  coordinates: [number, number][][]
): number {
  const ring = coordinates[0];

  if (
    !ring ||
    ring.length < 2
  ) {
    return 0;
  }

  let perimeter = 0;

  for (
    let index = 1;
    index < ring.length;
    index += 1
  ) {
    perimeter += distanceInMeters(
      ring[index - 1],
      ring[index]
    );
  }

  return perimeter;
}

/* =========================================================
   FARM METRICS
========================================================= */

function calculateBoundaryMetrics(
  boundary: FarmPolygonGeometry
): BoundaryMetrics {
  const polygon = {
    type: "Feature" as const,

    properties: {},

    geometry: boundary,
  };

  const areaSquareMeters =
    area(polygon);

  const areaAcres =
    areaSquareMeters /
    4046.8564224;

  const perimeterM =
    calculatePerimeter(
      boundary.coordinates
    );

  return {
    areaAcres:
      Number(
        areaAcres.toFixed(4)
      ),

    perimeterM:
      Number(
        perimeterM.toFixed(2)
      ),
  };
}

/* =========================================================
   FIT FARM BOUNDARY
========================================================= */

function fitFarmBoundary(
  map: mapboxgl.Map,
  boundary: FarmPolygonGeometry
) {
  const ring =
    boundary.coordinates[0];

  if (
    !ring ||
    ring.length === 0
  ) {
    return;
  }

  const bounds =
    new mapboxgl.LngLatBounds();

  ring.forEach(
    ([longitude, latitude]) => {
      bounds.extend([
        longitude,
        latitude,
      ]);
    }
  );

  map.fitBounds(
    bounds,
    {
      padding: 90,
      maxZoom: 20,
      duration: 1000,
      essential: true,
    }
  );
}

/* =========================================================
   SATELLITE MAP
========================================================= */

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

  onBoundaryMetricsChange,

  onPlotSelect,
}: Props) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const mapRef =
    useRef<mapboxgl.Map | null>(
      null
    );

  const drawRef =
    useRef<MapboxDraw | null>(
      null
    );

  const markerRef =
    useRef<mapboxgl.Marker | null>(
      null
    );

  const boundarySyncRef =
    useRef(false);

  const initialLocationRef =
    useRef(location);

  /* =======================================================
     KEEP CALLBACKS CURRENT
  ======================================================= */

  const callbacksRef =
    useRef({
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

  /* =======================================================
     INITIALIZE MAP
  ======================================================= */

  useEffect(() => {
    if (
      !containerRef.current ||
      mapRef.current ||
      !accessToken
    ) {
      return;
    }

    mapboxgl.accessToken =
      accessToken;

    const firstLocation =
      initialLocationRef.current;

    const map =
      new mapboxgl.Map({
        container:
          containerRef.current,

        style:
          "mapbox://styles/mapbox/satellite-streets-v12",

        center: [
          firstLocation.longitude,
          firstLocation.latitude,
        ],

        zoom: DEFAULT_ZOOM,

        pitch: 0,

        bearing: 0,

        minZoom: 10,

        maxZoom: 21,
      });

    /* =====================================================
       MAPBOX DRAW
    ===================================================== */

    const draw =
      new MapboxDraw({
        displayControlsDefault:
          false,

        controls: {
          polygon: true,
          trash: true,
        },

        styles: [
          {
            id:
              "gl-draw-polygon-fill",

            type: "fill",

            filter: [
              "all",
              [
                "==",
                "$type",
                "Polygon",
              ],
            ],

            paint: {
              "fill-color":
                "#9ACD32",

              "fill-opacity":
                0.22,
            },
          },

          {
            id:
              "gl-draw-polygon-stroke",

            type: "line",

            filter: [
              "all",
              [
                "==",
                "$type",
                "Polygon",
              ],
            ],

            paint: {
              "line-color":
                "#D9F99D",

              "line-width": 4,

              "line-opacity":
                0.95,
            },
          },

          {
            id:
              "gl-draw-polygon-and-line-vertex-halo-active",

            type: "circle",

            filter: [
              "all",

              [
                "==",
                "meta",
                "vertex",
              ],

              [
                "==",
                "$type",
                "Point",
              ],

              [
                "==",
                "meta",
                "feature",
              ],
            ],

            paint: {
              "circle-radius": 8,

              "circle-color":
                "#FFFFFF",
            },
          },

          {
            id:
              "gl-draw-polygon-and-line-vertex-active",

            type: "circle",

            filter: [
              "all",

              [
                "==",
                "meta",
                "vertex",
              ],

              [
                "==",
                "$type",
                "Point",
              ],

              [
                "==",
                "meta",
                "feature",
              ],
            ],

            paint: {
              "circle-radius": 5,

              "circle-color":
                "#7FBF3F",
            },
          },
        ],
      });

    /* =====================================================
       FARMER LOCATION MARKER
    ===================================================== */

    const marker =
      new mapboxgl.Marker({
        color: "#b8df4b",
      })
        .setLngLat([
          firstLocation.longitude,
          firstLocation.latitude,
        ])
        .addTo(map);

    /* =====================================================
       MAP CONTROLS
    ===================================================== */

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

    /* =====================================================
       CADASTRAL DATA
    ===================================================== */

    if (cadastralGeoJson) {
      map.on("load", () => {
        if (
          map.getSource(
            "cadastral"
          )
        ) {
          return;
        }

        map.addSource(
          "cadastral",
          {
            type: "geojson",

            data:
              cadastralGeoJson,
          }
        );

        map.addLayer({
          id:
            "cadastral-fill",

          type: "fill",

          source:
            "cadastral",

          paint: {
            "fill-color":
              "#007cbf",

            "fill-opacity":
              0.3,
          },
        });

        map.addLayer({
          id:
            "cadastral-line",

          type: "line",

          source:
            "cadastral",

          paint: {
            "line-color":
              "#ffffff",

            "line-width": 2,
          },
        });
      });
    }

    /* =====================================================
       MAP CLICK
    ===================================================== */

    map.on(
      "click",
      (event) => {
        /* -----------------------------------------------
           DROP FARM PIN
        ------------------------------------------------ */

        if (dropPinMode) {
          const lat =
            event.lngLat.lat;

          const lng =
            event.lngLat.lng;

          callbacksRef.current
            .onLocationChange({
              latitude: lat,

              longitude: lng,

              label:
                "Farmer selected farm centre",
            });

          map.flyTo({
            center: [lng, lat],

            zoom:
              FARM_FOCUS_ZOOM,

            duration: 1400,

            essential: true,
          });

          return;
        }

        /* -----------------------------------------------
           CADASTRAL PARCEL CLICK
        ------------------------------------------------ */

        if (
          cadastralGeoJson &&
          !dropPinMode
        ) {
          const features =
            map.queryRenderedFeatures(
              event.point,
              {
                layers: [
                  "cadastral-fill",
                ],
              }
            );

          if (
            features.length === 0
          ) {
            return;
          }

          const feature =
            features[0];

          const geometry =
            feature.geometry;

          /*
           * The current FarmLocationPage and
           * FarmBoundaryEditor consume Polygon.
           *
           * Therefore only emit a Polygon
           * through onPlotSelect.
           *
           * MultiPolygon cadastral data remains
           * valid in the parcel API and can be
           * handled separately by parcel confirmation.
           */

          if (
            geometry.type ===
              "Polygon"
          ) {
            const selectedGeometry:
              FarmPolygonGeometry = {
              type: "Polygon",

              coordinates:
                geometry.coordinates as [
                  number,
                  number
                ][][],
            };

            callbacksRef.current
              .onPlotSelect?.({
                geometry:
                  selectedGeometry,

                properties:
                  (feature.properties ||
                    {}) as Record<
                    string,
                    unknown
                  >,
              });

            callbacksRef.current
              .onBoundaryChange(
                selectedGeometry
              );

            const metrics =
              calculateBoundaryMetrics(
                selectedGeometry
              );

            callbacksRef.current
              .onBoundaryMetricsChange?.(
                metrics
              );

            fitFarmBoundary(
              map,
              selectedGeometry
            );
          }
        }
      }
    );

    /* =====================================================
       SYNCHRONIZE DRAWN BOUNDARY
    ===================================================== */

    const syncBoundary =
      () => {
        if (
          boundarySyncRef.current
        ) {
          return;
        }

        const collection =
          draw.getAll();

        const polygons =
          collection.features.filter(
            (feature) =>
              feature.geometry
                .type === "Polygon"
          );

        if (
          polygons.length === 0
        ) {
          callbacksRef.current
            .onBoundaryChange(
              null
            );

          callbacksRef.current
            .onBoundaryMetricsChange?.(
              null
            );

          return;
        }

        const latest =
          polygons[
            polygons.length - 1
          ];

        /* -----------------------------------------------
           Keep only the latest farmer-drawn polygon.
        ------------------------------------------------ */

        if (
          polygons.length > 1
        ) {
          polygons
            .slice(0, -1)
            .forEach(
              (feature) => {
                if (
                  feature.id !==
                  undefined
                ) {
                  draw.delete(
                    String(
                      feature.id
                    )
                  );
                }
              }
            );
        }

        if (
          latest.geometry
            .type !== "Polygon"
        ) {
          return;
        }

        const newBoundary:
          FarmPolygonGeometry = {
          type: "Polygon",

          coordinates:
            latest.geometry
              .coordinates as [
              number,
              number
            ][][],
        };

        const metrics =
          calculateBoundaryMetrics(
            newBoundary
          );

        callbacksRef.current
          .onBoundaryChange(
            newBoundary
          );

        callbacksRef.current
          .onBoundaryMetricsChange?.(
            metrics
          );

        fitFarmBoundary(
          map,
          newBoundary
        );
      };

    /* =====================================================
       DRAW EVENTS
    ===================================================== */

    const drawEventMap =
      map as unknown as {
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

    /* =====================================================
       SAVE REFERENCES
    ===================================================== */

    mapRef.current = map;

    drawRef.current = draw;

    markerRef.current = marker;

    /* =====================================================
       CLEANUP
    ===================================================== */

    return () => {
      marker.remove();

      map.remove();

      mapRef.current = null;

      drawRef.current = null;

      markerRef.current = null;
    };
  }, [
    accessToken,
    dropPinMode,
    cadastralGeoJson,
  ]);

  /* =========================================================
     UPDATE FARM LOCATION
  ========================================================= */

  useEffect(() => {
    const map =
      mapRef.current;

    const marker =
      markerRef.current;

    if (
      !map ||
      !marker
    ) {
      return;
    }

    const next:
      [number, number] = [
      location.longitude,
      location.latitude,
    ];

    marker.setLngLat(next);

    const zoom =
      getGpsZoom(
        location.accuracy
      );

    map.flyTo({
      center: next,

      zoom,

      pitch: 0,

      bearing: 0,

      duration: 1300,

      essential: true,
    });
  }, [
    location.latitude,
    location.longitude,
    location.accuracy,
  ]);

  /* =========================================================
     DROP PIN CURSOR
  ========================================================= */

  useEffect(() => {
    const map =
      mapRef.current;

    if (!map) {
      return;
    }

    if (dropPinMode) {
      map.getCanvas()
        .dataset.dropPin =
        "true";

      map.getCanvas()
        .style.cursor =
        "crosshair";
    } else {
      delete map.getCanvas()
        .dataset.dropPin;

      map.getCanvas()
        .style.cursor = "";
    }
  }, [
    dropPinMode,
  ]);

  /* =========================================================
     START DRAW
  ========================================================= */

  useEffect(() => {
    if (
      startDrawSignal === 0
    ) {
      return;
    }

    const draw =
      drawRef.current;

    if (!draw) {
      return;
    }

    draw.deleteAll();

    callbacksRef.current
      .onBoundaryChange(
        null
      );

    callbacksRef.current
      .onBoundaryMetricsChange?.(
        null
      );

    draw.changeMode(
      "draw_polygon"
    );
  }, [
    startDrawSignal,
  ]);

  /* =========================================================
     CLEAR DRAW
  ========================================================= */

  useEffect(() => {
    if (
      clearDrawSignal === 0
    ) {
      return;
    }

    const draw =
      drawRef.current;

    if (!draw) {
      return;
    }

    draw.deleteAll();

    callbacksRef.current
      .onBoundaryChange(
        null
      );

    callbacksRef.current
      .onBoundaryMetricsChange?.(
        null
      );
  }, [
    clearDrawSignal,
  ]);

  /* =========================================================
     SYNC EXTERNAL BOUNDARY
  ========================================================= */

  useEffect(() => {
    const draw =
      drawRef.current;

    const map =
      mapRef.current;

    if (
      !draw ||
      !map
    ) {
      return;
    }

    const current =
      draw.getAll();

    /* -----------------------------------------------
       Remove map boundary when parent clears it.
    ------------------------------------------------ */

    if (
      boundary === null &&
      current.features.length >
        0
    ) {
      boundarySyncRef.current =
        true;

      draw.deleteAll();

      boundarySyncRef.current =
        false;

      return;
    }

    /* -----------------------------------------------
       Add parent boundary to map.
    ------------------------------------------------ */

    if (
      boundary &&
      current.features.length ===
        0
    ) {
      boundarySyncRef.current =
        true;

      draw.add({
        type: "Feature",

        properties: {},

        geometry:
          boundary,
      });

      boundarySyncRef.current =
        false;

      const metrics =
        calculateBoundaryMetrics(
          boundary
        );

      callbacksRef.current
        .onBoundaryMetricsChange?.(
          metrics
        );

      fitFarmBoundary(
        map,
        boundary
      );
    }
  }, [
    boundary,
  ]);

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div
      ref={containerRef}
      className="h-[520px] w-full overflow-hidden rounded-[24px] bg-[#0b2a1e] sm:h-[610px]"
    />
  );
}