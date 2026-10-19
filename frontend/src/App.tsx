import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth, RequireRole } from "@/auth/guards";
import { NAV_ITEMS } from "@/auth/permissions";
import { AppLayout } from "@/components/AppLayout";
import { CatalogPage } from "@/pages/CatalogPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { PriceListPage } from "@/pages/PriceListPage";
import { UsersPage } from "@/pages/UsersPage";

/** Pagine già implementate; le altre voci di NAV_ITEMS mostrano un segnaposto. */
const PAGES: Record<string, React.ReactNode> = {
  "/": <DashboardPage />,
  "/catalog": <CatalogPage />,
  "/users": <UsersPage />,
  "/price-list": <PriceListPage />,
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        {NAV_ITEMS.map((item) => (
          <Route
            key={item.to}
            path={item.to}
            element={
              <RequireRole roles={item.roles}>
                {PAGES[item.to] ?? <PlaceholderPage title={item.label} description={item.description} />}
              </RequireRole>
            }
          />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
