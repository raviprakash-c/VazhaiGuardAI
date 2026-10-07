import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useNavigate } from "react-router-dom";

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
  Ruler,
  Search,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";

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

  boundary:
    | ParcelGeometry
    | null;

  source:
    | "gps-pin"
    | "cadastral_parcel"
    | "cadastral_edited"
    | "drawn";
};

/*
 * SatelliteMap currently accepts Polygon
 * through its boundary prop.
 *
 * MultiPolygon parcels are still preserved
 * in our page state and are sent unchanged
 * to the backend.
 */
type PolygonGeometry = {
  type: "Polygon";
  coordinates: [number, number][][];
};

type Coordinate = [
  number,
  number
];

/* =========================================================
   SAFE LOCAL STORAGE
   ========================================================= */

function readLocalStorageObject(
  key: string
): Record<string, unknown> | null {
  try {
    const value =
      localStorage.getItem(key);

    if (!value) {
      return null;
    }

    const parsed =
      JSON.parse(value);

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    console.error(
      `[FarmLocation] Failed to read ${key}:`,
      error
    );
  }

  return null;
}

/* =========================================================
   MAIN PAGE
   ========================================================= */

export default function FarmLocationPage() {
  const navigate = useNavigate();

  /* -------------------------------------------------------
     FARM PROFILE
  ------------------------------------------------------- */

  const [
    farmProfile,
    setFarmProfile,
  ] = useState<FarmProfile | null>(null);

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
     MAP MODE
  ------------------------------------------------------- */

  const [
    mapMode,
    setMapMode,
  ] = useState<
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
     FARM LOCATION
  ------------------------------------------------------- */

  const [
    locationData,
    setLocationData,
  ] = useState<FarmLocationData>({
    latitude: 9.5,
    longitude: 77.5,
    accuracy: undefined,
    boundary: null,
    source: "gps-pin",
  });

  /* -------------------------------------------------------
     BOUNDARY METRICS
  ------------------------------------------------------- */

  const [
    boundaryMetrics,
    setBoundaryMetrics,
  ] = useState<BoundaryMetrics | null>(
    null
  );

  /* -------------------------------------------------------
     PARCEL SEARCH
  ------------------------------------------------------- */

  const [
    district,
    setDistrict,
  ] = useState("");

  const [
    taluk,
    setTaluk,
  ] = useState("");

  const [
    village,
    setVillage,
  ] = useState("");

  const [
    surveyNumber,
    setSurveyNumber,
  ] = useState("");

  const [
    subdivision,
    setSubdivision,
  ] = useState("");

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

  /* =========================================================
     LOAD EXISTING FARM REGISTRATION
     ========================================================= */

  useEffect(() => {
    const savedProfile =
      readLocalStorageObject(
        "vazhaiguard_farm_profile"
      );

    if (savedProfile) {
      setFarmProfile(
        savedProfile
      );
    }

    /*
     * Restore an already completed farm.
     */

    const savedFarm =
      readLocalStorageObject(
        "vazhaiguard_farm_complete"
      );

    if (savedFarm) {
      try {
        const savedLocation =
          savedFarm.location as
            | Record<string, unknown>
            | undefined;

        const savedBoundary =
          savedFarm.boundary;

        if (
          savedLocation &&
          savedBoundary
        ) {
          const restoredBoundary =
            savedBoundary as ParcelGeometry;

          setLocationData(
            (previous) => ({
              ...previous,

              latitude:
                Number(
                  savedLocation.latitude
                ) || previous.latitude,

              longitude:
                Number(
                  savedLocation.longitude
                ) || previous.longitude,

              accuracy:
                typeof savedLocation.accuracy ===
                "number"
                  ? savedLocation.accuracy
                  : previous.accuracy,

              boundary:
                restoredBoundary,

              source:
                savedFarm.boundary_source ===
                "cadastral_edited"
                  ? "cadastral_edited"
                  : "cadastral_parcel",
            })
          );

          if (
            savedFarm.parcel &&
            typeof savedFarm.parcel ===
              "object"
          ) {
            setSelectedParcel(
              savedFarm.parcel as ParcelCandidate
            );

            setParcelConfirmed(
              Boolean(
                savedFarm.farmer_confirmed
              )
            );
          }

          return;
        }
      } catch (error) {
        console.error(
          "[FarmLocation] Failed to restore completed farm:",
          error
        );
      }
    }

    /*
     * Restore pending parcel confirmation.
     */

    const pendingParcel =
      readLocalStorageObject(
        "vazhaiguard_pending_parcel"
      );

    if (pendingParcel) {
      try {
        if (
          pendingParcel.parcel &&
          pendingParcel.boundary
        ) {
          setSelectedParcel(
            pendingParcel.parcel as ParcelCandidate
          );

          setParcelConfirmed(true);

          setLocationData(
            (previous) => ({
              ...previous,

              latitude:
                Number(
                  pendingParcel.latitude
                ) || previous.latitude,

              longitude:
                Number(
                  pendingParcel.longitude
                ) || previous.longitude,

              boundary:
                pendingParcel.boundary as ParcelGeometry,

              source:
                "cadastral_parcel",
            })
          );

          return;
        }
      } catch (error) {
        console.error(
          "[FarmLocation] Failed to restore pending parcel:",
          error
        );
      }
    }

    /*
     * Only use GPS if we don't already
     * have a verified parcel.
     */

    getCurrentLocation();
  }, [getCurrentLocation]);

  /* =========================================================
     GPS → LOCATION STATE
     ========================================================= */

  useEffect(() => {
    if (
      latitude === null ||
      longitude === null
    ) {
      return;
    }

    /*
     * Do not overwrite a selected cadastral
     * parcel with GPS.
     */

    if (
      selectedParcel ||
      locationData.boundary
    ) {
      return;
    }

    setLocationData(
      (previous) => ({
        ...previous,

        latitude,
        longitude,
        accuracy,
      })
    );
  }, [
    latitude,
    longitude,
    accuracy,
    selectedParcel,
    locationData.boundary,
  ]);

  /* =========================================================
     GEOMETRY HELPERS
     ========================================================= */

  const getGeometryCoordinates = (
    geometry: ParcelGeometry
  ): Coordinate[] => {
    if (!geometry) {
      return [];
    }

    if (
      geometry.type === "Polygon"
    ) {
      return geometry.coordinates
        .flat(1) as Coordinate[];
    }

    return geometry.coordinates
      .flat(2) as Coordinate[];
  };

  const calculateGeometryCenter = (
    geometry: ParcelGeometry
  ) => {
    const coordinates =
      getGeometryCoordinates(
        geometry
      );

    if (!coordinates.length) {
      return {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
      };
    }

    let latitudeSum = 0;
    let longitudeSum = 0;

    for (
      const [
        currentLongitude,
        currentLatitude,
      ] of coordinates
    ) {
      longitudeSum +=
        currentLongitude;

      latitudeSum +=
        currentLatitude;
    }

    return {
      latitude:
        latitudeSum /
        coordinates.length,

      longitude:
        longitudeSum /
        coordinates.length,
    };
  };

  /* =========================================================
     CANDIDATES → GEOJSON
     ========================================================= */

  const cadastralGeoJson =
    useMemo(() => {
      return {
        type: "FeatureCollection" as const,

        features:
          parcelCandidates
            .filter(
              (parcel) =>
                Boolean(
                  parcel.geometry
                )
            )
            .map((parcel) => ({
              type: "Feature" as const,

              id:
                parcel.parcel_id,

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

                kide:
                  parcel.kide,

                confidence:
                  parcel.confidence,

                source_file:
                  parcel.source_file,
              },

              geometry:
                parcel.geometry,
            })),
      };
    }, [
      parcelCandidates,
    ]);

  /* =========================================================
     SEARCH PARCELS
     ========================================================= */

  const handleSearch =
    async () => {
      setParcelError("");
      setSaveError("");

      /*
       * Require at least one meaningful
       * location identifier.
       */

      if (
        !district.trim() &&
        !taluk.trim() &&
        !village.trim() &&
        !surveyNumber.trim() &&
        !subdivision.trim()
      ) {
        setParcelError(
          "Please enter your district, taluk, village or survey number."
        );

        return;
      }

      setParcelSearching(true);

      /*
       * New search means previous
       * selection is no longer trusted.
       */

      setSelectedParcel(null);
      setParcelConfirmed(false);

      setLocationData(
        (previous) => ({
          ...previous,

          boundary: null,

          source:
            "gps-pin",
        })
      );

      setBoundaryMetrics(null);

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

        const candidates =
          response.candidates || [];

        setParcelCandidates(
          candidates
        );

        if (!candidates.length) {
          setParcelError(
            "No registered parcels were found. Check the district, taluk, village or survey number and try again."
          );

          return;
        }

        /*
         * If exactly one candidate is
         * returned, do NOT silently confirm it.
         *
         * Select it so the farmer can see
         * the boundary and verify it.
         */

        if (
          candidates.length === 1
        ) {
          handleParcelSelect(
            candidates[0]
          );
        }
      } catch (error) {
        console.error(
          "[FarmLocation] Parcel search failed:",
          error
        );

        setParcelCandidates([]);

        setParcelError(
          error instanceof Error
            ? error.message
            : "Unable to search farm parcels."
        );
      } finally {
        setParcelSearching(
          false
        );
      }
    };

  /* =========================================================
     SELECT PARCEL
     ========================================================= */

  const handleParcelSelect = (
    parcel: ParcelCandidate
  ) => {
    if (!parcel.geometry) {
      setParcelError(
        "This parcel does not contain a valid mapped boundary."
      );

      return;
    }

    setParcelError("");
    setSaveError("");

    setSelectedParcel(
      parcel
    );

    /*
     * Selecting another parcel
     * automatically removes previous
     * confirmation.
     */

    setParcelConfirmed(
      false
    );

    setMapMode(
      "browse"
    );

    const center =
      calculateGeometryCenter(
        parcel.geometry
      );

    setLocationData(
      (previous) => ({
        ...previous,

        latitude:
          center.latitude,

        longitude:
          center.longitude,

        boundary:
          parcel.geometry,

        source:
          "cadastral_parcel",
      })
    );

    setBoundaryMetrics(
      null
    );

    /*
     * Persist only as pending state.
     * This is NOT yet a verified farm.
     */

    localStorage.setItem(
      "vazhaiguard_pending_parcel",
      JSON.stringify({
        parcel,
        latitude:
          center.latitude,
        longitude:
          center.longitude,
        boundary:
          parcel.geometry,
      })
    );
  };

  /* =========================================================
     MAP CLICK → PARCEL
     ========================================================= */

  const handlePlotSelect = ({
    geometry,
    properties,
  }: {
    geometry: PolygonGeometry;
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

    if (parcelId) {
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
    }

    /*
     * Fallback: if the map feature does
     * not have parcel_id, retain its
     * geometry as cadastral geometry.
     */

    const parcelGeometry =
      geometry as ParcelGeometry;

    const center =
      calculateGeometryCenter(
        parcelGeometry
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

        latitude:
          center.latitude,

        longitude:
          center.longitude,

        boundary:
          parcelGeometry,

        source:
          "cadastral_parcel",
      })
    );

    setBoundaryMetrics(
      null
    );
  };

  /* =========================================================
     EDIT BOUNDARY
     ========================================================= */

  const handleEditBoundary =
    () => {
      if (!selectedParcel) {
        setSaveError(
          "Select your registered parcel first."
        );

        return;
      }

      setParcelConfirmed(
        false
      );

      setSaveError("");

      setMapMode(
        "draw"
      );

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

          boundary:
            null,

          source:
            "cadastral_edited",
        })
      );

      setBoundaryMetrics(
        null
      );
    };

  /* =========================================================
     DRAWN / EDITED BOUNDARY
     ========================================================= */

  const handleBoundaryChange = (
    boundary:
      | ParcelGeometry
      | null
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
      setBoundaryMetrics(
        null
      );

      setParcelConfirmed(
        false
      );

      return;
    }

    /*
     * Once the farmer edits the cadastral
     * boundary, the original parcel is no
     * longer an exact geometry match.
     *
     * Keep the parcel metadata, but require
     * the farmer to confirm the edited boundary.
     */

    setParcelConfirmed(
      false
    );
  };

  /* =========================================================
     CONFIRM SELECTED PARCEL
     ========================================================= */

  const handleConfirmParcel =
    async () => {
      if (!selectedParcel) {
        setSaveError(
          "Please select your farm parcel first."
        );

        return;
      }

      if (!selectedParcel.geometry) {
        setSaveError(
          "The selected parcel does not have a valid boundary."
        );

        return;
      }

      /*
       * If the farmer edited the boundary,
       * confirmation still refers to the
       * registered parcel but the edited
       * geometry will be saved as
       * cadastral_edited.
       */

      const boundary =
        locationData.boundary ||
        selectedParcel.geometry;

      const center =
        calculateGeometryCenter(
          boundary
        );

      setLocationData(
        (previous) => ({
          ...previous,

          latitude:
            center.latitude,

          longitude:
            center.longitude,

          boundary,

          source:
            previous.source ===
            "cadastral_edited"
              ? "cadastral_edited"
              : "cadastral_parcel",
        })
      );

      /*
       * Local pending state is useful if
       * the browser refreshes before final save.
       */

      localStorage.setItem(
        "vazhaiguard_pending_parcel",
        JSON.stringify({
          parcel:
            selectedParcel,

          latitude:
            center.latitude,

          longitude:
            center.longitude,

          boundary,
        })
      );

      setParcelConfirmed(
        true
      );

      setSaveError("");

      setMapMode(
        "browse"
      );
    };

  /* =========================================================
     FINAL FARM SAVE
     ========================================================= */

  const handleSave =
    async () => {
      setSaveError("");

      if (!farmProfile) {
        setSaveError(
          "Farm registration details were not found. Please complete voice registration again."
        );

        return;
      }

      if (
        !Number.isFinite(
          locationData.latitude
        ) ||
        !Number.isFinite(
          locationData.longitude
        )
      ) {
        setSaveError(
          "Please select a valid farm location."
        );

        return;
      }

      if (!locationData.boundary) {
        setSaveError(
          "Please select your registered farm parcel."
        );

        return;
      }

      if (
        selectedParcel &&
        !parcelConfirmed
      ) {
        setSaveError(
          "Please confirm that the highlighted parcel belongs to your farm."
        );

        return;
      }

      setIsSaving(
        true
      );

      try {
        /*
         * Determine authoritative boundary source.
         */

        const boundarySource:
          BoundarySource =
          selectedParcel
            ? locationData.source ===
              "cadastral_edited"
              ? "cadastral_edited"
              : "cadastral_parcel"
            : "farmer_drawn_satellite";

        /*
         * Use the exact geometry from the
         * selected parcel / edited boundary.
         *
         * Do not convert MultiPolygon.
         */

        const boundary =
          locationData.boundary as FarmPolygonPayload;

        /*
         * Area:
         * 1. calculated map metric
         * 2. cadastral dataset area
         * 3. zero fallback
         */

        const mappedArea =
          boundaryMetrics?.areaAcres ??
          selectedParcel?.area_acres ??
          0;

        const perimeter =
          boundaryMetrics?.perimeterM ??
          0;

        /*
         * STEP 1
         *
         * Save the verified farm location.
         *
         * Backend creates the canonical farm_id.
         */

        const locationPayload:
          FarmLocationSaveRequest =
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

            boundary,

            mapped_area_acres:
              mappedArea,

            perimeter_m:
              perimeter,

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

                    confidence:
                      selectedParcel.confidence,

                    source_file:
                      selectedParcel.source_file,
                  }
                : undefined,
          };

        console.log(
          "[FarmLocation] Saving verified farm:",
          locationPayload
        );

        const locationResponse =
          await saveFarmLocation(
            locationPayload
          );

        if (
          !locationResponse ||
          !locationResponse.farm_id
        ) {
          throw new Error(
            "Farm was not saved correctly because the backend did not return a farm ID."
          );
        }

        /*
         * STEP 2
         *
         * Confirm the parcel using the canonical
         * farm_id returned from /farm/location.
         *
         * This avoids sending a fake/client-generated
         * farm ID.
         */

        if (selectedParcel) {
          const confirmationResponse =
            await confirmFarmParcel({
              farm_id:
                locationResponse.farm_id,

              parcel_id:
                selectedParcel.parcel_id,

              farmer_confirmed:
                true,

              district:
                selectedParcel.district ||
                district ||
                undefined,

              taluk:
                selectedParcel.taluk ||
                taluk ||
                undefined,

              village:
                selectedParcel.village ||
                village ||
                undefined,

              survey_number:
                selectedParcel.survey_number ||
                surveyNumber ||
                undefined,

              subdivision:
                selectedParcel.subdivision ||
                subdivision ||
                undefined,

              geometry:
                selectedParcel.geometry,
            });

          if (
            !confirmationResponse.success ||
            !confirmationResponse.farmer_confirmed
          ) {
            throw new Error(
              confirmationResponse.message ||
                "Parcel confirmation failed."
            );
          }
        }

        /*
         * STEP 3
         *
         * Create AI farm profile.
         *
         * At this point the AI receives
         * verified spatial context.
         */

        const profilePayload:
          CreateFarmProfileRequest =
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

                    confidence:
                      selectedParcel.confidence,

                    source_file:
                      selectedParcel.source_file,
                  }
                : undefined,
          };

        const profileResponse =
          await createFarmProfile(
            profilePayload
          );

        /*
         * STEP 4
         *
         * Persist complete farm state locally.
         *
         * This is a convenience cache only.
         * DynamoDB/backend remains authoritative.
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

          parcel_metadata:
            locationResponse.parcel_metadata ||
            (selectedParcel
              ? {
                  district: selectedParcel.district,
                  taluk: selectedParcel.taluk,
                  village: selectedParcel.village,
                  survey_number: selectedParcel.survey_number,
                  subdivision: selectedParcel.subdivision,
                  land_id: selectedParcel.land_id,
                  unit_id: selectedParcel.unit_id,
                  block_id: selectedParcel.block_id,
                  kide: selectedParcel.kide,
                  confidence: selectedParcel.confidence,
                  source_file: selectedParcel.source_file,
                }
              : undefined),

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

        /*
         * Pending state is no longer required.
         */

        localStorage.removeItem(
          "vazhaiguard_pending_parcel"
        );

        /*
         * Keep farm profile available for
         * the next screens.
         */

        localStorage.setItem(
          "vazhaiguard_ai_profile",
          JSON.stringify(
            profileResponse.profile
          )
        );

        localStorage.setItem(
          "vazhaiguard_next_questions",
          JSON.stringify(
            profileResponse.next_questions
          )
        );

        /*
         * Continue to dashboard.
         */

        navigate(
          "/dashboard"
        );
      } catch (error) {
        console.error(
          "[FarmLocation] Farm persistence failed:",
          error
        );

        setSaveError(
          error instanceof Error
            ? error.message
            : "Unable to save your farm. Please try again."
        );
      } finally {
        setIsSaving(
          false
        );
      }
    };

  /* =========================================================
     MAP BOUNDARY
     ========================================================= */

  /*
   * SatelliteMap's boundary prop is currently
   * Polygon-oriented.
   *
   * MultiPolygon is still preserved in
   * locationData and sent to the backend.
   *
   * The cadastralGeoJson layer handles the
   * actual MultiPolygon visualization.
   */

  const mapBoundary:
    | PolygonGeometry
    | null =
    locationData.boundary?.type ===
    "Polygon"
      ? locationData.boundary
      : null;

  /* =========================================================
     LOADING
     ========================================================= */

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

  /* =========================================================
     UI
     ========================================================= */

  return (
    <div className="min-h-screen bg-[#f5fbf6] pb-20">

      {/* =====================================================
          HEADER
      ===================================================== */}

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

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">

        {/* ===================================================
            ERROR
        =================================================== */}

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

        {/* ===================================================
            SEARCH + MAP
        =================================================== */}

        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">

          {/* =================================================
              LEFT PANEL
          ================================================= */}

          <div className="space-y-5">

            {/* ===============================================
                SEARCH
            =============================================== */}

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
                  Search registered cadastral records using the location details you know.
                </p>

              </div>

              <div className="space-y-4 p-5 sm:p-6">

                <SearchField
                  label="District"
                  value={district}
                  placeholder="e.g. Thoothukudi"
                  onChange={
                    setDistrict
                  }
                />

                <SearchField
                  label="Taluk"
                  value={taluk}
                  placeholder="e.g. Thoothukudi"
                  onChange={
                    setTaluk
                  }
                />

                <SearchField
                  label="Village"
                  value={village}
                  placeholder="e.g. Keelathattaparai"
                  onChange={
                    setVillage
                  }
                />

                <div className="grid grid-cols-2 gap-3">

                  <SearchField
                    label="Survey number"
                    value={
                      surveyNumber
                    }
                    placeholder="384"
                    onChange={
                      setSurveyNumber
                    }
                  />

                  <SearchField
                    label="Subdivision"
                    value={
                      subdivision
                    }
                    placeholder="Optional"
                    onChange={
                      setSubdivision
                    }
                  />

                </div>

                <Button
                  type="button"
                  onClick={
                    handleSearch
                  }
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

            {/* ===============================================
                RESULTS
            =============================================== */}

            {parcelCandidates.length >
              0 && (
              <Card className="rounded-[28px] border-[#dfe9e2] bg-white p-5 shadow-[0_18px_60px_rgba(7,59,42,0.06)] sm:p-6">

                <div className="mb-4 flex items-center justify-between">

                  <div>

                    <h2 className="text-sm font-bold text-[#13271d]">
                      Matching parcels
                    </h2>

                    <p className="mt-1 text-xs text-[#66766d]">
                      Tap a parcel to highlight its exact boundary on the map.
                    </p>

                  </div>

                  <span className="rounded-full bg-[#eef7f0] px-3 py-1 text-xs font-bold text-[#146c43]">
                    {
                      parcelCandidates.length
                    }
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

                                {parcel.area_acres !==
                                  null &&
                                  parcel.area_acres !==
                                    undefined && (
                                    <MetaPill>
                                      {parcel.area_acres.toFixed(
                                        2
                                      )}{" "}
                                      acres
                                    </MetaPill>
                                  )}

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

                                {typeof parcel.confidence ===
                                  "number" && (
                                  <MetaPill>
                                    Match{" "}
                                    {Math.round(
                                      parcel.confidence *
                                        100
                                    )}
                                    %
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

            {/* ===============================================
                SELECTED PARCEL
            =============================================== */}

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
                          {
                            selectedParcel.survey_number ||
                            "—"
                          }

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

                  {selectedParcel.area_acres !==
                    null &&
                    selectedParcel.area_acres !==
                      undefined && (
                      <InfoItem
                        label="Registered area"
                        value={`${selectedParcel.area_acres.toFixed(
                          2
                        )} acres`}
                      />
                    )}

                  <div className="rounded-2xl border border-[#dfe9e2] bg-[#f8fbf8] p-4">

                    <div className="flex items-start gap-3">

                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#146c43]" />

                      <div>

                        <p className="text-sm font-bold text-[#13271d]">
                          Is this your farm?
                        </p>

                        <p className="mt-1 text-xs leading-5 text-[#66766d]">
                          The highlighted boundary comes from registered cadastral data. Confirm only when it matches your actual farm.
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

                          localStorage.removeItem(
                            "vazhaiguard_pending_parcel"
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
                            Your farm boundary is ready for verification and AI profiling.
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
                  location={{
                    latitude:
                      locationData.latitude,

                    longitude:
                      locationData.longitude,

                    accuracy:
                      locationData.accuracy,

                    label:
                      selectedParcel
                        ? "Selected farm parcel"
                        : "Farm location",
                  }}

                  /*
                   * Polygon is passed directly.
                   *
                   * MultiPolygon remains in
                   * locationData and cadastralGeoJson.
                   */

                  boundary={
                    mapBoundary
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

                    /*
                     * Manual GPS pin movement
                     * should not destroy a verified
                     * cadastral boundary.
                     */

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
                          previous.boundary
                            ? previous.source
                            : "gps-pin",
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
                          ? "Farm parcel selected"
                          : parcelCandidates.length
                            ? "Cadastral parcels available"
                            : "Satellite view"}
                      </span>

                    </div>

                    <p className="mt-1 text-[10px] text-white/70">
                      {selectedParcel
                        ? "Highlighted boundary"
                        : parcelCandidates.length
                          ? "Select a parcel on the map or from the list"
                          : "Search your registered farm parcel"}
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

            {/* =================================================
                MAP ACTIONS
            ================================================= */}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMapMode(
                    "drop-pin"
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
                disabled={
                  !selectedParcel
                }
                className={`h-12 rounded-xl ${
                  mapMode ===
                  "draw"
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

                  localStorage.removeItem(
                    "vazhaiguard_pending_parcel"
                  );

                  setParcelError(
                    ""
                  );

                  setSaveError(
                    ""
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
                          : selectedParcel?.area_acres !==
                              null &&
                            selectedParcel?.area_acres !==
                              undefined
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

        {/* =====================================================
            FINAL CONFIRMATION
        ===================================================== */}

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
                    : selectedParcel
                      ? "Review your farm boundary"
                      : "Find and confirm your farm"}

                </h3>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-[#66766d]">

                  {parcelConfirmed
                    ? "The selected farm boundary is confirmed. Continue to create the AI farm profile."
                    : selectedParcel
                      ? "Check the highlighted boundary on the satellite map before confirming."
                      : "Search the registered parcel records, select your farm and confirm the boundary."}

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
                disabled={
                  isSaving
                }
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
                  !selectedParcel ||
                  !locationData.boundary ||
                  !parcelConfirmed
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