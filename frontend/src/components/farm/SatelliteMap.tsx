import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import area from "@turf/area";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

/* =========================================================
   TYPES
========================================================= */

export type FarmGeometry =
  | {
      type: "Polygon";
      coordinates: [number, number][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: [number, number][][][];
    };

type FarmMapLocation = {
  latitude: number;
  longitude: number;
  label?: string;
  accuracy?: number;
};

export type PlotSelectData = {
  geometry: FarmGeometry;
  properties?: Record<string, unknown>;
};

type BoundaryMetrics = {
  areaAcres: number;
  perimeterM: number;
};

type Props = {
  accessToken: string;

  location: FarmMapLocation;

  boundary: FarmGeometry | null;

  startDrawSignal: number;

  clearDrawSignal: number;

  dropPinMode: boolean;

  cadastralGeoJson?: GeoJSON.FeatureCollection;

  selectedParcelId?: string | null;

  onLocationChange: (
    location: FarmMapLocation
  ) => void;

  onBoundaryChange: (
    boundary: FarmGeometry | null
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

const DEFAULT_ZOOM = 17;

const FARM_FOCUS_ZOOM = 19;

/* =========================================================
   GEO HELPERS
========================================================= */

function distanceInMeters(
  first: [number, number],
  second: [number, number]
): number {
  const [lon1, lat1] = first;
  const [lon2, lat2] = second;

  const earthRadius = 6371008.8;

  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180;

  const latitudeDifference = toRadians(
    lat2 - lat1
  );

  const longitudeDifference = toRadians(
    lon2 - lon1
  );

  const latitude1 = toRadians(lat1);
  const latitude2 = toRadians(lat2);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDifference / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
}

function perimeterForRing(
  ring: [number, number][]
): number {
  if (!ring || ring.length < 2) {
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

function calculatePerimeter(
  geometry: FarmGeometry
): number {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.reduce(
      (total, ring) =>
        total + perimeterForRing(ring),
      0
    );
  }

  return geometry.coordinates.reduce(
    (polygonTotal, polygon) =>
      polygonTotal +
      polygon.reduce(
        (ringTotal, ring) =>
          ringTotal + perimeterForRing(ring),
        0
      ),
    0
  );
}

function calculateBoundaryMetrics(
  geometry: FarmGeometry
): BoundaryMetrics {
  const polygon = {
    type: "Feature" as const,
    properties: {},
    geometry,
  };

  const areaSquareMeters = area(polygon);

  const areaAcres =
    areaSquareMeters / 4046.8564224;

  const perimeterM =
    calculatePerimeter(geometry);

  return {
    areaAcres: Number(
      areaAcres.toFixed(4)
    ),
    perimeterM: Number(
      perimeterM.toFixed(2)
    ),
  };
}

/* =========================================================
   BOUNDS
========================================================= */

function extendBoundsFromCoordinates(
  bounds: mapboxgl.LngLatBounds,
  coordinates: any
) {
  if (!Array.isArray(coordinates)) {
    return;
  }

  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    bounds.extend([
      coordinates[0],
      coordinates[1],
    ]);

    return;
  }

  coordinates.forEach((child) => {
    extendBoundsFromCoordinates(
      bounds,
      child
    );
  });
}

function fitGeometry(
  map: mapboxgl.Map,
  geometry: FarmGeometry
) {
  const bounds =
    new mapboxgl.LngLatBounds();

  extendBoundsFromCoordinates(
    bounds,
    geometry.coordinates
  );

  if (bounds.isEmpty()) {
    return;
  }

  map.fitBounds(bounds, {
    padding: 80,
    maxZoom: 20,
    duration: 1000,
    essential: true,
  });
}

/* =========================================================
   COMPONENT
========================================================= */

export default function SatelliteMap({
  accessToken,
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

  const cadastralGeoJsonRef =
    useRef(cadastralGeoJson);

  const selectedParcelIdRef =
    useRef(selectedParcelId);

  const callbacksRef = useRef({
    onLocationChange,
    onBoundaryChange,
    onBoundaryMetricsChange,
    onPlotSelect,
  });

  /* -------------------------------------------------------
     KEEP CALLBACKS CURRENT
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     KEEP DATA REFS CURRENT
  ------------------------------------------------------- */

  useEffect(() => {
    cadastralGeoJsonRef.current =
      cadastralGeoJson;
  }, [cadastralGeoJson]);

  useEffect(() => {
    selectedParcelIdRef.current =
      selectedParcelId;
  }, [selectedParcelId]);

  /* =======================================================
     CREATE MAP
  ======================================================= */

  useEffect(() => {
    if (
      !containerRef.current ||
      mapRef.current ||
      !accessToken
    ) {
      return;
    }

    mapboxgl.accessToken = accessToken;

    const map =
      new mapboxgl.Map({
        container: containerRef.current,

        style:
          "mapbox://styles/mapbox/satellite-streets-v12",

        center: [
          location.longitude,
          location.latitude,
        ],

        zoom: DEFAULT_ZOOM,

        pitch: 0,

        bearing: 0,

        minZoom: 10,

        maxZoom: 21,
      });

    /* -----------------------------------------------------
       DRAW CONTROL
    ----------------------------------------------------- */

    const draw =
      new MapboxDraw({
        displayControlsDefault: false,

        controls: {
          polygon: true,
          trash: true,
        },

        styles: [
          {
            id: "vg-draw-fill",

            type: "fill",

            filter: [
              "all",
              ["==", "$type", "Polygon"],
            ],

            paint: {
              "fill-color": "#b8df4b",

              "fill-opacity": 0.25,
            },
          },

          {
            id: "vg-draw-line",

            type: "line",

            filter: [
              "all",
              ["==", "$type", "Polygon"],
            ],

            paint: {
              "line-color": "#b8df4b",

              "line-width": 4,

              "line-opacity": 0.95,
            },
          },

          {
            id:
              "vg-draw-polygon-and-line-vertex-halo-active",

            type: "circle",

            filter: [
              "all",
              ["==", "meta", "vertex"],
              ["==", "$type", "Point"],
              ["==", "meta", "feature"],
            ],

            paint: {
              "circle-radius": 8,

              "circle-color": "#ffffff",
            },
          },

          {
            id:
              "vg-draw-polygon-and-line-vertex-active",

            type: "circle",

            filter: [
              "all",
              ["==", "meta", "vertex"],
              ["==", "$type", "Point"],
              ["==", "meta", "feature"],
            ],

            paint: {
              "circle-radius": 5,

              "circle-color": "#146c43",
            },
          },
        ],
      });

    /* -----------------------------------------------------
       MARKER
    ----------------------------------------------------- */

    const marker =
      new mapboxgl.Marker({
        color: "#b8df4b",
      })
        .setLngLat([
          location.longitude,
          location.latitude,
        ])
        .addTo(map);

    /* -----------------------------------------------------
       MAP CONTROLS
    ----------------------------------------------------- */

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
       MAP LOAD
    ===================================================== */

    map.on("load", () => {
      const geojson =
        cadastralGeoJsonRef.current;

      if (!geojson) {
        return;
      }

      if (
        !map.getSource("vg-cadastral")
      ) {
        map.addSource("vg-cadastral", {
          type: "geojson",

          data: geojson,
        });
      }

      if (
        !map.getLayer("vg-cadastral-fill")
      ) {
        map.addLayer({
          id: "vg-cadastral-fill",

          type: "fill",

          source: "vg-cadastral",

          paint: {
            "fill-color": [
              "case",

              [
                "==",

                [
                  "get",
                  "parcel_id",
                ],

                selectedParcelIdRef.current ||
                  "",
              ],

              "#b8df4b",

              "#7fc97f",
            ],

            "fill-opacity": [
              "case",

              [
                "==",

                [
                  "get",
                  "parcel_id",
                ],

                selectedParcelIdRef.current ||
                  "",
              ],

              0.48,

              0.16,
            ],
          },
        });
      }

      if (
        !map.getLayer("vg-cadastral-line")
      ) {
        map.addLayer({
          id: "vg-cadastral-line",

          type: "line",

          source: "vg-cadastral",

          paint: {
            "line-color": [
              "case",

              [
                "==",

                [
                  "get",
                  "parcel_id",
                ],

                selectedParcelIdRef.current ||
                  "",
              ],

              "#b8df4b",

              "#ffffff",
            ],

            "line-width": [
              "case",

              [
                "==",

                [
                  "get",
                  "parcel_id",
                ],

                selectedParcelIdRef.current ||
                  "",
              ],

              4,

              1.5,
            ],

            "line-opacity": 0.9,
          },
        });
      }
    });

    /* =====================================================
       MAP CLICK
    ===================================================== */

    map.on("click", (event) => {
      /* ---------------------------------------------------
         GPS PIN MODE
      --------------------------------------------------- */

      if (dropPinMode) {
        const lat = event.lngLat.lat;

        const lng = event.lngLat.lng;

        callbacksRef.current.onLocationChange({
          latitude: lat,

          longitude: lng,

          label:
            "Farmer selected farm centre",
        });

        map.flyTo({
          center: [lng, lat],

          zoom: FARM_FOCUS_ZOOM,

          duration: 1000,

          essential: true,
        });

        return;
      }

      /* ---------------------------------------------------
         CADASTRAL PARCEL MODE
      --------------------------------------------------- */

      if (
        !map.getLayer(
          "vg-cadastral-fill"
        )
      ) {
        return;
      }

      const features =
        map.queryRenderedFeatures(
          event.point,
          {
            layers: [
              "vg-cadastral-fill",
            ],
          }
        );

      const feature = features[0];

      if (!feature) {
        return;
      }

      if (
        !feature.geometry ||
        !(
          feature.geometry.type ===
            "Polygon" ||
          feature.geometry.type ===
            "MultiPolygon"
        )
      ) {
        return;
      }

      const geometry =
        feature.geometry as FarmGeometry;

      callbacksRef.current.onPlotSelect?.({
        geometry,

        properties:
          (feature.properties ||
            {}) as Record<
            string,
            unknown
          >,
      });

      fitGeometry(
        map,
        geometry
      );
    });

    /* =====================================================
       DRAW SYNCHRONIZATION
    ===================================================== */

    const syncBoundary = () => {
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
            feature.geometry.type ===
            "Polygon"
        );

      if (
        polygons.length === 0
      ) {
        callbacksRef.current.onBoundaryChange(
          null
        );

        callbacksRef.current.onBoundaryMetricsChange?.(
          null
        );

        return;
      }

      const latest =
        polygons[
          polygons.length - 1
        ];

      if (
        polygons.length > 1
      ) {
        polygons
          .slice(0, -1)
          .forEach((feature) => {
            if (
              feature.id !==
              undefined
            ) {
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

      const newBoundary: FarmGeometry =
        {
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

      callbacksRef.current.onBoundaryChange(
        newBoundary
      );

      callbacksRef.current.onBoundaryMetricsChange?.(
        metrics
      );

      fitGeometry(
        map,
        newBoundary
      );
    };

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

  /* =======================================================
     UPDATE CADASTRAL GEOJSON
  ======================================================= */

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const source =
      map.getSource(
        "vg-cadastral"
      ) as mapboxgl.GeoJSONSource | undefined;

    if (!source) {
      return;
    }

    if (cadastralGeoJson) {
      source.setData(
        cadastralGeoJson as any
      );
    }
  }, [cadastralGeoJson]);

  /* =======================================================
     UPDATE SELECTED PARCEL
  ======================================================= */

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (
      !map.getLayer(
        "vg-cadastral-fill"
      )
    ) {
      return;
    }

    map.setPaintProperty(
      "vg-cadastral-fill",
      "fill-color",
      [
        "case",

        [
          "==",

          [
            "get",
            "parcel_id",
          ],

          selectedParcelId ||
            "",
        ],

        "#b8df4b",

        "#7fc97f",
      ]
    );

    map.setPaintProperty(
      "vg-cadastral-fill",
      "fill-opacity",
      [
        "case",

        [
          "==",

          [
            "get",
            "parcel_id",
          ],

          selectedParcelId ||
            "",
        ],

        0.48,

        0.16,
      ]
    );

    if (
      map.getLayer(
        "vg-cadastral-line"
      )
    ) {
      map.setPaintProperty(
        "vg-cadastral-line",
        "line-color",
        [
          "case",

          [
            "==",

            [
              "get",
              "parcel_id",
            ],

            selectedParcelId ||
              "",
          ],

          "#b8df4b",

          "#ffffff",
        ]
      );

      map.setPaintProperty(
        "vg-cadastral-line",
        "line-width",
        [
          "case",

          [
            "==",

            [
              "get",
              "parcel_id",
            ],

            selectedParcelId ||
              "",
          ],

          4,

          1.5,
        ]
      );
    }
  }, [selectedParcelId]);

  /* =======================================================
     LOCATION UPDATE
  ======================================================= */

  useEffect(() => {
    const map = mapRef.current;

    const marker =
      markerRef.current;

    if (!map || !marker) {
      return;
    }

    const next: [
      number,
      number
    ] = [
      location.longitude,
      location.latitude,
    ];

    marker.setLngLat(next);

    if (dropPinMode) {
      map.flyTo({
        center: next,

        zoom:
          location.accuracy &&
          location.accuracy <= 30
            ? 18
            : 16.5,

        duration: 900,

        essential: true,
      });
    }
  }, [
    location.latitude,
    location.longitude,
    location.accuracy,
    dropPinMode,
  ]);

  /* =======================================================
     CURSOR
  ======================================================= */

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    map.getCanvas().style.cursor =
      dropPinMode
        ? "crosshair"
        : "";
  }, [dropPinMode]);

  /* =======================================================
     START DRAW
  ======================================================= */

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

    callbacksRef.current.onBoundaryChange(
      null
    );

    callbacksRef.current.onBoundaryMetricsChange?.(
      null
    );

    draw.changeMode(
      "draw_polygon"
    );
  }, [startDrawSignal]);

  /* =======================================================
     CLEAR DRAW
  ======================================================= */

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

    callbacksRef.current.onBoundaryChange(
      null
    );

    callbacksRef.current.onBoundaryMetricsChange?.(
      null
    );
  }, [clearDrawSignal]);

  /* =======================================================
     SYNC EXTERNAL BOUNDARY
  ======================================================= */

  useEffect(() => {
    const draw =
      drawRef.current;

    const map =
      mapRef.current;

    if (!draw || !map) {
      return;
    }

    const current =
      draw.getAll();

    if (
      boundary === null &&
      current.features.length > 0
    ) {
      boundarySyncRef.current =
        true;

      draw.deleteAll();

      boundarySyncRef.current =
        false;

      return;
    }

    /*
     * MapboxDraw cannot directly edit
     * MultiPolygon geometry.
     *
     * MultiPolygon cadastral boundaries
     * remain rendered by the cadastral
     * layer. Editing creates a new Polygon.
     */

    if (
      boundary &&
      boundary.type ===
        "Polygon" &&
      current.features.length === 0
    ) {
      boundarySyncRef.current =
        true;

      draw.add({
        type: "Feature",

        properties: {},

        geometry: boundary,
      });

      boundarySyncRef.current =
        false;

      const metrics =
        calculateBoundaryMetrics(
          boundary
        );

      callbacksRef.current.onBoundaryMetricsChange?.(
        metrics
      );

      fitGeometry(
        map,
        boundary
      );
    }
  }, [boundary]);

  return (
    <div
      ref={containerRef}
      className="h-[520px] w-full overflow-hidden rounded-[24px] bg-[#0b2a1e] shadow-inner sm:h-[610px]"
    />
  );
}