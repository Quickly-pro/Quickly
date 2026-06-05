import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { AuthProvider } from "@/context/AuthContext";
import { CompanyProvider } from "@/context/CompanyContext";
import { PremiumProvider } from "@/context/PremiumContext";
import { LanguageProvider } from "@/context/LanguageContext";
import i18n from "./i18n";

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <LanguageProvider>
          <CompanyProvider>
            <PremiumProvider>
              <NotificationsProvider>
                <BrowserRouter basename={__BASE_PATH__}>
                  <AppRoutes />
                </BrowserRouter>
              </NotificationsProvider>
            </PremiumProvider>
          </CompanyProvider>
        </LanguageProvider>
      </AuthProvider>
    </I18nextProvider>
  );
}

export default App;