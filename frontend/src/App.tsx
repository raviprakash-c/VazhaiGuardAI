import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import DashboardPage from "./pages/DashboardPage";
import FarmSetupPage from "./pages/FarmSetupPage";
import VoiceRegistrationPage from "./pages/VoiceRegistrationPage";
import FarmLocationPage from "./pages/FarmLocationPage";
import FarmHomePage from "./pages/FarmHomePage";
import WeatherPage from "./pages/WeatherPage";
import RiskPage from "./pages/RiskPage";
import ActionPlanPage from "./pages/ActionPlanPage";
import CopilotPage from "./pages/CopilotPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="farm/setup" element={<FarmSetupPage />} />
        <Route path="farm/voice-register" element={<VoiceRegistrationPage />} />
        <Route path="farm/location" element={<FarmLocationPage />} />
        <Route path="farm/home" element={<FarmHomePage />} />
        <Route path="weather" element={<WeatherPage />} />
        <Route path="risk" element={<RiskPage />} />
        <Route path="plan" element={<ActionPlanPage />} />
        <Route path="copilot" element={<CopilotPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
