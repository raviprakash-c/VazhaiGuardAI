import {
  CheckCircle2,
  LocateFixed,
  MapPin,
  Navigation,
} from "lucide-react";

import { Button } from "../ui/button";

type Props = {
  latitude: number | null;
  longitude: number | null;
  confirmed: boolean;

  isLocating: boolean;
  error: string;

  onGetLocation: () => void;
  onConfirm: () => void;
};

export default function FarmLocationStep({
  latitude,
  longitude,
  confirmed,
  isLocating,
  error,
  onGetLocation,
  onConfirm,
}: Props) {
  const hasLocation =
    latitude !== null &&
    longitude !== null;

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#146c43]">
          Step 1
        </p>

        <h2 className="vg-heading mt-1 text-2xl font-bold text-[#13271d]">
          Where is your farm?
        </h2>

        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          VazhaiGuard uses your farm location to connect live
          weather and later identify the farm boundary.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-[26px] border border-[#dce8df] bg-[#edf6ef] p-6 sm:p-8">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#b8df4b]/20 blur-3xl" />

        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#073b2a] shadow-lg">
            <MapPin className="h-6 w-6 text-[#b8df4b]" />
          </div>

          <h3 className="mt-5 text-lg font-semibold text-[#13271d]">
            Detect farm location
          </h3>

          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Stand at or near your farm and allow location access.
            You do not need to type latitude or longitude.
          </p>

          <Button
            onClick={onGetLocation}
            disabled={isLocating}
            className="mt-5 h-11 rounded-xl bg-[#0b4d36] px-5 text-white hover:bg-[#073b2a]"
          >
            <LocateFixed className="mr-2 h-4 w-4" />

            {isLocating
              ? "Finding location..."
              : hasLocation
                ? "Detect again"
                : "Use my current location"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {hasLocation && (
        <div className="mt-5 rounded-[24px] border border-border bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f5eb]">
                <Navigation className="h-5 w-5 text-[#146c43]" />
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Detected coordinates
                </p>

                <p className="mt-1 text-sm font-semibold text-[#13271d]">
                  {latitude.toFixed(6)}, {longitude.toFixed(6)}
                </p>
              </div>
            </div>

            {!confirmed ? (
              <Button
                onClick={onConfirm}
                className="rounded-xl bg-[#b8df4b] text-[#073b2a] hover:bg-[#c8e95f]"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm location
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-[#e6f6ea] px-3 py-2 text-xs font-semibold text-[#177944]">
                <CheckCircle2 className="h-4 w-4" />
                Location confirmed
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}