import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AppShell from "./components/layout/AppShell";
import DashboardPage from "./pages/DashboardPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          <Route
            path="dashboard"
            element={<DashboardPage />}
          />

          <Route
            path="*"
            element={<Navigate to="/dashboard" replace />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}