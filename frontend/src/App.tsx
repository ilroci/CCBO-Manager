import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth, RequireRole } from "@/auth/guards";
import { NAV_ITEMS } from "@/auth/permissions";
import { AppLayout } from "@/components/AppLayout";
import { CatalogPage } from "@/pages/CatalogPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { MyRentalsPage } from "@/pages/MyRentalsPage";
import { OutingDetailPage } from "@/pages/OutingDetailPage";
import { OutingsPage } from "@/pages/OutingsPage";
import { NewRentalPage } from "@/pages/NewRentalPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { PriceListPage } from "@/pages/PriceListPage";
import { SuggestionsPage } from "@/pages/SuggestionsPage";
import { UsersPage } from "@/pages/UsersPage";

/** Pagine già implementate; le altre voci di NAV_ITEMS mostrano un segnaposto. */
const PAGES: Record<string, React.ReactNode> = {
  "/": <DashboardPage />,
  "/catalog": <CatalogPage />,
  "/my-rentals": <MyRentalsPage />,
  "/outings": <OutingsPage />,
  "/users": <UsersPage />,
  "/price-list": <PriceListPage />,
  "/suggestions": <SuggestionsPage />,
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
        {/* Sotto-pagina di "I miei noleggi": stessi ruoli */}
        <Route path="/my-rentals/new" element={<NewRentalPage />} />
        <Route
          path="/outings/:id"
          element={
            <RequireRole roles={["ADMIN", "INSTRUCTOR"]}>
              <OutingDetailPage />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
