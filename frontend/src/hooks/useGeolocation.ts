import { useState } from "react";

type Coordinates = {
  latitude: number;
  longitude: number;
};

export function useGeolocation() {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("GPS is not supported by this browser.");
      return;
    }

    setIsLocating(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setIsLocating(false);
      },
      (error) => {
        if (error.code === 1) {
          setLocationError(
            "Location permission denied. Please allow location access."
          );
        } else if (error.code === 2) {
          setLocationError("Unable to detect your location.");
        } else if (error.code === 3) {
          setLocationError("Location request timed out. Please try again.");
        } else {
          setLocationError("Unable to get your location.");
        }

        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  return {
    coords,
    isLocating,
    locationError,
    getCurrentLocation,
  };
}