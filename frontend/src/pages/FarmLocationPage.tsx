import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  FileSearch,
  Loader2,
  MapPinned,
  Pencil,
  RotateCcw,
  Search,
  ShieldCheck,
  Square,
  Ruler,
  X,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import SatelliteMap from "../components/farm/SatelliteMap";

import { Button } from "../components/ui/button";

import { Card } from "../components/ui/card";

import { useGeolocation } from "../hooks/useGeolocation";

import {
  saveFarmLocation,
  createFarmProfile,
  type FarmLocationSaveRequest,
  type CreateFarmProfileRequest,
  type FarmPolygonPayload,
  type BoundarySource,
} from "../services/farmMapApi";

import {
  searchFarmParcels,
  confirmFarmParcel,
  type ParcelCandidate,
  type ParcelGeometry,
} from "../services/parcelApi";

/* =========================================================
   CONFIG
========================================================= */

const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_TOKEN;

/* =========================================================
   TYPES
========================================================= */

type FarmProfile =
  Record<string, unknown>;

type BoundaryMetrics = {
  areaAcres: number;
  perimeterM: number;
};

type FarmLocationData = {
  latitude: number;
  longitude: number;
  accuracy?: number;

  boundary: ParcelGeometry | null;

  source:
    | "gps-pin"
    | "cadastral_parcel"
    | "cadastral_edited"
    | "drawn";
};

/* =========================================================
   MAIN PAGE
========================================================= */

