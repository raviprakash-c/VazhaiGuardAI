import { useEffect, useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Leaf,
  MapPin,
  Sprout,
} from "lucide-react";

import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
} from "../components/ui/card";

import RegistrationProgress from "../components/farm/RegistrationProgress";
import FarmLocationStep from "../components/farm/FarmLocationStep";
import FarmDetailsStep from "../components/farm/FarmDetailsStep";
import PlantingBlockStep from "../components/farm/PlantingBlockStep";
import FarmReadinessStep from "../components/farm/FarmReadinessStep";

import { useGeolocation } from "../hooks/useGeolocation";

import type {
  FarmRegistrationData,
  PlantingBlock,
} from "../types/farm";

/* =========================================================
   INITIAL FARM STATE
========================================================= */

const initialFarmData: FarmRegistrationData = {
  farmName: "",

  location: {
    latitude: null,
    longitude: null,
    confirmed: false,
  },

  bananaVariety: "",
  plantingMonth: "",

  approximateAreaAcres: "",
  approximatePlantCount: "",

  blocks: [],

  readiness: {
    drainage: "",
    support: "",
    accessibility: "",
  },
};

/* =========================================================
   FARM SETUP PAGE
========================================================= */

export default function FarmSetupPage() {
  const [step, setStep] = useState(1);

  const [farmData, setFarmData] =
    useState<FarmRegistrationData>(
      initialFarmData
    );

  const {
    coords,
    isLocating,
    locationError,
    getCurrentLocation,
  } = useGeolocation();

  /* =======================================================
     SYNC GPS LOCATION

     Runs only when browser GPS coordinates change.
     No state update happens during rendering.
  ======================================================== */

  useEffect(() => {
    if (!coords) return;

    setFarmData((previous) => {
      /*
       * Do nothing if these exact coordinates
       * are already stored.
       */
      if (
        previous.location.latitude ===
          coords.latitude &&
        previous.location.longitude ===
          coords.longitude
      ) {
        return previous;
      }

      return {
        ...previous,

        location: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          confirmed: false,
        },
      };
    });
  }, [coords]);

  /* =======================================================
     CONFIRM LOCATION
  ======================================================== */

  const confirmLocation = () => {
    if (
      farmData.location.latitude ===
        null ||
      farmData.location.longitude ===
        null
    ) {
      return;
    }

    setFarmData((previous) => ({
      ...previous,

      location: {
        ...previous.location,
        confirmed: true,
      },
    }));
  };

  /* =======================================================
     UPDATE BASIC FARM DETAILS
  ======================================================== */

  const updateBasicField = (
    field:
      | "farmName"
      | "bananaVariety"
      | "plantingMonth"
      | "approximateAreaAcres"
      | "approximatePlantCount",

    value: string | number
  ) => {
    setFarmData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  /* =======================================================
     UPDATE PLANTING BLOCKS
  ======================================================== */

  const updateBlocks = (
    blocks: PlantingBlock[]
  ) => {
    setFarmData((previous) => ({
      ...previous,
      blocks,
    }));
  };

  /* =======================================================
     UPDATE FARM READINESS
  ======================================================== */

  const updateReadiness = (
    field:
      | "drainage"
      | "support"
      | "accessibility",

    value: string
  ) => {
    setFarmData((previous) => ({
      ...previous,

      readiness: {
        ...previous.readiness,
        [field]: value,
      },
    }));
  };

  /* =======================================================
     STEP VALIDATION
  ======================================================== */

  const canContinue = () => {
    /*
     * STEP 1
     * GPS must be detected and confirmed.
     */
    if (step === 1) {
      return Boolean(
        farmData.location.confirmed &&
          farmData.location
            .latitude !== null &&
          farmData.location
            .longitude !== null
      );
    }

    /*
     * STEP 2
     * Core crop information.
     */
    if (step === 2) {
      return Boolean(
        farmData.farmName.trim() &&
          farmData.bananaVariety.trim() &&
          farmData.plantingMonth
      );
    }

    /*
     * STEP 3
     * At least one planting block.
     */
    if (step === 3) {
      if (
        farmData.blocks.length === 0
      ) {
        return false;
      }

      return farmData.blocks.every(
        (block) =>
          Boolean(
            block.name.trim() &&
              block.variety.trim() &&
              block.plantingMonth
          )
      );
    }

    /*
     * STEP 4
     * All readiness choices required.
     */
    if (step === 4) {
      return Boolean(
        farmData.readiness
          .drainage &&
          farmData.readiness
            .support &&
          farmData.readiness
            .accessibility
      );
    }

    return true;
  };

  /* =======================================================
     NAVIGATION
  ======================================================== */

  const goNext = () => {
    if (!canContinue()) return;

    setStep((previous) =>
      Math.min(
        previous + 1,
        5
      )
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const goBack = () => {
    setStep((previous) =>
      Math.max(
        previous - 1,
        1
      )
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* =======================================================
     COMPLETE SETUP

     Backend/DynamoDB will replace this later.
  ======================================================== */

  const completeSetup = () => {
    console.log(
      "VazhaiGuard Farm Registration:",
      farmData
    );

    alert(
      "Farm setup completed locally. Backend saving will be connected in the next milestone."
    );
  };

  /* =======================================================
     UI
  ======================================================== */

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* ===================================================
          PAGE HEADER
      ==================================================== */}

      <section className="mb-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf5ec]">
            <Leaf className="h-[18px] w-[18px] text-[#146c43]" />
          </div>

          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#146c43]">
            Farm Registration
          </span>
        </div>

        <h1 className="vg-heading mt-3 text-3xl font-bold tracking-[-0.035em] text-[#13271d] sm:text-4xl">
          Set up your Vazhai farm.
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Give VazhaiGuard only the farm
          information that cannot be reliably
          collected from weather, GPS and
          geospatial services.
        </p>
      </section>

      {/* ===================================================
          PROGRESS
      ==================================================== */}

      <RegistrationProgress
        currentStep={step}
      />

      {/* ===================================================
          MAIN FORM CARD
      ==================================================== */}

      <Card className="vg-card mt-5 overflow-hidden">
        <CardContent className="p-5 sm:p-7 lg:p-8">
          {/* STEP 1 */}

          {step === 1 && (
            <FarmLocationStep
              latitude={
                farmData.location
                  .latitude
              }
              longitude={
                farmData.location
                  .longitude
              }
              confirmed={
                farmData.location
                  .confirmed
              }
              isLocating={
                isLocating
              }
              error={
                locationError
              }
              onGetLocation={
                getCurrentLocation
              }
              onConfirm={
                confirmLocation
              }
            />
          )}

          {/* STEP 2 */}

          {step === 2 && (
            <FarmDetailsStep
              farmName={
                farmData.farmName
              }
              bananaVariety={
                farmData
                  .bananaVariety
              }
              plantingMonth={
                farmData
                  .plantingMonth
              }
              approximateAreaAcres={
                farmData
                  .approximateAreaAcres
              }
              approximatePlantCount={
                farmData
                  .approximatePlantCount
              }
              onChange={
                updateBasicField
              }
            />
          )}

          {/* STEP 3 */}

          {step === 3 && (
            <PlantingBlockStep
              blocks={
                farmData.blocks
              }
              onChange={
                updateBlocks
              }
            />
          )}

          {/* STEP 4 */}

          {step === 4 && (
            <FarmReadinessStep
              drainage={
                farmData.readiness
                  .drainage
              }
              support={
                farmData.readiness
                  .support
              }
              accessibility={
                farmData.readiness
                  .accessibility
              }
              onChange={
                updateReadiness
              }
            />
          )}

          {/* STEP 5 */}

          {step === 5 && (
            <FarmReview
              data={farmData}
            />
          )}
        </CardContent>

        {/* =================================================
            FOOTER NAVIGATION
        ================================================== */}

        <div className="flex items-center justify-between gap-4 border-t border-border bg-[#fafcfb] px-5 py-4 sm:px-7">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={step === 1}
            className="h-11 rounded-xl px-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />

            Back
          </Button>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:block">
              Step {step} of 5
            </span>

            {step < 5 ? (
              <Button
                type="button"
                onClick={goNext}
                disabled={
                  !canContinue()
                }
                className="h-11 rounded-xl bg-[#0b4d36] px-5 text-white hover:bg-[#073b2a]"
              >
                Continue

                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={
                  completeSetup
                }
                className="h-11 rounded-xl bg-[#b8df4b] px-5 font-semibold text-[#073b2a] hover:bg-[#c8e95f]"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />

                Complete setup
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* =========================================================
   FINAL REVIEW
========================================================= */

function FarmReview({
  data,
}: {
  data: FarmRegistrationData;
}) {
  const totalBlockArea =
    data.blocks.reduce(
      (total, block) => {
        if (
          typeof block.areaAcres ===
          "number"
        ) {
          return (
            total +
            block.areaAcres
          );
        }

        return total;
      },
      0
    );

  const totalBlockPlants =
    data.blocks.reduce(
      (total, block) => {
        if (
          typeof block.approximatePlants ===
          "number"
        ) {
          return (
            total +
            block.approximatePlants
          );
        }

        return total;
      },
      0
    );

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e7f6eb]">
          <CheckCircle2 className="h-[18px] w-[18px] text-[#177944]" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#146c43]">
          Final Review
        </p>
      </div>

      <h2 className="vg-heading mt-4 text-2xl font-bold text-[#13271d]">
        Review your farm setup
      </h2>

      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        Check the details before completing
        registration. You can edit these
        later as the farm changes.
      </p>

      {/* FARM SUMMARY */}

      <div className="mt-7 rounded-[26px] bg-[#073b2a] p-5 text-white sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b8df4b]">
              <Leaf className="h-6 w-6 text-[#073b2a]" />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                Registered farm
              </p>

              <h3 className="mt-1 text-lg font-semibold">
                {data.farmName ||
                  "Unnamed farm"}
              </h3>
            </div>
          </div>

          <div className="w-fit rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[10px] font-semibold text-white/70">
            {data.blocks.length} planting{" "}
            {data.blocks.length === 1
              ? "block"
              : "blocks"}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <FarmSummaryMetric
            label="Main variety"
            value={
              data.bananaVariety ||
              "--"
            }
          />

          <FarmSummaryMetric
            label="Approx. area"
            value={
              data.approximateAreaAcres !==
              ""
                ? `${data.approximateAreaAcres} acres`
                : totalBlockArea > 0
                  ? `${totalBlockArea.toFixed(
                      2
                    )} acres`
                  : "--"
            }
          />

          <FarmSummaryMetric
            label="Approx. plants"
            value={
              data.approximatePlantCount !==
              ""
                ? `${data.approximatePlantCount}`
                : totalBlockPlants > 0
                  ? `${totalBlockPlants}`
                  : "--"
            }
          />
        </div>
      </div>

      {/* LOCATION */}

      <div className="mt-5 rounded-[22px] border border-border bg-[#fafcfb] p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf5ec]">
            <MapPin className="h-5 w-5 text-[#146c43]" />
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Confirmed Farm Location
            </p>

            <p className="mt-2 text-sm font-semibold text-[#13271d]">
              {data.location.latitude !==
                null &&
              data.location.longitude !==
                null
                ? `${data.location.latitude.toFixed(
                    6
                  )}, ${data.location.longitude.toFixed(
                    6
                  )}`
                : "Location unavailable"}
            </p>
          </div>
        </div>
      </div>

      {/* FARM INFORMATION */}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <ReviewCard
          label="Farm name"
          value={data.farmName}
        />

        <ReviewCard
          label="Main banana variety"
          value={
            data.bananaVariety
          }
        />

        <ReviewCard
          label="Main planting month"
          value={
            formatPlantingMonth(
              data.plantingMonth
            )
          }
        />

        <ReviewCard
          label="Planting blocks"
          value={`${data.blocks.length}`}
        />

        <ReviewCard
          label="Drainage condition"
          value={
            data.readiness
              .drainage
          }
        />

        <ReviewCard
          label="Plant support"
          value={
            data.readiness
              .support
          }
        />

        <ReviewCard
          label="Worker accessibility"
          value={
            data.readiness
              .accessibility
          }
        />

        <ReviewCard
          label="Farm area"
          value={
            data.approximateAreaAcres !==
            ""
              ? `${data.approximateAreaAcres} acres`
              : "Will be confirmed from boundary"
          }
        />
      </div>

      {/* BLOCKS */}

      <div className="mt-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#146c43]">
            Planting blocks
          </p>

          <h3 className="vg-heading mt-1 text-lg font-bold text-[#13271d]">
            Farm management areas
          </h3>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.blocks.map(
            (block, index) => (
              <div
                key={block.id}
                className="rounded-[20px] border border-border bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef7ef]">
                    <Sprout className="h-4 w-4 text-[#146c43]" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#13271d]">
                      {block.name ||
                        `Block ${
                          index + 1
                        }`}
                    </p>

                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {block.variety ||
                        "Variety not provided"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MiniReview
                    label="Planting"
                    value={
                      formatPlantingMonth(
                        block.plantingMonth
                      )
                    }
                  />

                  <MiniReview
                    label="Area"
                    value={
                      block.areaAcres !==
                      ""
                        ? `${block.areaAcres} acres`
                        : "--"
                    }
                  />

                  <MiniReview
                    label="Plants"
                    value={
                      block.approximatePlants !==
                      ""
                        ? `${block.approximatePlants}`
                        : "--"
                    }
                  />

                  <MiniReview
                    label="Block"
                    value={`#${index + 1}`}
                  />
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* READY MESSAGE */}

      <div className="mt-6 rounded-[22px] border border-[#cce4d3] bg-[#f4fbf5] p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#22a35a]" />

          <div>
            <p className="text-sm font-semibold text-[#13271d]">
              Farm profile is ready
            </p>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              After this registration is
              saved, VazhaiGuard can connect
              the farm profile with live
              weather, farm boundaries,
              geospatial exposure and later
              block-level vulnerability
              analysis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   REVIEW CARD
========================================================= */

function ReviewCard({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-[#fafcfb] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>

      <p className="mt-2 text-sm font-semibold capitalize text-[#13271d]">
        {value ||
          "Not provided"}
      </p>
    </div>
  );
}

/* =========================================================
   FARM SUMMARY METRIC
========================================================= */

function FarmSummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/40">
        {label}
      </p>

      <p className="mt-1.5 truncate text-sm font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   MINI REVIEW
========================================================= */

function MiniReview({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[#f6f9f7] px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 truncate text-[11px] font-semibold text-[#13271d]">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   FORMAT PLANTING MONTH
========================================================= */

function formatPlantingMonth(
  value: string
) {
  if (!value) {
    return "Not provided";
  }

  const [
    year,
    month,
  ] = value.split("-");

  const monthIndex =
    Number(month) - 1;

  if (
    Number.isNaN(
      monthIndex
    )
  ) {
    return value;
  }

  const date =
    new Date(
      Number(year),
      monthIndex,
      1
    );

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      year: "numeric",
    }
  );
}