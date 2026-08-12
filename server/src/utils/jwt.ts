import jwt from "jsonwebtoken";

export interface AccessTokenPayload {
  sub: number;
  email: string;
  role: string;
  stationId: number | null;
  name: string;
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? "15m";
const REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? "7d";
const ALGORITHM = "HS256" as const;

const isProd = process.env.NODE_ENV === "production";
const PLACEHOLDER_SECRETS = new Set(["dev_access_secret_change_me", "dev_refresh_secret_change_me"]);

// Fail fast at startup rather than silently signing tokens with a missing or
// well-known placeholder secret \u2014 either would let anyone forge a valid
// session. This only enforces the check in production so local dev keeps
// working with the shipped .env defaults.
if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set (see server/.env).");
}
if (isProd && (PLACEHOLDER_SECRETS.has(ACCESS_SECRET) || PLACEHOLDER_SECRETS.has(REFRESH_SECRET))) {
  throw new Error(
    "Refusing to start in production with the default dev JWT secrets. Generate real ones (e.g. `openssl rand -hex 32`) and set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET."
  );
}

// The check above already guarantees these are set; narrow the type so the
// functions below don't need non-null assertions scattered through them.
const accessSecret: string = ACCESS_SECRET;
const refreshSecret: string = REFRESH_SECRET;

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, accessSecret, { expiresIn: ACCESS_TTL as jwt.SignOptions["expiresIn"], algorithm: ALGORITHM });
}

export function signRefreshToken(userId: number) {
  return jwt.sign({ sub: userId }, refreshSecret, { expiresIn: REFRESH_TTL as jwt.SignOptions["expiresIn"], algorithm: ALGORITHM });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, accessSecret, { algorithms: [ALGORITHM] }) as unknown as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): { sub: number } {
  return jwt.verify(token, refreshSecret, { algorithms: [ALGORITHM] }) as unknown as { sub: number };
}