export default function FarmLocationPage() {
  const navigate = useNavigate();

  /* -------------------------------------------------------
     FARM PROFILE
  ------------------------------------------------------- */

  const [farmProfile, setFarmProfile] =
    useState<FarmProfile | null>(null);

  /* -------------------------------------------------------
     GPS
  ------------------------------------------------------- */

  const {
    latitude,
    longitude,
    accuracy,
    loading: geoLoading,
    error: geoError,
    getCurrentLocation,
  } = useGeolocation();

  /* -------------------------------------------------------
     LOCATION
  ------------------------------------------------------- */

  const [locationData, setLocationData] =
    useState<FarmLocationData>({
      latitude: 9.5,

      longitude: 77.5,

      accuracy: undefined,

      boundary: null,

      source: "gps-pin",
    });

  /* -------------------------------------------------------
     MAP
  ------------------------------------------------------- */

  const [mapMode, setMapMode] =
    useState<
      "browse" | "drop-pin" | "draw"
    >("browse");

  const [
    startDrawSignal,
    setStartDrawSignal,
  ] = useState(0);

  const [
    clearDrawSignal,
    setClearDrawSignal,
  ] = useState(0);

  /* -------------------------------------------------------
     PARCEL SEARCH
  ------------------------------------------------------- */

  const [district, setDistrict] =
    useState("");

  const [taluk, setTaluk] =
    useState("");

  const [village, setVillage] =
    useState("");

  const [surveyNumber, setSurveyNumber] =
    useState("");

  const [subdivision, setSubdivision] =
    useState("");

  const [
    parcelCandidates,
    setParcelCandidates,
  ] = useState<ParcelCandidate[]>([]);

  const [
    selectedParcel,
    setSelectedParcel,
  ] = useState<ParcelCandidate | null>(
    null
  );

  const [
    parcelConfirmed,
    setParcelConfirmed,
  ] = useState(false);

  const [
    parcelSearching,
    setParcelSearching,
  ] = useState(false);

  const [
    parcelError,
    setParcelError,
  ] = useState("");

  /* -------------------------------------------------------
     BOUNDARY
  ------------------------------------------------------- */

  const [
    boundaryMetrics,
    setBoundaryMetrics,
  ] = useState<BoundaryMetrics | null>(
    null
  );

  /* -------------------------------------------------------
     SAVE
  ------------------------------------------------------- */

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    saveError,
    setSaveError,
  ] = useState("");

  /* =======================================================
     LOAD FARM PROFILE
  ======================================================= */

  useEffect(() => {
    const saved =
      localStorage.getItem(
        "vazhaiguard_farm_profile"
      );

    if (saved) {
      try {
        const parsed =
          JSON.parse(saved);

        if (
          parsed &&
          typeof parsed ===
            "object" &&
          !Array.isArray(parsed)
        ) {
          setFarmProfile(parsed);
        }
      } catch (error) {
        console.error(
          "Failed to parse farm profile",
          error
        );
      }
    }

    getCurrentLocation();
  }, [getCurrentLocation]);

  /* =======================================================
     GPS → LOCATION STATE
  ======================================================= */

  useEffect(() => {
    if (
      latitude !== null &&
      longitude !== null &&
      !locationData.boundary
    ) {
      setLocationData(
        (previous) => ({
          ...previous,

          latitude,

          longitude,

          accuracy,
        })
      );
    }
  }, [
    latitude,
    longitude,
    accuracy,
    locationData.boundary,
  ]);

  /* =======================================================
     SEARCHED PARCELS → GEOJSON
  ======================================================= */

  const cadastralGeoJson =
    useMemo(() => {
      return {
        type: "FeatureCollection" as const,

        features:
          parcelCandidates
            .filter(
              (parcel) =>
                parcel.geometry
            )
            .map((parcel) => ({
              type: "Feature" as const,

              id: parcel.parcel_id,

              properties: {
                parcel_id:
                  parcel.parcel_id,

                district:
                  parcel.district,

                taluk:
                  parcel.taluk,

                village:
                  parcel.village,

                survey_number:
                  parcel.survey_number,

                subdivision:
                  parcel.subdivision,

                land_id:
                  parcel.land_id,

                unit_id:
                  parcel.unit_id,

                block_id:
                  parcel.block_id,

                kide: parcel.kide,

                source_file:
                  parcel.source_file,
              },

              geometry:
                parcel.geometry as any,
            })),
      };
    }, [parcelCandidates]);

  /* =======================================================
     SEARCH
  ======================================================= */

  const handleSearch = async () => {
    if (
      !district.trim() &&
      !taluk.trim() &&
      !village.trim() &&
      !surveyNumber.trim() &&
      !subdivision.trim()
    ) {
      setParcelError(
        "Enter at least one location or survey detail."
      );

      return;
    }

    setParcelSearching(true);

    setParcelError("");

    setSelectedParcel(null);

    setParcelConfirmed(false);

    try {
      const response =
        await searchFarmParcels({
          district:
            district.trim() ||
            undefined,

          taluk:
            taluk.trim() ||
            undefined,

          village:
            village.trim() ||
            undefined,

          survey_number:
            surveyNumber.trim() ||
            undefined,

          subdivision:
            subdivision.trim() ||
            undefined,

          limit: 20,
        });

      setParcelCandidates(
        response.candidates || []
      );

      if (
        !response.candidates ||
        response.candidates.length === 0
      ) {
        setParcelError(
          "No matching parcels found. Try a broader search using district, taluk or village."
        );
      }
    } catch (error) {
      console.error(
        "Parcel search failed:",
        error
      );

      setParcelError(
        error instanceof Error
          ? error.message
          : "Unable to search parcels."
      );
    } finally {
      setParcelSearching(false);
    }
  };

  /* =======================================================
     SELECT PARCEL
  ======================================================= */

  const handleParcelSelect = (
    parcel: ParcelCandidate
  ) => {
    setSelectedParcel(parcel);

    setParcelConfirmed(false);

    setMapMode("browse");

    setLocationData(
      (previous) => ({
        ...previous,

        boundary:
          parcel.geometry,

        source:
          "cadastral_parcel",
      })
    );

    setBoundaryMetrics(null);

    setSaveError("");
  };

  /* =======================================================
     MAP CLICK → PARCEL
  ======================================================= */

  const handlePlotSelect = ({
    geometry,
    properties,
  }: {
    geometry: ParcelGeometry;
    properties?: Record<
      string,
      unknown
    >;
  }) => {
    const parcelId =
      String(
        properties?.parcel_id ||
          ""
      );

    const found =
      parcelCandidates.find(
        (parcel) =>
          parcel.parcel_id ===
          parcelId
      );

    if (found) {
      handleParcelSelect(
        found
      );

      return;
    }

    /*
     * Fallback if the map feature
     * doesn't contain parcel_id.
     */

    setLocationData(
      (previous) => ({
        ...previous,

        boundary: geometry,

        source:
          "cadastral_parcel",
      })
    );
  };

  /* =======================================================
     EDIT BOUNDARY
  ======================================================= */

  const handleEditBoundary = () => {
    setParcelConfirmed(false);

    setMapMode("draw");

    setClearDrawSignal(
      (previous) =>
        previous + 1
    );

    setStartDrawSignal(
      (previous) =>
        previous + 1
    );

    setLocationData(
      (previous) => ({
        ...previous,

        boundary: null,

        source:
          "cadastral_edited",
      })
    );

    setBoundaryMetrics(null);
  };

  /* =======================================================
     DRAWN BOUNDARY
  ======================================================= */

  const handleBoundaryChange = (
    boundary: ParcelGeometry | null
  ) => {
    setLocationData(
      (previous) => ({
        ...previous,

        boundary,

        source: boundary
          ? "cadastral_edited"
          : previous.source,
      })
    );

    if (!boundary) {
      setBoundaryMetrics(null);
    }

    if (boundary) {
      setSelectedParcel(
        (previous) =>
          previous
      );
    }
  };

  /* =======================================================
     CONFIRM PARCEL
  ======================================================= */

  const handleConfirmParcel =
    async () => {
      if (!selectedParcel) {
        setSaveError(
          "Please select a parcel first."
        );

        return;
      }

      if (!farmProfile) {
        setSaveError(
          "Farm registration details were not found. Please complete registration again."
        );

        return;
      }

      /*
       * We don't yet have the canonical
       * farm_id until /farm/location
       * creates it.
       *
       * Therefore parcel confirmation
       * is completed as part of the
       * farm-save transaction below.
       */

      setParcelConfirmed(true);

      setSaveError("");

      setMapMode("browse");

      if (
        selectedParcel.geometry
          .type === "Polygon"
      ) {
        /*
         * Polygon can use the existing
         * area/perimeter display.
         *
         * MultiPolygon remains valid,
         * but we avoid inventing an
         * acreage value here.
         */
      }
    };

  /* =======================================================
     FINAL SAVE
  ======================================================= */

  const handleSave = async () => {
    if (
      !Number.isFinite(
        locationData.latitude
      ) ||
      !Number.isFinite(
        locationData.longitude
      )
    ) {
      setSaveError(
        "Please select your farm location."
      );

      return;
    }

    if (!locationData.boundary) {
      setSaveError(
        "Please select a cadastral parcel or edit the boundary."
      );

      return;
    }

    if (!farmProfile) {
      setSaveError(
        "Farm registration details were not found. Please complete voice registration again."
      );

      return;
    }

    if (
      selectedParcel &&
      !parcelConfirmed
    ) {
      setSaveError(
        "Please confirm that the selected parcel belongs to your farm."
      );

      return;
    }

    setIsSaving(true);

    setSaveError("");

    try {
      /*
       * ----------------------------------------------------
       * STEP 1
       * Save location + selected parcel.
       * Backend creates canonical farm_id.
       * ----------------------------------------------------
       */

      const boundarySource: BoundarySource =
        selectedParcel
          ? locationData.source ===
            "cadastral_edited"
            ? "cadastral_edited"
            : "cadastral_parcel"
          : "farmer_drawn_satellite";

      const locationPayload: FarmLocationSaveRequest =
        {
          farm_profile:
            farmProfile,

          location: {
            latitude:
              locationData.latitude,

            longitude:
              locationData.longitude,

            label:
              selectedParcel
                ? "Farmer confirmed cadastral farm parcel"
                : "Farmer confirmed farm",
          },

          boundary:
            locationData.boundary as FarmPolygonPayload,

          /*
           * The current SatelliteMap
           * calculates area for both
           * Polygon and MultiPolygon.
           *
           * If metrics aren't available,
           * send 0 and let backend
           * handle/recalculate.
           */

          mapped_area_acres:
            boundaryMetrics?.areaAcres ||
            selectedParcel?.area_acres ||
            0,

          perimeter_m:
            boundaryMetrics?.perimeterM ||
            0,

          farmer_confirmed:
            true,

          boundary_source:
            boundarySource,

          parcel_id:
            selectedParcel?.parcel_id,

          parcel_metadata:
            selectedParcel
              ? {
                  district:
                    selectedParcel.district,

                  taluk:
                    selectedParcel.taluk,

                  village:
                    selectedParcel.village,

                  survey_number:
                    selectedParcel.survey_number,

                  subdivision:
                    selectedParcel.subdivision,

                  land_id:
                    selectedParcel.land_id,

                  unit_id:
                    selectedParcel.unit_id,

                  block_id:
                    selectedParcel.block_id,

                  kide:
                    selectedParcel.kide,

                  source_file:
                    selectedParcel.source_file,
                }
              : undefined,
        };
        console.log(
  "FARM LOCATION PAYLOAD:",
  JSON.stringify(locationPayload, null, 2)
);

      const locationResponse =
        await saveFarmLocation(
          locationPayload
        );

      /*
       * ----------------------------------------------------
       * STEP 2
       * Confirm parcel using canonical farm_id.
       * ----------------------------------------------------
       */

      if (selectedParcel) {
        await confirmFarmParcel({
          farm_id:
            locationResponse.farm_id,

          parcel_id:
            selectedParcel.parcel_id,

          farmer_confirmed:
            true,

          district:
            selectedParcel.district ||
            undefined,

          taluk:
            selectedParcel.taluk ||
            undefined,

          village:
            selectedParcel.village ||
            undefined,

          survey_number:
            selectedParcel.survey_number ||
            undefined,

          subdivision:
            selectedParcel.subdivision ||
            undefined,

          geometry:
            selectedParcel.geometry,
        });
      }

      /*
       * ----------------------------------------------------
       * STEP 3
       * Create AI farm profile.
       * ----------------------------------------------------
       */

      const profilePayload: CreateFarmProfileRequest =
        {
          farm_id:
            locationResponse.farm_id,

          farm_profile:
            farmProfile,

          location:
            locationResponse.location,

          boundary:
            locationResponse.boundary,

          mapped_area_acres:
            locationResponse.mapped_area_acres,

          perimeter_m:
            locationResponse.perimeter_m,

          farmer_confirmed:
            true,

          boundary_source:
            boundarySource,

          parcel_id:
            selectedParcel?.parcel_id,

          parcel_metadata:
            selectedParcel
              ? {
                  district:
                    selectedParcel.district,

                  taluk:
                    selectedParcel.taluk,

                  village:
                    selectedParcel.village,

                  survey_number:
                    selectedParcel.survey_number,

                  subdivision:
                    selectedParcel.subdivision,

                  land_id:
                    selectedParcel.land_id,

                  unit_id:
                    selectedParcel.unit_id,

                  block_id:
                    selectedParcel.block_id,

                  kide:
                    selectedParcel.kide,
                }
              : undefined,
        };

      const profileResponse =
        await createFarmProfile(
          profilePayload
        );

      /*
       * ----------------------------------------------------
       * LOCAL CACHE
       * ----------------------------------------------------
       */

      const completedFarm = {
        farm_id:
          locationResponse.farm_id,

        farm_profile:
          farmProfile,

        location:
          locationResponse.location,

        boundary:
          locationResponse.boundary,

        mapped_area_acres:
          locationResponse.mapped_area_acres,

        perimeter_m:
          locationResponse.perimeter_m,

        farmer_confirmed:
          locationResponse.farmer_confirmed,

        boundary_source:
          locationResponse.boundary_source,

        parcel_id:
          selectedParcel?.parcel_id,

        parcel:
          selectedParcel,

        profile_status:
          profileResponse.profile_status,

        ai_profile:
          profileResponse.profile,

        verification:
          profileResponse.verification,

        next_questions:
          profileResponse.next_questions,

        timestamp:
          new Date().toISOString(),
      };

      localStorage.setItem(
        "vazhaiguard_farm_complete",
        JSON.stringify(
          completedFarm
        )
      );

      localStorage.setItem(
        "vazhaiguard_farm_id",
        locationResponse.farm_id
      );

      navigate("/dashboard");
    } catch (error) {
      console.error(
        "Farm persistence failed:",
        error
      );

      setSaveError(
        error instanceof Error
          ? error.message
          : "Unable to save your farm. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (geoLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5fbf6]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#146c43] border-t-transparent" />

          <p className="font-medium text-[#13271d]">
            Preparing your farm map...
          </p>

          <p className="mt-1 text-xs text-[#66766d]">
            Detecting your current location
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#f5fbf6] pb-20">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="sticky top-0 z-30 border-b border-[#dfe9e2] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#073b2a] shadow-sm">
              <MapPinned className="h-5 w-5 text-[#b8df4b]" />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#146c43]">
                VazhaiGuard AI
              </p>

              <h1 className="text-lg font-bold text-[#13271d] sm:text-xl">
                Select your farm
              </h1>
            </div>

          </div>

          <div className="hidden items-center gap-2 rounded-full bg-[#eef7f0] px-4 py-2 sm:flex">
            <ShieldCheck className="h-4 w-4 text-[#146c43]" />

            <span className="text-xs font-semibold text-[#146c43]">
              Step 2 of 3
            </span>
          </div>

        </div>
      </header>

      {/* =================================================
          MAIN
      ================================================= */}

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">

        {/* ERROR */}
        {(geoError ||
          saveError ||
          parcelError) && (
          <div className="mb-5 rounded-2xl border border-[#efc7c4] bg-[#fff7f6] p-4 shadow-sm">

            <div className="flex items-start gap-3">

              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#b53b34]" />

              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#8f2e29]">
                  Something needs your attention
                </p>

                <p className="mt-1 text-sm text-[#a83a34]">
                  {parcelError ||
                    saveError ||
                    geoError}
                </p>
              </div>

            </div>
          </div>
        )}

        {/* =================================================
            SEARCH + MAP
        ================================================= */}

        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">

          {/* =================================================
              LEFT PANEL
          ================================================= */}

          <div className="space-y-5">

            {/* SEARCH CARD */}

            <Card className="overflow-hidden rounded-[28px] border-[#dfe9e2] bg-white shadow-[0_18px_60px_rgba(7,59,42,0.07)]">

              <div className="border-b border-[#edf2ee] p-5 sm:p-6">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef7f0]">
                    <FileSearch className="h-5 w-5 text-[#146c43]" />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#146c43]">
                      Parcel search
                    </p>

                    <h2 className="mt-1 text-base font-bold text-[#13271d]">
                      Find your registered farm
                    </h2>
                  </div>

                </div>

                <p className="mt-3 text-sm leading-6 text-[#66766d]">
                  Search the cadastral records using the location details you know.
                </p>

              </div>

              <div className="space-y-4 p-5 sm:p-6">

                {/* DISTRICT */}

                <SearchField
                  label="District"
                  value={district}
                  placeholder="e.g. Thoothukudi"
                  onChange={setDistrict}
                />

                {/* TALUK */}

                <SearchField
                  label="Taluk"
                  value={taluk}
                  placeholder="e.g. Thoothukudi"
                  onChange={setTaluk}
                />

                {/* VILLAGE */}

                <SearchField
                  label="Village"
                  value={village}
                  placeholder="e.g. Keelathattaparai"
                  onChange={setVillage}
                />

                <div className="grid grid-cols-2 gap-3">

                  <SearchField
                    label="Survey number"
                    value={surveyNumber}
                    placeholder="384"
                    onChange={
                      setSurveyNumber
                    }
                  />

                  <SearchField
                    label="Subdivision"
                    value={subdivision}
                    placeholder="Optional"
                    onChange={
                      setSubdivision
                    }
                  />

                </div>

                <Button
                  type="button"
                  onClick={handleSearch}
                  disabled={
                    parcelSearching
                  }
                  className="h-12 w-full rounded-xl bg-[#073b2a] font-semibold text-white shadow-sm hover:bg-[#0b4d36]"
                >
                  {parcelSearching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching parcels...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Find my parcel
                    </>
                  )}
                </Button>

              </div>

            </Card>

            {/* RESULTS */}

            {parcelCandidates.length >
              0 && (
              <Card className="rounded-[28px] border-[#dfe9e2] bg-white p-5 shadow-[0_18px_60px_rgba(7,59,42,0.06)] sm:p-6">

                <div className="mb-4 flex items-center justify-between">

                  <div>
                    <h2 className="text-sm font-bold text-[#13271d]">
                      Matching parcels
                    </h2>

                    <p className="mt-1 text-xs text-[#66766d]">
                      Tap a parcel to view it on the map.
                    </p>
                  </div>

                  <span className="rounded-full bg-[#eef7f0] px-3 py-1 text-xs font-bold text-[#146c43]">
                    {parcelCandidates.length}
                  </span>

                </div>

                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">

                  {parcelCandidates.map(
                    (parcel) => {
                      const active =
                        selectedParcel?.parcel_id ===
                        parcel.parcel_id;

                      return (
                        <button
                          key={
                            parcel.parcel_id
                          }
                          type="button"
                          onClick={() =>
                            handleParcelSelect(
                              parcel
                            )
                          }
                          className={`group w-full rounded-2xl border p-4 text-left transition ${
                            active
                              ? "border-[#8fbe55] bg-[#f2fae9] shadow-sm"
                              : "border-[#e1e9e3] bg-white hover:border-[#b9d995] hover:bg-[#fbfef9]"
                          }`}
                        >

                          <div className="flex items-start gap-3">

                            <div
                              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                active
                                  ? "bg-[#073b2a]"
                                  : "bg-[#eef7f0]"
                              }`}
                            >
                              {active ? (
                                <Check className="h-4 w-4 text-[#b8df4b]" />
                              ) : (
                                <MapPinned className="h-4 w-4 text-[#146c43]" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">

                              <p className="text-sm font-bold text-[#13271d]">
                                Survey No.{" "}
                                {parcel.survey_number ||
                                  "—"}

                                {parcel.subdivision
                                  ? ` / ${parcel.subdivision}`
                                  : ""}
                              </p>

                              <p className="mt-1 text-xs text-[#66766d]">
                                {parcel.village ||
                                  village ||
                                  "Village not available"}
                              </p>

                              <div className="mt-2 flex flex-wrap gap-1.5">

                                {parcel.unit_id && (
                                  <MetaPill>
                                    Unit{" "}
                                    {
                                      parcel.unit_id
                                    }
                                  </MetaPill>
                                )}

                                {parcel.block_id && (
                                  <MetaPill>
                                    Block{" "}
                                    {
                                      parcel.block_id
                                    }
                                  </MetaPill>
                                )}

                                {parcel.land_id && (
                                  <MetaPill>
                                    Land ID{" "}
                                    {
                                      parcel.land_id
                                    }
                                  </MetaPill>
                                )}

                              </div>

                            </div>

                            <ChevronRight
                              className={`mt-1 h-4 w-4 shrink-0 transition ${
                                active
                                  ? "text-[#146c43]"
                                  : "text-[#a5b3aa] group-hover:translate-x-0.5"
                              }`}
                            />

                          </div>

                        </button>
                      );
                    }
                  )}

                </div>

              </Card>
            )}

            {/* SELECTED PARCEL */}

            {selectedParcel && (
              <Card className="overflow-hidden rounded-[28px] border-[#cfe3b5] bg-white shadow-[0_18px_60px_rgba(7,59,42,0.08)]">

                <div className="bg-[#073b2a] p-5 text-white">

                  <div className="flex items-start justify-between gap-3">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                        <MapPinned className="h-5 w-5 text-[#b8df4b]" />
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#b8df4b]">
                          Selected parcel
                        </p>

                        <h2 className="mt-1 text-base font-bold">
                          Survey{" "}
                          {selectedParcel.survey_number ||
                            "—"}
                          {selectedParcel.subdivision
                            ? ` / ${selectedParcel.subdivision}`
                            : ""}
                        </h2>
                      </div>

                    </div>

                    {parcelConfirmed && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#b8df4b]">
                        <Check className="h-4 w-4 text-[#073b2a]" />
                      </div>
                    )}

                  </div>

                </div>

                <div className="space-y-4 p-5">

                  <div className="grid grid-cols-2 gap-3">

                    <InfoItem
                      label="District"
                      value={
                        selectedParcel.district ||
                        "—"
                      }
                    />

                    <InfoItem
                      label="Taluk"
                      value={
                        selectedParcel.taluk ||
                        "—"
                      }
                    />

                    <InfoItem
                      label="Village"
                      value={
                        selectedParcel.village ||
                        "—"
                      }
                    />

                    <InfoItem
                      label="Unit / Block"
                      value={[
                        selectedParcel.unit_id
                          ? `Unit ${selectedParcel.unit_id}`
                          : null,

                        selectedParcel.block_id
                          ? `Block ${selectedParcel.block_id}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" • ") ||
                        "—"}
                    />

                  </div>

                  <div className="rounded-2xl border border-[#dfe9e2] bg-[#f8fbf8] p-4">

                    <div className="flex items-start gap-3">

                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#146c43]" />

                      <div>
                        <p className="text-sm font-bold text-[#13271d]">
                          Is this your farm?
                        </p>

                        <p className="mt-1 text-xs leading-5 text-[#66766d]">
                          The highlighted boundary comes from the cadastral parcel data. Confirm it if the map matches your farm.
                        </p>
                      </div>

                    </div>

                  </div>

                  {!parcelConfirmed ? (
                    <div className="space-y-2">

                      <Button
                        type="button"
                        onClick={
                          handleConfirmParcel
                        }
                        className="h-12 w-full rounded-xl bg-[#146c43] font-semibold text-white hover:bg-[#0b4d36]"
                      >
                        <CheckCircle2 className="mr-2 h-5 w-5" />
                        Yes, this is my farm
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={
                          handleEditBoundary
                        }
                        className="h-11 w-full rounded-xl border-[#cbdacf] text-[#13271d] hover:bg-[#f5fbf6]"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Boundary is slightly different
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setSelectedParcel(
                            null
                          );

                          setParcelConfirmed(
                            false
                          );

                          setLocationData(
                            (previous) => ({
                              ...previous,

                              boundary:
                                null,

                              source:
                                "gps-pin",
                            })
                          );

                          setBoundaryMetrics(
                            null
                          );
                        }}
                        className="h-10 w-full rounded-xl text-[#66766d] hover:bg-[#f5fbf6]"
                      >
                        <X className="mr-2 h-4 w-4" />
                        This is not my farm
                      </Button>

                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[#b9ddb0] bg-[#f1faed] p-4">

                      <div className="flex items-center gap-3">

                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#22a35a]">
                          <Check className="h-5 w-5 text-white" />
                        </div>

                        <div>
                          <p className="text-sm font-bold text-[#13271d]">
                            Parcel confirmed
                          </p>

                          <p className="text-xs text-[#52705e]">
                            Ready to create your farm profile.
                          </p>
                        </div>

                      </div>

                    </div>
                  )}

                </div>

              </Card>
            )}

          </div>

          {/* =================================================
              RIGHT MAP
          ================================================= */}

          <div className="min-w-0">

            <Card className="overflow-hidden rounded-[30px] border-[#dfe9e2] bg-white p-2 shadow-[0_20px_70px_rgba(7,59,42,0.09)] sm:p-3">

              <div className="relative overflow-hidden rounded-[24px]">

                <SatelliteMap
                  accessToken={
                    MAPBOX_TOKEN
                  }

                  location={{
                    latitude:
                      locationData.latitude,

                    longitude:
                      locationData.longitude,

                    accuracy:
                      locationData.accuracy,

                    label:
                      "Farm location",
                  }}

                  boundary={
                    locationData.boundary
                  }

                  startDrawSignal={
                    startDrawSignal
                  }

                  clearDrawSignal={
                    clearDrawSignal
                  }

                  dropPinMode={
                    mapMode ===
                    "drop-pin"
                  }

                  cadastralGeoJson={
                    cadastralGeoJson
                  }

                  selectedParcelId={
                    selectedParcel?.parcel_id ||
                    null
                  }

                  onLocationChange={(
                    location
                  ) => {
                    setLocationData(
                      (previous) => ({
                        ...previous,

                        latitude:
                          location.latitude,

                        longitude:
                          location.longitude,

                        accuracy:
                          location.accuracy,

                        source:
                          "gps-pin",
                      })
                    );
                  }}

                  onBoundaryChange={
                    handleBoundaryChange
                  }

                  onBoundaryMetricsChange={
                    setBoundaryMetrics
                  }

                  onPlotSelect={
                    handlePlotSelect
                  }
                />

                {/* MAP STATUS */}

                <div className="absolute left-4 top-4 z-10">

                  <div className="rounded-2xl border border-white/30 bg-[#073b2a]/90 px-4 py-3 text-white shadow-xl backdrop-blur-md">

                    <div className="flex items-center gap-2">

                      <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#b8df4b]" />

                      <span className="text-xs font-bold">
                        {selectedParcel
                          ? "Parcel selected"
                          : "Satellite view"}
                      </span>

                    </div>

                    <p className="mt-1 text-[10px] text-white/70">
                      {selectedParcel
                        ? "Highlighted boundary"
                        : "Tap a parcel on the map"}
                    </p>

                  </div>

                </div>

                {/* MAP LEGEND */}

                <div className="absolute bottom-4 left-4 z-10">

                  <div className="rounded-2xl border border-white/40 bg-white/95 px-4 py-3 shadow-xl backdrop-blur">

                    <div className="space-y-2">

                      <LegendItem
                        className="bg-[#b8df4b]"
                        label="Selected parcel"
                      />

                      <LegendItem
                        className="bg-[#7fc97f]"
                        label="Available parcel"
                      />

                    </div>

                  </div>

                </div>

              </div>

            </Card>

            {/* MAP ACTIONS */}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMapMode(
                    "drop-pin"
                  );

                  setClearDrawSignal(
                    (previous) =>
                      previous + 1
                  );
                }}
                className={`h-12 rounded-xl ${
                  mapMode ===
                  "drop-pin"
                    ? "border-[#073b2a] bg-[#073b2a] text-white hover:bg-[#0b4d36]"
                    : "border-[#dfe9e2] bg-white text-[#13271d]"
                }`}
              >
                <MapPinned className="mr-2 h-4 w-4" />
                Move map pin
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={
                  handleEditBoundary
                }
                className={`h-12 rounded-xl ${
                  mapMode === "draw"
                    ? "border-[#073b2a] bg-[#073b2a] text-white hover:bg-[#0b4d36]"
                    : "border-[#dfe9e2] bg-white text-[#13271d]"
                }`}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit boundary
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setParcelCandidates(
                    []
                  );

                  setSelectedParcel(
                    null
                  );

                  setParcelConfirmed(
                    false
                  );

                  setLocationData(
                    (previous) => ({
                      ...previous,

                      boundary:
                        null,

                      source:
                        "gps-pin",
                    })
                  );

                  setBoundaryMetrics(
                    null
                  );

                  setClearDrawSignal(
                    (previous) =>
                      previous + 1
                  );

                  setMapMode(
                    "browse"
                  );
                }}
                className="h-12 rounded-xl border-[#dfe9e2] bg-white text-[#13271d] hover:bg-[#f5fbf6]"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset selection
              </Button>

            </div>

            {/* =================================================
                METRICS
            ================================================= */}

            {(boundaryMetrics ||
              selectedParcel) && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">

                <Card className="rounded-2xl border-[#dfe9e2] bg-white p-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef7f0]">
                      <Square className="h-5 w-5 text-[#146c43]" />
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#66766d]">
                        Farm area
                      </p>

                      <p className="mt-1 text-lg font-bold text-[#13271d]">
                        {boundaryMetrics
                          ? `${boundaryMetrics.areaAcres.toFixed(
                              2
                            )} acres`
                          : selectedParcel?.area_acres
                            ? `${selectedParcel.area_acres.toFixed(
                                2
                              )} acres`
                            : "Pending calculation"}
                      </p>
                    </div>

                  </div>

                </Card>

                <Card className="rounded-2xl border-[#dfe9e2] bg-white p-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef7f0]">
                      <Ruler className="h-5 w-5 text-[#146c43]" />
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#66766d]">
                        Boundary
                      </p>

                      <p className="mt-1 text-lg font-bold text-[#13271d]">
                        {boundaryMetrics
                          ? `${boundaryMetrics.perimeterM.toFixed(
                              0
                            )} m`
                          : "Cadastral boundary"}
                      </p>
                    </div>

                  </div>

                </Card>

              </div>
            )}

          </div>

        </div>

        {/* =================================================
            FINAL CONFIRMATION
        ================================================= */}

        <Card className="mt-6 overflow-hidden rounded-[30px] border-[#dfe9e2] bg-white shadow-[0_18px_60px_rgba(7,59,42,0.07)]">

          <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-start gap-3">

              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                  parcelConfirmed
                    ? "bg-[#22a35a]"
                    : "bg-[#eef7f0]"
                }`}
              >
                {parcelConfirmed ? (
                  <Check className="h-5 w-5 text-white" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-[#146c43]" />
                )}
              </div>

              <div>

                <h3 className="font-bold text-[#13271d]">
                  {parcelConfirmed
                    ? "Your farm parcel is ready"
                    : "Review your farm boundary"}
                </h3>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-[#66766d]">
                  {parcelConfirmed
                    ? "The selected cadastral parcel has been confirmed. Continue to create your VazhaiGuard farm profile."
                    : "Select your registered parcel and confirm that the highlighted boundary matches your farm."}
                </p>

              </div>

            </div>

            <div className="flex flex-col gap-3 sm:flex-row">

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  navigate(-1)
                }
                disabled={isSaving}
                className="h-12 rounded-xl border-[#dfe9e2] bg-white px-6 text-[#13271d]"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <Button
                type="button"
                onClick={
                  handleSave
                }
                disabled={
                  isSaving ||
                  !locationData.boundary ||
                  (Boolean(
                    selectedParcel
                  ) &&
                    !parcelConfirmed)
                }
                className="h-12 rounded-xl bg-[#073b2a] px-7 font-semibold text-white shadow-sm hover:bg-[#0b4d36] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating farm...
                  </>
                ) : (
                  <>
                    Confirm Farm & Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

            </div>

          </div>

        </Card>

      </main>
    </div>
  );
}

/* =========================================================
   SEARCH FIELD
========================================================= */

function SearchField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;

  value: string;

  placeholder: string;

  onChange: (
    value: string
  ) => void;
}) {
  return (
    <label className="block">

      <span className="mb-1.5 block text-xs font-semibold text-[#13271d]">
        {label}
      </span>

      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="h-11 w-full rounded-xl border border-[#dfe9e2] bg-[#fbfdfb] px-3 text-sm text-[#13271d] outline-none transition placeholder:text-[#9aa9a0] focus:border-[#8fbe55] focus:ring-2 focus:ring-[#b8df4b]/20"
      />

    </label>
  );
}

/* =========================================================
   META PILL
========================================================= */

function MetaPill({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span className="rounded-lg bg-[#f0f5f1] px-2 py-1 text-[10px] font-semibold text-[#66766d]">
      {children}
    </span>
  );
}

/* =========================================================
   INFO ITEM
========================================================= */

function InfoItem({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div className="rounded-xl bg-[#f8fbf8] p-3">

      <p className="text-[9px] font-bold uppercase tracking-wide text-[#8a9a90]">
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-bold text-[#13271d]">
        {value}
      </p>

    </div>
  );
}

/* =========================================================
   MAP LEGEND
========================================================= */

function LegendItem({
  className,
  label,
}: {
  className: string;

  label: string;
}) {
  return (
    <div className="flex items-center gap-2">

      <span
        className={`h-3 w-3 rounded-sm ${className}`}
      />

      <span className="text-[10px] font-semibold text-[#53655b]">
        {label}
      </span>

    </div>
  );
}