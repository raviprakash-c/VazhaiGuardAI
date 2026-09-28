import { useState } from "react";

import {
  searchReferenceParcels,
  type LocationSearchRequest,
} from "../services/farmMapApi";


export function useLandIntelligence() {

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);


  const searchParcels = async (
    request: LocationSearchRequest
  ) => {

    setLoading(true);
    setError(null);

    try {

      return await searchReferenceParcels(
        request
      );

    } catch (err) {

      const message =
        err instanceof Error
          ? err.message
          : "Reference parcel search failed.";

      setError(message);

      return null;

    } finally {

      setLoading(false);

    }
  };


  return {
    searchParcels,
    loading,
    error,
  };
}