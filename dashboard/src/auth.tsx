import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Role } from "./types";

interface AuthValue {
  session: Session | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue>(null!);
export const useAuth = () => useContext(Ctx);

const ROLES: Role[] = ["admin", "fleet", "station"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const raw = session?.user.app_metadata?.role as string | undefined;
  const role = ROLES.includes(raw as Role) ? (raw as Role) : null;

  const value: AuthValue = {
    session,
    role,
    loading,
    signIn: async (email, password) => {
      const { error } = await supabase!.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    },
    signOut: async () => {
      await supabase!.auth.signOut();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
