import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AppShell from "./components/layout/AppShell";

import DashboardPage from "./pages/DashboardPage";
import FarmSetupPage from "./pages/FarmSetupPage";
import VoiceRegistrationPage from "./pages/VoiceRegistrationPage";
import FarmLocationPage from "./pages/FarmLocationPage";
import FarmHomePage from "./pages/FarmHomePage";
// Inside frontend/src/App.tsx


// ... inside your Routes component ...
//<Route path="/farm/location" element={<FarmLocationPage />} />

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>

        <Route
          index
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />
         <Route path="/farm/location" element={<FarmLocationPage />} />
        <Route
          path="dashboard"
          element={
            <DashboardPage />
          }
        />

        <Route
          path="farm/setup"
          element={
            <FarmSetupPage />
          }
        />

        <Route
          path="farm/voice-register"
          element={
            <VoiceRegistrationPage />
          }
        />

        <Route
          path="farm/location"
          element={
            <FarmLocationPage />
          }
        />
          <Route
  path="farm/location"
  element={
    <FarmLocationPage />
  }
/>

<Route
  path="farm/home"
  element={
    <FarmHomePage />
  }
/>
        <Route
          path="*"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

      </Route>
    </Routes>
  );
}