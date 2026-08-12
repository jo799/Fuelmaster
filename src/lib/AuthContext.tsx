import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, apiFetch, setAccessToken, ApiError } from "./api";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  stationId: number | null;
}

type LoginResult = { requiresTwoFactor: true; challengeId: string; email: string } | { requiresTwoFactor: false };
type ChallengeResult = { challengeId: string; email: string };

interface AuthContextValue {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyTwoFactor: (challengeId: string, code: string) => Promise<void>;
  resendTwoFactor: (challengeId: string) => Promise<void>;
  signUp: (stationName: string, adminName: string, email: string, password: string) => Promise<ChallengeResult>;
  verifySignup: (challengeId: string, code: string) => Promise<void>;
  resendSignup: (challengeId: string) => Promise<void>;
  logout: () => Promise<void>;
  switchStation: (stationId: number, options?: { reload?: boolean }) => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<{ accessToken: string }>("/auth/refresh", {
          method: "POST",
          skipAuthRetry: true,
        });
        setAccessToken(data.accessToken);
        const me = await apiFetch<{ user: AuthUser & { sub: number } }>("/auth/me");
        setUser({ ...me.user, id: me.user.sub });
        setStatus("authenticated");
      } catch {
        setStatus("unauthenticated");
      }
    })();
  }, []);

  function completeSession(data: { accessToken: string; user: AuthUser }) {
    setAccessToken(data.accessToken);
    setUser(data.user);
    setStatus("authenticated");
  }

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    setError(null);
    try {
      const data = await apiFetch<
        { accessToken: string; user: AuthUser } | { requiresTwoFactor: true; challengeId: string; email: string }
      >("/auth/login", { method: "POST", body: { email, password }, skipAuthRetry: true });

      if ("requiresTwoFactor" in data) {
        return { requiresTwoFactor: true, challengeId: data.challengeId, email: data.email };
      }
      completeSession(data);
      return { requiresTwoFactor: false };
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
      throw err;
    }
  }, []);

  const verifyTwoFactor = useCallback(async (challengeId: string, code: string) => {
    setError(null);
    try {
      const data = await apiFetch<{ accessToken: string; user: AuthUser }>("/auth/verify-2fa", {
        method: "POST",
        body: { challengeId, code },
        skipAuthRetry: true,
      });
      completeSession(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed");
      throw err;
    }
  }, []);

  const resendTwoFactor = useCallback(async (challengeId: string) => {
    await apiFetch("/auth/resend-2fa", { method: "POST", body: { challengeId }, skipAuthRetry: true });
  }, []);

  const signUp = useCallback(
    async (stationName: string, adminName: string, email: string, password: string): Promise<ChallengeResult> => {
      setError(null);
      try {
        return await apiFetch<ChallengeResult>("/auth/signup", {
          method: "POST",
          body: { stationName, adminName, email, password },
          skipAuthRetry: true,
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Sign up failed");
        throw err;
      }
    },
    []
  );

  const verifySignup = useCallback(async (challengeId: string, code: string) => {
    setError(null);
    try {
      const data = await apiFetch<{ accessToken: string; user: AuthUser }>("/auth/verify-signup", {
        method: "POST",
        body: { challengeId, code },
        skipAuthRetry: true,
      });
      completeSession(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed");
      throw err;
    }
  }, []);

  const resendSignup = useCallback(async (challengeId: string) => {
    await apiFetch("/auth/resend-signup", { method: "POST", body: { challengeId }, skipAuthRetry: true });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore network errors on logout */
    }
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const switchStation = useCallback(async (stationId: number, options?: { reload?: boolean }) => {
    const data = await apiFetch<{ accessToken: string; station: { id: number; name: string } }>(
      "/auth/switch-station",
      { method: "POST", body: { stationId } }
    );
    setAccessToken(data.accessToken);
    setUser((prev) => (prev ? { ...prev, stationId } : prev));

    if (options?.reload === false) return;
    window.location.reload();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        login,
        verifyTwoFactor,
        resendTwoFactor,
        signUp,
        verifySignup,
        resendSignup,
        logout,
        switchStation,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}