import {
  Search,
  MapPinned,
  FileSearch,
  ChevronDown,
  Loader2,
} from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type {
  ParcelCandidate,
} from "../../services/parcelApi";

type Props = {
  district: string;
  taluk: string;
  village: string;
  surveyNumber: string;
  subdivision: string;

  candidates: ParcelCandidate[];

  searching: boolean;
  error: string;

  onDistrictChange: (value: string) => void;
  onTalukChange: (value: string) => void;
  onVillageChange: (value: string) => void;
  onSurveyNumberChange: (value: string) => void;
  onSubdivisionChange: (value: string) => void;

  onSearch: () => void;
  onSelect: (parcel: ParcelCandidate) => void;
};

export default function FarmerParcelSearch({
  district,
  taluk,
  village,
  surveyNumber,
  subdivision,
  candidates,
  searching,
  error,
  onDistrictChange,
  onTalukChange,
  onVillageChange,
  onSurveyNumberChange,
  onSubdivisionChange,
  onSearch,
  onSelect,
}: Props) {
  return (
    <section className="space-y-5">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#073b2a]">
            <MapPinned className="h-5 w-5 text-[#b8df4b]" />
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#146c43]">
              Farm registration
            </p>

            <h1 className="mt-1 text-2xl font-bold text-[#13271d]">
              Find your farm parcel
            </h1>
          </div>
        </div>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#66766d]">
          Search the registered parcel data and select the
          boundary that matches your banana farm.
        </p>
      </div>

      {/* Search Card */}
      <div className="rounded-[28px] border border-[#dfe9e2] bg-white p-5 shadow-[0_18px_60px_rgba(7,59,42,0.07)] sm:p-6">

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef7f0]">
            <FileSearch className="h-4 w-4 text-[#146c43]" />
          </div>

          <div>
            <h2 className="text-sm font-bold text-[#13271d]">
              Search cadastral parcel
            </h2>

            <p className="text-xs text-[#66766d]">
              Enter the location details you know.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">

          <SearchField
            label="District"
            value={district}
            placeholder="Example: Thoothukudi"
            onChange={onDistrictChange}
          />

          <SearchField
            label="Taluk"
            value={taluk}
            placeholder="Example: Thoothukudi"
            onChange={onTalukChange}
          />

          <SearchField
            label="Village"
            value={village}
            placeholder="Example: Keelathattaparai"
            onChange={onVillageChange}
          />

          <SearchField
            label="Survey number"
            value={surveyNumber}
            placeholder="Example: 384"
            onChange={onSurveyNumberChange}
          />

          <SearchField
            label="Subdivision"
            value={subdivision}
            placeholder="Optional"
            onChange={onSubdivisionChange}
          />

          <div className="flex items-end">
            <Button
              type="button"
              onClick={onSearch}
              disabled={searching}
              className="h-11 w-full rounded-xl bg-[#0b4d36] text-white shadow-sm hover:bg-[#073b2a]"
            >
              {searching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Find my parcel
                </>
              )}
            </Button>
          </div>

        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-[#f2c7c4] bg-[#fff5f4] px-4 py-3 text-sm text-[#a83a34]">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {candidates.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#13271d]">
                Matching parcels
              </h2>

              <p className="text-xs text-[#66766d]">
                Select the parcel that matches your farm.
              </p>
            </div>

            <span className="rounded-full bg-[#eef7f0] px-3 py-1 text-xs font-bold text-[#146c43]">
              {candidates.length} found
            </span>
          </div>

          <div className="grid gap-3">
            {candidates.map((parcel) => (
              <button
                key={parcel.parcel_id}
                type="button"
                onClick={() => onSelect(parcel)}
                className="group w-full rounded-[22px] border border-[#dfe9e2] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#9fcf74] hover:shadow-[0_14px_40px_rgba(7,59,42,0.10)]"
              >
                <div className="flex items-center justify-between gap-4">

                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef7f0]">
                      <MapPinned className="h-5 w-5 text-[#146c43]" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#13271d]">
                        Survey No. {parcel.survey_number || "—"}
                        {parcel.subdivision
                          ? ` / ${parcel.subdivision}`
                          : ""}
                      </p>

                      <p className="mt-1 truncate text-xs text-[#66766d]">
                        {parcel.village || village}
                        {parcel.unit_id
                          ? ` • Unit ${parcel.unit_id}`
                          : ""}
                        {parcel.block_id
                          ? ` • Block ${parcel.block_id}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 rounded-xl bg-[#073b2a] px-3 py-2 text-xs font-bold text-white transition group-hover:bg-[#146c43]">
                    View
                  </span>

                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SearchField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[#13271d]">
        {label}
      </span>

      <Input
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="h-11 rounded-xl border-[#dfe9e2] bg-[#fbfdfb]"
      />
    </label>
  );
}