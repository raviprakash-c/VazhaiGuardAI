import { useState } from 'react';

export interface FarmProfile {
  location: {
    village: string;
    taluk: string;
    district: string;
  };
  land_characteristics: {
    is_verified_agricultural: boolean;
    accessibility: string;
    water_access: string;
  };
  status: string;
}

export const useLandIntelligence = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFarmBoundary = async (farmerId: string, coordinates: number[][]) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8000/api/farm/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmer_id: farmerId,
          coordinates: [coordinates] // Wrap in array for GeoJSON polygon
        }),
      });

      if (!response.ok) throw new Error('Validation failed');

      const data = await response.json();
      return data; // Contains full farm profile
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { validateFarmBoundary, loading, error };
};