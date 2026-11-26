import { create } from "zustand";

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem("natillera_user") || "null"),
  setSession: (session) => {
    localStorage.setItem("natillera_access", session.accessToken);
    localStorage.setItem("natillera_refresh", session.refreshToken);
    localStorage.setItem("natillera_user", JSON.stringify(session.user));
    set({ user: session.user });
  },
  logout: () => {
    localStorage.removeItem("natillera_access");
    localStorage.removeItem("natillera_refresh");
    localStorage.removeItem("natillera_user");
    set({ user: null });
  }
}));
