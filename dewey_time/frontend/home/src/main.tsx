import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FrappeProvider, useFrappeGetCall } from "frappe-react-sdk";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Launcher } from "./Launcher";
import { AdminTiles } from "./AdminTiles";
import type { LauncherData } from "./types";
import "./index.css";

const METHOD = "dewey_time.attendance_engine.launcher.get_launcher";

function AdminGuard() {
  const { data, isLoading } = useFrappeGetCall<{ message: LauncherData }>(METHOD, undefined, METHOD);
  if (isLoading) return null;
  if (!data?.message?.user?.can_manage_tiles) return <Navigate to="/home" replace />;
  return <AdminTiles />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FrappeProvider enableSocket={false}>
      <BrowserRouter>
        <Routes>
          <Route path="/home" element={<Launcher />} />
          <Route path="/home/admin" element={<AdminGuard />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </BrowserRouter>
    </FrappeProvider>
  </StrictMode>
);
