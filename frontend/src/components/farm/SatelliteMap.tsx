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
  accuracy?: number;
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


// =====================================================
// MAP ZOOM SETTINGS
// =====================================================

const DEFAULT_ZOOM = 18.5;

const FARM_FOCUS_ZOOM = 19.5;


// =====================================================
// GPS ACCURACY → ZOOM
// =====================================================

function getGpsZoom(
  accuracy?: number
) {
  // If GPS accuracy is unavailable,
  // use normal farm-location zoom.
  if (
    accuracy === undefined ||
    !Number.isFinite(accuracy)
  ) {
    return DEFAULT_ZOOM;
  }

  // Very accurate GPS.
  if (accuracy <= 15) {
    return 19;
  }

  // Acceptable GPS accuracy.
  if (accuracy <= 40) {
    return 18;
  }

  // Poor GPS accuracy.
  return 16.5;
}


// =====================================================
// FIT WHOLE FARM BOUNDARY
// =====================================================

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
      padding: 70,

      // Don't zoom excessively close
      // after fitting the complete farm.
      maxZoom: 20,

      duration: 1000,

      essential: true,
    }
  );
}


// =====================================================
// COMPONENT
// =====================================================

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

  const callbacksRef =
    useRef({
      onLocationChange,
      onBoundaryChange,
    });


  // ===================================================
  // KEEP CALLBACKS UPDATED
  // ===================================================

  useEffect(() => {

    callbacksRef.current = {
      onLocationChange,
      onBoundaryChange,
    };

  }, [
    onLocationChange,
    onBoundaryChange,
  ]);


  // ===================================================
  // CREATE MAP
  // ===================================================

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
          "mapbox://styles/mapbox/standard-satellite",

        center: [
          firstLocation.longitude,
          firstLocation.latitude,
        ],

        zoom:
          DEFAULT_ZOOM,

        pitch: 0,

        bearing: 0,

        minZoom: 10,

        maxZoom: 21,

        attributionControl:
          true,

        // ===========================================
        // CLEAN SATELLITE MODE
        // ===========================================

        config: {
          basemap: {

            showRoadsAndTransit:
              false,

            showPedestrianRoads:
              false,

            showPlaceLabels:
              false,

            showPointOfInterestLabels:
              false,

            showRoadLabels:
              false,

            showTransitLabels:
              false,

            showAdminBoundaries:
              false,
          },
        },
      });


    // =================================================
    // DRAW
    // =================================================

    const draw =
      new MapboxDraw({
        displayControlsDefault:
          false,

        controls: {
          polygon: true,
          trash: true,
        },
      });


    // =================================================
    // FARM LOCATION MARKER
    // =================================================

    const marker =
      new mapboxgl.Marker({
        color: "#b8df4b",
      })
        .setLngLat([
          firstLocation.longitude,
          firstLocation.latitude,
        ])
        .addTo(map);


    // =================================================
    // MAP CONTROLS
    // =================================================

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


    // =================================================
    // BOUNDARY SYNCHRONIZATION
    // =================================================

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

        callbacksRef.current
          .onBoundaryChange(null);

        return;
      }


      const latest =
        polygons[
          polygons.length - 1
        ];


      // Keep only the latest polygon.
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
        latest.geometry.type !==
        "Polygon"
      ) {
        return;
      }


      const newBoundary: FarmPolygonGeometry =
        {
          type: "Polygon",

          coordinates:
            latest.geometry
              .coordinates as [
              number,
              number
            ][][],
        };


      callbacksRef.current
        .onBoundaryChange(
          newBoundary
        );


      // =============================================
      // AUTOMATICALLY FIT NEW FARM
      // =============================================

      fitFarmBoundary(
        map,
        newBoundary
      );
    };


    // =================================================
    // DRAW EVENTS
    // =================================================

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


    // =================================================
    // FARM LOCATION SELECTION
    // =================================================

    map.on(
      "click",
      (event) => {

        if (
          map
            .getCanvas()
            .dataset
            .dropPin !==
          "true"
        ) {
          return;
        }


        const latitude =
          event.lngLat.lat;

        const longitude =
          event.lngLat.lng;


        callbacksRef.current
          .onLocationChange({

            latitude,

            longitude,

            label:
              "Farmer selected farm centre",
          });


        // ===========================================
        // AUTOMATIC FARM FOCUS
        // ===========================================

        map.flyTo({

          center: [
            longitude,
            latitude,
          ],

          zoom:
            FARM_FOCUS_ZOOM,

          pitch: 0,

          bearing: 0,

          duration:
            1400,

          essential:
            true,
        });
      }
    );


    // =================================================
    // SAVE REFERENCES
    // =================================================

    mapRef.current =
      map;

    drawRef.current =
      draw;

    markerRef.current =
      marker;


    // =================================================
    // CLEANUP
    // =================================================

    return () => {

      marker.remove();

      map.remove();

      mapRef.current =
        null;

      drawRef.current =
        null;

      markerRef.current =
        null;
    };

  }, [accessToken]);


  // =====================================================
  // LOCATION CHANGE
  // =====================================================

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


    const next: [
      number,
      number
    ] = [
      location.longitude,
      location.latitude,
    ];


    marker.setLngLat(
      next
    );


    // ================================================
    // GPS ACCURACY BASED ZOOM
    // ================================================

    const zoom =
      getGpsZoom(
        location.accuracy
      );


    map.flyTo({

      center:
        next,

      zoom,

      pitch: 0,

      bearing: 0,

      duration:
        1300,

      essential:
        true,
    });

  }, [
    location.latitude,
    location.longitude,
    location.accuracy,
  ]);


  // =====================================================
  // DROP PIN MODE
  // =====================================================

  useEffect(() => {

    const map =
      mapRef.current;


    if (!map) {
      return;
    }


    if (dropPinMode) {

      map
        .getCanvas()
        .dataset
        .dropPin =
        "true";

      map
        .getCanvas()
        .style
        .cursor =
        "crosshair";

    } else {

      delete (
        map
          .getCanvas()
          .dataset
          .dropPin
      );

      map
        .getCanvas()
        .style
        .cursor =
        "";
    }

  }, [
    dropPinMode,
  ]);


  // =====================================================
  // START DRAW
  // =====================================================

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


    draw.changeMode(
      "draw_polygon"
    );

  }, [
    startDrawSignal,
  ]);


  // =====================================================
  // CLEAR DRAW
  // =====================================================

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

  }, [
    clearDrawSignal,
  ]);


  // =====================================================
  // RESTORE SAVED BOUNDARY
  // =====================================================

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


    // -----------------------------------------------
    // Remove map polygon if React boundary is null.
    // -----------------------------------------------

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


    // -----------------------------------------------
    // Restore saved boundary.
    // -----------------------------------------------

    if (
      boundary &&
      current.features.length === 0
    ) {

      boundarySyncRef.current =
        true;


      draw.add({

        type:
          "Feature",

        properties:
          {},

        geometry:
          boundary,
      });


      boundarySyncRef.current =
        false;


      // =============================================
      // AUTOMATICALLY FIT SAVED FARM
      // =============================================

      fitFarmBoundary(
        map,
        boundary
      );
    }

  }, [
    boundary,
  ]);


  // =====================================================
  // MAP CONTAINER
  // =====================================================

  return (
    <div
      ref={
        containerRef
      }

      className="
        h-[520px]
        w-full
        overflow-hidden
        rounded-[24px]
        bg-[#0b2a1e]
        sm:h-[610px]
      "
    />
  );
}