import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ColdOpen } from "./pages/ColdOpen";
import { Identify } from "./pages/Identify";
import { ArmVault } from "./pages/ArmVault";
import { Cockpit } from "./pages/Cockpit";
import { WatchClaim } from "./pages/WatchClaim";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ColdOpen />} />
        <Route path="/identify" element={<Identify />} />
        <Route path="/arm" element={<ArmVault />} />
        <Route path="/cockpit" element={<Cockpit />} />
        <Route path="/watch" element={<WatchClaim />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
