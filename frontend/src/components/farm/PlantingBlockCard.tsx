import {
  CalendarDays,
  Plus,
  Sprout,
  Trash2,
} from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";

import type { PlantingBlock } from "../../types/farm";

type Props = {
  blocks: PlantingBlock[];
  onChange: (
    blocks: PlantingBlock[]
  ) => void;
};

export default function PlantingBlockStep({
  blocks,
  onChange,
}: Props) {
  const addBlock = () => {
    onChange([
      ...blocks,
      {
        id: crypto.randomUUID(),
        name: `Block ${String.fromCharCode(
          65 + blocks.length
        )}`,
        variety: "",
        plantingMonth: "",
        areaAcres: "",
        approximatePlants: "",
      },
    ]);
  };

  const updateBlock = (
    id: string,
    field: keyof PlantingBlock,
    value: string | number
  ) => {
    onChange(
      blocks.map((block) =>
        block.id === id
          ? {
              ...block,
              [field]: value,
            }
          : block
      )
    );
  };

  const removeBlock = (
    id: string
  ) => {
    onChange(
      blocks.filter(
        (block) =>
          block.id !== id
      )
    );
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#146c43]">
            Step 3
          </p>

          <h2 className="vg-heading mt-1 text-2xl font-bold text-[#13271d]">
            Create planting blocks
          </h2>

          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            A block represents a planting batch or management area,
            not individual banana trees.
          </p>
        </div>

        <Button
          onClick={addBlock}
          className="w-fit rounded-xl bg-[#0b4d36] text-white hover:bg-[#073b2a]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add block
        </Button>
      </div>

      {blocks.length === 0 ? (
        <div className="mt-6 flex min-h-[240px] flex-col items-center justify-center rounded-[26px] border border-dashed border-[#b8cabd] bg-[#f6faf7] p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
            <Sprout className="h-6 w-6 text-[#146c43]" />
          </div>

          <h3 className="mt-4 text-base font-semibold">
            No planting blocks yet
          </h3>

          <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
            Add one block for each planting batch or field section
            you manage differently.
          </p>

          <Button
            onClick={addBlock}
            className="mt-5 rounded-xl bg-[#b8df4b] text-[#073b2a] hover:bg-[#c8e95f]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create first block
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {blocks.map(
            (block, index) => (
              <div
                key={block.id}
                className="rounded-[24px] border border-border bg-white p-5 shadow-[0_6px_25px_rgba(7,59,42,0.04)]"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf5ec] text-sm font-bold text-[#146c43]">
                      {index + 1}
                    </div>

                    <div>
                      <p className="text-sm font-semibold">
                        {block.name ||
                          `Block ${
                            index + 1
                          }`}
                      </p>

                      <p className="text-[10px] text-muted-foreground">
                        Planting / management block
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removeBlock(
                        block.id
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    value={block.name}
                    onChange={(
                      event
                    ) =>
                      updateBlock(
                        block.id,
                        "name",
                        event.target
                          .value
                      )
                    }
                    placeholder="Block name"
                    className="h-11 rounded-xl"
                  />

                  <Input
                    value={
                      block.variety
                    }
                    onChange={(
                      event
                    ) =>
                      updateBlock(
                        block.id,
                        "variety",
                        event.target
                          .value
                      )
                    }
                    placeholder="Banana variety"
                    className="h-11 rounded-xl"
                  />

                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                      type="month"
                      value={
                        block.plantingMonth
                      }
                      onChange={(
                        event
                      ) =>
                        updateBlock(
                          block.id,
                          "plantingMonth",
                          event.target
                            .value
                        )
                      }
                      className="h-11 rounded-xl pl-10"
                    />
                  </div>

                  <Input
                    type="number"
                    min="0"
                    value={
                      block.areaAcres
                    }
                    onChange={(
                      event
                    ) =>
                      updateBlock(
                        block.id,
                        "areaAcres",
                        event.target
                              .value ===
                            ""
                          ? ""
                          : Number(
                              event
                                .target
                                .value
                            )
                      )
                    }
                    placeholder="Area in acres"
                    className="h-11 rounded-xl"
                  />

                  <div className="md:col-span-2">
                    <Input
                      type="number"
                      min="0"
                      value={
                        block.approximatePlants
                      }
                      onChange={(
                        event
                      ) =>
                        updateBlock(
                          block.id,
                          "approximatePlants",
                          event.target
                              .value ===
                            ""
                          ? ""
                          : Number(
                              event
                                .target
                                .value
                            )
                        )
                      }
                      placeholder="Approximate plant count"
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}