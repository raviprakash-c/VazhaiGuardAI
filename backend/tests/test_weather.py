from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import HTTPException

import weather


class WeatherRiskHelperTests(IsolatedAsyncioTestCase):
    def test_rain_risk_thresholds(self):
        self.assertEqual(weather._rain_risk(80, 0), "high")
        self.assertEqual(weather._rain_risk(50, 0), "moderate")
        self.assertEqual(weather._rain_risk(10, 0), "low")
        self.assertEqual(weather._rain_risk(10, 15), "high")

    def test_wind_risk_thresholds(self):
        self.assertEqual(weather._wind_risk(10, 45), "high")
        self.assertEqual(weather._wind_risk(18, 10), "moderate")
        self.assertEqual(weather._wind_risk(5, 5), "low")

    def test_overall_status_prioritizes_highest_risk(self):
        self.assertEqual(weather._overall_weather_status("high", "low"), "attention")
        self.assertEqual(weather._overall_weather_status("low", "moderate"), "monitor")
        self.assertEqual(weather._overall_weather_status("low", "low"), "favorable")

    async def test_provider_network_error_becomes_retryable_503(self):
        client = AsyncMock()
        client.__aenter__.return_value.get.side_effect = httpx.ConnectError("offline")
        with patch("weather.httpx.AsyncClient", return_value=client):
            with self.assertRaises(HTTPException) as raised:
                await weather.get_weather(9.5, 77.5)
        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("temporarily unavailable", raised.exception.detail.lower())


if __name__ == "__main__":
    import unittest
    unittest.main()
