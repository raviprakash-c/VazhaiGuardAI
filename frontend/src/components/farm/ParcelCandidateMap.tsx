import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { ParcelCandidate } from "../../types/farmMap";

import "mapbox-gl/dist/mapbox-gl.css";


type Props = {
  accessToken?: string;
  candidates: ParcelCandidate[];
  selected: ParcelCandidate | null;
  onSelect: (candidate: ParcelCandidate) => void;
};


export default function ParcelCandidateMap({
  accessToken,
  candidates,
  selected,
  onSelect,
}: Props) {

  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const mapRef =
    useRef<mapboxgl.Map | null>(null);


  useEffect(() => {

    if (
      !containerRef.current ||
      !accessToken ||
      candidates.length === 0
    ) {
      return;
    }


    mapboxgl.accessToken =
      accessToken;


    const first =
      candidates.find(
        candidate =>
          candidate.centroid
      );


    const map =
      new mapboxgl.Map({
        container:
          containerRef.current,

        style:
          "mapbox://styles/mapbox/satellite-streets-v12",

        center: first?.centroid
          ? [
              first.centroid.longitude,
              first.centroid.latitude,
            ]
          : [78.1, 8.8],

        zoom: 14,
      });


    mapRef.current = map;


    map.addControl(
      new mapboxgl.NavigationControl(),
      "top-right"
    );


    map.on(
      "load",
      () => {

        candidates.forEach(
          (candidate, index) => {

            const sourceId =
              `parcel-${index}`;

            const layerId =
              `parcel-fill-${index}`;


            map.addSource(
              sourceId,
              {
                type: "geojson",

                data: {
                  type: "Feature",

                  properties:
                    candidate.properties,

                  geometry:
                    candidate.geometry,
                },
              }
            );


            map.addLayer({
              id: layerId,

              type: "fill",

              source: sourceId,

              paint: {
                "fill-opacity":
                  selected === candidate
                    ? 0.55
                    : 0.25,
              },
            });


            map.addLayer({
              id:
                `parcel-line-${index}`,

              type: "line",

              source: sourceId,

              paint: {
                "line-width":
                  selected === candidate
                    ? 4
                    : 2,
              },
            });


            map.on(
              "click",
              layerId,
              () => {
                onSelect(candidate);
              }
            );


            map.on(
              "mouseenter",
              layerId,
              () => {
                map.getCanvas().style.cursor =
                  "pointer";
              }
            );


            map.on(
              "mouseleave",
              layerId,
              () => {
                map.getCanvas().style.cursor =
                  "";
              }
            );

          }
        );
      }
    );


    return () => {

      map.remove();

      mapRef.current =
        null;

    };

  }, [
    accessToken,
    candidates,
    onSelect,
    selected,
  ]);


  if (!accessToken) {

    return (
      <div className="flex h-[500px] items-center justify-center bg-slate-100 p-6 text-center">
        <div>
          <p className="font-semibold">
            Mapbox token missing
          </p>

          <p className="mt-2 text-sm text-slate-600">
            Add VITE_MAPBOX_TOKEN to the frontend .env file.
          </p>
        </div>
      </div>
    );
  }


  if (!candidates.length) {

    return (
      <div className="flex h-[500px] items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-600">
          No reference parcels found.
        </p>
      </div>
    );
  }


  return (
    <div
      ref={containerRef}
      className="h-[500px] w-full"
    />
  );
}