import { useEffect, useRef } from "react";
import L from "leaflet";
import type { ParcelCandidate } from "../../types/farmMap";

import "leaflet/dist/leaflet.css";

type Props = {
  /* Kept for backwards compatibility. No Mapbox token is required. */
  accessToken?: string;
  candidates: ParcelCandidate[];
  selected: ParcelCandidate | null;
  onSelect: (candidate: ParcelCandidate) => void;
};

export default function ParcelCandidateMap({
  candidates,
  selected,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const first = candidates.find((candidate) => candidate.centroid);
    const center: L.LatLngExpression = first?.centroid
      ? [first.centroid.latitude, first.centroid.longitude]
      : [8.8, 78.1];

    const map = L.map(containerRef.current, {
      zoomControl: false,
      preferCanvas: true,
    }).setView(center, 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 21,
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);
    L.control.scale({ position: "bottomright", imperial: true, metric: true }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (!candidates.length) return;

    const layer = L.geoJSON(
      {
        type: "FeatureCollection",
        features: candidates
          .filter((candidate) => Boolean(candidate.geometry))
          .map((candidate) => ({
            type: "Feature",
            properties: {
              parcel_id: candidate.parcel_id,
            },
            geometry: candidate.geometry,
          })),
      } as GeoJSON.FeatureCollection,
      {
        style: (feature) => {
          const id = String(feature?.properties?.parcel_id || "");
          const isSelected = selected?.parcel_id === id;
          return {
            color: isSelected ? "#073b2a" : "#7fc97f",
            weight: isSelected ? 4 : 2,
            fillColor: isSelected ? "#b8df4b" : "#7fc97f",
            fillOpacity: isSelected ? 0.45 : 0.2,
          };
        },
        onEachFeature: (feature, featureLayer) => {
          const parcel = candidates.find(
            (candidate) =>
              String(candidate.parcel_id) ===
              String(feature.properties?.parcel_id || ""),
          );
          if (!parcel) return;

          featureLayer.bindTooltip(
            String(parcel.parcel_id || "Reference parcel"),
            { sticky: true },
          );

          featureLayer.on("click", (event: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(event);
            onSelect(parcel);
          });
        },
      },
    ).addTo(map);

    layerRef.current = layer;

    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 17,
      });
    }
  }, [candidates, selected, onSelect]);

  if (!candidates.length) {
    return (
      <div className="flex h-[500px] items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-600">
          No reference parcels found.
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className="h-[500px] w-full" />;
}
