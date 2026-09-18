import {
  Crosshair,
  LocateFixed,
  MapPinned,
  PencilRuler,
  RotateCcw,
  Search,
} from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";

import SatelliteMap from "./SatelliteMap";

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
  searchText: string;
  searchLabel: string;
  isSearching: boolean;
  isLocating: boolean;
  locationError: string;
  startDrawSignal: number;
  clearDrawSignal: number;
  dropPinMode: boolean;
  onSearchTextChange: (
    value: string
  ) => void;
  onSearch: () => void;
  onUseCurrentLocation: () => void;
  onToggleDropPin: () => void;
  onStartDraw: () => void;
  onClearBoundary: () => void;
  onLocationChange: (
    location: FarmMapLocation
  ) => void;
  onBoundaryChange: (
    boundary: FarmPolygonGeometry | null
  ) => void;
};

export default function FarmBoundaryEditor({
  accessToken,
  location,
  boundary,
  searchText,
  searchLabel,
  isSearching,
  isLocating,
  locationError,
  startDrawSignal,
  clearDrawSignal,
  dropPinMode,
  onSearchTextChange,
  onSearch,
  onUseCurrentLocation,
  onToggleDropPin,
  onStartDraw,
  onClearBoundary,
  onLocationChange,
  onBoundaryChange,
}: Props) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[#d7e5db] bg-white shadow-[0_18px_60px_rgba(7,59,42,0.08)]">
      <div className="border-b border-border bg-[#f8fbf8] p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 gap-2">
            <Input
              value={searchText}
              onChange={(event) =>
                onSearchTextChange(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter"
                ) {
                  onSearch();
                }
              }}
              placeholder="Search village, town or landmark..."
              className="h-11 rounded-xl bg-white"
            />

            <Button
              type="button"
              variant="outline"
              onClick={onSearch}
              disabled={isSearching}
              className="h-11 shrink-0 rounded-xl"
            >
              <Search className="mr-2 h-4 w-4" />
              {isSearching
                ? "Searching..."
                : "Search"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={onUseCurrentLocation}
              disabled={isLocating}
              className="h-11 rounded-xl bg-[#073b2a] text-white hover:bg-[#0b4d36]"
            >
              <LocateFixed className="mr-2 h-4 w-4" />
              {isLocating
                ? "Locating..."
                : "Use My Location"}
            </Button>

            <Button
              type="button"
              variant={
                dropPinMode
                  ? "default"
                  : "outline"
              }
              onClick={onToggleDropPin}
              className="h-11 rounded-xl"
            >
              <Crosshair className="mr-2 h-4 w-4" />
              {dropPinMode
                ? "Tap Map Now"
                : "Drop Pin"}
            </Button>

            <Button
              type="button"
              onClick={onStartDraw}
              className="h-11 rounded-xl bg-[#b8df4b] text-[#073b2a] hover:bg-[#c8e95f]"
            >
              <PencilRuler className="mr-2 h-4 w-4" />
              Draw Farm Boundary
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onClearBoundary}
              disabled={!boundary}
              className="h-11 rounded-xl"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        {(searchLabel ||
          locationError) && (
          <div className="mt-3 flex items-start gap-2 text-xs">
            <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-[#146c43]" />
            <p
              className={
                locationError
                  ? "text-red-600"
                  : "text-muted-foreground"
              }
            >
              {locationError ||
                searchLabel}
            </p>
          </div>
        )}
      </div>

      <div className="relative p-3 sm:p-4">
        <SatelliteMap
          accessToken={accessToken}
          location={location}
          boundary={boundary}
          startDrawSignal={
            startDrawSignal
          }
          clearDrawSignal={
            clearDrawSignal
          }
          dropPinMode={dropPinMode}
          onLocationChange={
            onLocationChange
          }
          onBoundaryChange={
            onBoundaryChange
          }
        />

        <div className="pointer-events-none absolute bottom-7 left-7 rounded-2xl border border-white/25 bg-[#052f22]/85 px-4 py-3 text-white shadow-xl backdrop-blur-md">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c9ef93]">
            Farmer location
          </p>
          <p className="mt-1 text-xs font-medium">
            {location.latitude.toFixed(6)}, {" "}
            {location.longitude.toFixed(6)}
          </p>
        </div>
      </div>
    </div>
  );
}
