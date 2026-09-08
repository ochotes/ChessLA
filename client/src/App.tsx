import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";

import { LandingPage } from "./pages/LandingPage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PlayPage } from "./pages/PlayPage";
import { GamePage } from "./pages/GamePage";
import { ProfilePage } from "./pages/ProfilePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { FriendsPage } from "./pages/FriendsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsPage } from "./pages/TermsPage";
import { InvitePage } from "./pages/InvitePage";
import { AdminPage } from "./pages/AdminPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout><LandingPage /></Layout>} />
      <Route path="/how-it-works" element={<Layout><HowItWorksPage /></Layout>} />
      <Route path="/login" element={<Layout><LoginPage /></Layout>} />
      <Route path="/register" element={<Layout><RegisterPage /></Layout>} />
      <Route path="/forgot-password" element={<Layout><ForgotPasswordPage /></Layout>} />
      <Route path="/reset-password" element={<Layout><ResetPasswordPage /></Layout>} />
      <Route path="/privacy" element={<Layout><PrivacyPage /></Layout>} />
      <Route path="/terms" element={<Layout><TermsPage /></Layout>} />
      <Route path="/leaderboard" element={<Layout><LeaderboardPage /></Layout>} />
      <Route path="/profile/:username" element={<Layout><ProfilePage /></Layout>} />
      <Route path="/invite/:code" element={<Layout><InvitePage /></Layout>} />

      <Route
        path="/dashboard"
        element={
          <Layout>
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/play"
        element={
          <Layout>
            <ProtectedRoute>
              <PlayPage />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/game/:id"
        element={
          <Layout fullBleed>
            <ProtectedRoute>
              <GamePage />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/friends"
        element={
          <Layout>
            <ProtectedRoute>
              <FriendsPage />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/history"
        element={
          <Layout>
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/settings"
        element={
          <Layout>
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="/admin"
        element={
          <Layout>
            <ProtectedRoute roles={["ADMIN", "MODERATOR"]}>
              <AdminPage />
            </ProtectedRoute>
          </Layout>
        }
      />

      <Route path="*" element={<Layout><NotFoundPage /></Layout>} />
    </Routes>
  );
}
