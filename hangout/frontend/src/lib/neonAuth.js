import { createAuthClient } from "@neondatabase/auth";
import { SupabaseAuthAdapter } from "@neondatabase/auth/vanilla/adapters";

const auth = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
  adapter: SupabaseAuthAdapter(),
});

export default auth;
