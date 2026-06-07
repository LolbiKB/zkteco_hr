import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { App } from "./ui/App";
import { HrAppShell } from "./ui/HrAppShell";
import { WeeklySchedulePage } from "./ui/WeeklySchedulePage";
import "./index.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FrappeProvider } from "frappe-react-sdk";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FrappeProvider enableSocket={false}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<HrAppShell />}>
              <Route path="/hr-attendance" element={<App />} />
              <Route path="/hr-schedule" element={<WeeklySchedulePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/hr-attendance" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </FrappeProvider>
  </React.StrictMode>
);
