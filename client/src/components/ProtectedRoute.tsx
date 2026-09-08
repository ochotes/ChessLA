import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SkeletonCard } from "./ui/Skeleton";

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Array<"ADMIN" | "MODERATOR"> }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-md py-16">
        <SkeletonCard />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role as "ADMIN" | "MODERATOR")) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
