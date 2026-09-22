import { useState, useCallback } from "react";

interface GeolocationResult {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | undefined;
  loading: boolean;
  error: string | null;
  getCurrentLocation: () => void;
}

export function useGeolocation(): GeolocationResult {
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("உங்கள் உலாவியில் இடம் கண்டறியும் வசதி இல்லை.");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setAccuracy(position.coords.accuracy);
        setLoading(false);
      },
      (err) => {
        let msg = "இடத்தைக் கண்டறிய முடியவில்லை.";
        if (err.code === 1) msg = "இட அனுமதி மறுக்கப்பட்டது.";
        if (err.code === 2) msg = "இடம் கிடைக்கவில்லை.";
        if (err.code === 3) msg = "காலம் முடிந்தது.";
        
        setError(msg);
        setLoading(false);
        
        // Fallback coordinates (Tenkasi area) if failed
        setLatitude(9.48);
        setLongitude(77.65);
        setAccuracy(undefined);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  return {
    latitude,
    longitude,
    accuracy,
    loading,
    error,
    getCurrentLocation,
  };
}