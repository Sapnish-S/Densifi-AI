import { betterAuth } from "better-auth"
import { pool } from "@/lib/db"
import { hashSync, compareSync } from "bcrypt-ts"

// Base URL comes from explicit env configuration.
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"

const trustedOrigins = [baseURL, "http://localhost:3000"]
for (const origin of (process.env.TRUSTED_ORIGINS ?? "").split(",")) {
  const o = origin.trim()
  if (o && !trustedOrigins.includes(o)) trustedOrigins.push(o)
}


export const auth = betterAuth({
  database: pool,
  baseURL,
  trustedOrigins,
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "patient",
        input: false,
      },
    },
  },
  emailAndPassword: { 
    enabled: true,
    password: {
      hash: async (password) => {
        return hashSync(password, 12)
      },
      verify: async ({ hash, password }) => {
        // Better Auth's default uses `:` in its hashes. bcrypt does not.
        if (hash.includes(':')) {
           // Fallback for older scrypt passwords isn't implemented here.
           // Users will need to reset their passwords to get a bcrypt hash.
           return false;
        }
        return compareSync(password, hash);
      }
    }
  },
  // Test-only escape hatch: the E2E suite signs up many users from one IP, which trips
  // Better Auth's default production rate limiter. Unset everywhere but local compose.
  ...(process.env.AUTH_RATE_LIMIT === "disabled" && { rateLimit: { enabled: false } }),
  ...(process.env.NODE_ENV === "development" && {
    advanced: {
      defaultCookieAttributes: { sameSite: "none", secure: true },
    },
  }),
})
