import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { sendEmail, verificationCodeEmail } from "../utils/brevo.js";
import { sha256Hex as hashToken } from "../utils/hash.js";

export const authRouter = Router();

const REFRESH_COOKIE = "fm_refresh";
const isProd = process.env.NODE_ENV === "production";
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  // 6-digit numeric code, zero-padded (e.g. "042817"), not "042817" as a
  // number that could lose a leading zero.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

async function issueSession(res: import("express").Response, user: {
  id: number;
  name: string;
  email: string;
  role: string;
  effective_station_id: number | null;
}) {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    stationId: user.effective_station_id,
    name: user.name,
  });
  const refreshToken = signRefreshToken(user.id);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '7 days')`,
    [user.id, hashToken(refreshToken)]
  );
  await pool.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);

  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  });

  res.json({
    accessToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, stationId: user.effective_station_id },
  });
}

/**
 * Sends the verification email for real via Brevo. If that fails (most
 * commonly: BREVO_API_KEY isn't configured yet), production still fails
 * loudly \u2014 a "successful" auth flow that never actually delivered a code
 * would be a serious security and UX problem. In development only, we fall
 * back to logging the code to the server console so the whole flow is
 * still testable before a real Brevo account is wired up.
 */
async function sendVerificationCode(email: string, name: string, code: string, context: string) {
  try {
    await sendEmail({
      to: email,
      toName: name,
      subject: "Your FuelMaster verification code",
      htmlContent: verificationCodeEmail(code, context),
    });
  } catch (err) {
    if (isProd) throw err;
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(
      `[auth] Brevo send FAILED for ${email} \u2014 real reason: ${reason}\n` +
        `[auth] Falling back to console for dev only. Verification code: ${code}\n` +
        `[auth] Most common cause: BREVO_SENDER_EMAIL isn't a verified sender in your Brevo account yet ` +
        `(Brevo dashboard > Senders, Domains & Dedicated IPs > Senders \u2014 add it there and confirm the ` +
        `verification email Brevo sends you).`
    );
  }
}

async function createChallenge(params: {
  purpose: "login" | "signup";
  email: string;
  userId: number | null;
  payload?: object;
}): Promise<{ challengeId: string; code: string }> {
  const challengeId = crypto.randomBytes(24).toString("hex");
  const code = generateCode();
  const codeHash = hashToken(code);

  await pool.query(
    `INSERT INTO auth_challenges (challenge_id, purpose, user_id, email, code_hash, payload, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6, now() + interval '${CODE_TTL_MINUTES} minutes')`,
    [challengeId, params.purpose, params.userId, params.email, codeHash, params.payload ? JSON.stringify(params.payload) : null]
  );

  return { challengeId, code };
}

async function consumeChallenge(challengeId: string, code: string, purpose: "login" | "signup") {
  const { rows } = await pool.query(
    `SELECT * FROM auth_challenges WHERE challenge_id = $1 AND purpose = $2`,
    [challengeId, purpose]
  );
  const challenge = rows[0];
  if (!challenge) throw new HttpError(400, "This verification link has expired. Please start again.");
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    await pool.query(`DELETE FROM auth_challenges WHERE id = $1`, [challenge.id]);
    throw new HttpError(400, "This code has expired. Please request a new one.");
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    await pool.query(`DELETE FROM auth_challenges WHERE id = $1`, [challenge.id]);
    throw new HttpError(429, "Too many incorrect attempts. Please request a new code.");
  }

  if (hashToken(code) !== challenge.code_hash) {
    await pool.query(`UPDATE auth_challenges SET attempts = attempts + 1 WHERE id = $1`, [challenge.id]);
    throw new HttpError(401, "Incorrect code. Please try again.");
  }

  await pool.query(`DELETE FROM auth_challenges WHERE id = $1`, [challenge.id]);
  return challenge;
}

// ---------------------------------------------------------------------------
// Sign in (with conditional 2FA)
// ---------------------------------------------------------------------------
authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) throw new HttpError(400, "Email and password are required");

    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, role, status, station_id,
              COALESCE(current_station_id, station_id) AS effective_station_id
       FROM users WHERE email = $1`,
      [String(email).toLowerCase()]
    );
    const user = rows[0];
    if (!user) throw new HttpError(401, "Invalid email or password");
    if (user.status === "Suspended") throw new HttpError(403, "This account has been suspended");

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new HttpError(401, "Invalid email or password");

    // 2FA is a per-station security setting (Settings > Security), checked
    // against the user's home station regardless of which station their
    // session is currently scoped to.
    const settingsRow = await pool.query(`SELECT data FROM station_settings WHERE station_id = $1`, [user.station_id]);
    const twoFactorEnabled = settingsRow.rows[0]?.data?.security?.twoFactorEnabled === true;

    if (!twoFactorEnabled) {
      await issueSession(res, user);
      return;
    }

    const { challengeId, code } = await createChallenge({ purpose: "login", email: user.email, userId: user.id });
    await sendVerificationCode(
      user.email,
      user.name,
      code,
      "Enter this code to finish signing in to FuelMaster."
    );

    res.json({ requiresTwoFactor: true, challengeId, email: user.email });
  })
);

const verifyCodeSchema = z.object({ challengeId: z.string().min(10), code: z.string().length(6) });

authRouter.post(
  "/verify-2fa",
  asyncHandler(async (req, res) => {
    const parsed = verifyCodeSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "A valid challengeId and 6-digit code are required");

    const challenge = await consumeChallenge(parsed.data.challengeId, parsed.data.code, "login");

    const { rows } = await pool.query(
      `SELECT id, name, email, role, status, COALESCE(current_station_id, station_id) AS effective_station_id
       FROM users WHERE id = $1`,
      [challenge.user_id]
    );
    const user = rows[0];
    if (!user) throw new HttpError(404, "User not found");
    if (user.status === "Suspended") throw new HttpError(403, "This account has been suspended");

    await issueSession(res, user);
  })
);

const resendSchema = z.object({ challengeId: z.string().min(10) });

authRouter.post(
  "/resend-2fa",
  asyncHandler(async (req, res) => {
    const parsed = resendSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "A valid challengeId is required");

    const { rows } = await pool.query(
      `SELECT * FROM auth_challenges WHERE challenge_id = $1 AND purpose = 'login'`,
      [parsed.data.challengeId]
    );
    const existing = rows[0];
    if (!existing) throw new HttpError(400, "This verification session has expired. Please sign in again.");

    const userRow = await pool.query(`SELECT name FROM users WHERE id = $1`, [existing.user_id]);
    const code = generateCode();
    await pool.query(
      `UPDATE auth_challenges SET code_hash = $1, attempts = 0, expires_at = now() + interval '${CODE_TTL_MINUTES} minutes' WHERE id = $2`,
      [hashToken(code), existing.id]
    );
    await sendVerificationCode(existing.email, userRow.rows[0]?.name ?? "", code, "Here's your new FuelMaster sign-in code.");

    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
// Sign up (creates a new station + its first Administrator, email-verified)
// ---------------------------------------------------------------------------
const signupSchema = z.object({
  stationName: z.string().min(2),
  adminName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid signup details");
    const { stationName, adminName, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [normalizedEmail]);
    if (existing.rows.length > 0) throw new HttpError(409, "An account with this email already exists");

    const passwordHash = await bcrypt.hash(password, 12);
    const { challengeId, code } = await createChallenge({
      purpose: "signup",
      email: normalizedEmail,
      userId: null,
      payload: { stationName, adminName, email: normalizedEmail, passwordHash },
    });

    await sendVerificationCode(
      normalizedEmail,
      adminName,
      code,
      `Enter this code to finish creating your FuelMaster account for ${stationName}.`
    );

    res.json({ challengeId, email: normalizedEmail });
  })
);

authRouter.post(
  "/verify-signup",
  asyncHandler(async (req, res) => {
    const parsed = verifyCodeSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "A valid challengeId and 6-digit code are required");

    const challenge = await consumeChallenge(parsed.data.challengeId, parsed.data.code, "signup");
    const payload = challenge.payload as { stationName: string; adminName: string; email: string; passwordHash: string };

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const seq = await client.query(
        `SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::int), 0) + 1 AS next FROM stations`
      );
      const stationCode = `STN-${String(seq.rows[0].next).padStart(3, "0")}`;
      const station = await client.query(
        `INSERT INTO stations (code, name) VALUES ($1,$2) RETURNING id`,
        [stationCode, payload.stationName]
      );
      const stationId = station.rows[0].id;

      const user = await client.query(
        `INSERT INTO users (name, email, password_hash, role, station_id, status)
         VALUES ($1,$2,$3,'Administrator',$4,'Active')
         RETURNING id, name, email, role, station_id AS "effective_station_id"`,
        [payload.adminName, payload.email, payload.passwordHash, stationId]
      );

      await client.query("COMMIT");
      await issueSession(res, user.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

authRouter.post(
  "/resend-signup",
  asyncHandler(async (req, res) => {
    const parsed = resendSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "A valid challengeId is required");

    const { rows } = await pool.query(
      `SELECT * FROM auth_challenges WHERE challenge_id = $1 AND purpose = 'signup'`,
      [parsed.data.challengeId]
    );
    const existing = rows[0];
    if (!existing) throw new HttpError(400, "This verification session has expired. Please start again.");

    const payload = existing.payload as { adminName: string; stationName: string };
    const code = generateCode();
    await pool.query(
      `UPDATE auth_challenges SET code_hash = $1, attempts = 0, expires_at = now() + interval '${CODE_TTL_MINUTES} minutes' WHERE id = $2`,
      [hashToken(code), existing.id]
    );
    await sendVerificationCode(
      existing.email,
      payload.adminName,
      code,
      `Here's your new verification code for ${payload.stationName}.`
    );

    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new HttpError(401, "Missing refresh token");

    let payload: { sub: number };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new HttpError(401, "Invalid or expired refresh token");
    }

    const tokenHash = hashToken(token);
    const { rows } = await pool.query(
      `SELECT rt.user_id, u.name, u.email, u.role, u.status,
              COALESCE(u.current_station_id, u.station_id) AS effective_station_id
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.user_id = $2 AND rt.expires_at > now()`,
      [tokenHash, payload.sub]
    );
    const row = rows[0];
    if (!row) throw new HttpError(401, "Refresh token not recognized");
    if (row.status === "Suspended") throw new HttpError(403, "This account has been suspended");

    const accessToken = signAccessToken({
      sub: row.user_id,
      email: row.email,
      role: row.role,
      stationId: row.effective_station_id,
      name: row.name,
    });

    res.json({ accessToken });
  })
);

const switchStationSchema = z.object({ stationId: z.number().int() });

authRouter.post(
  "/switch-station",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = switchStationSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "A valid stationId is required");
    const { stationId } = parsed.data;

    const userRow = await pool.query(`SELECT role, station_id AS "homeStationId" FROM users WHERE id = $1`, [
      req.user!.sub,
    ]);
    if (userRow.rows.length === 0) throw new HttpError(404, "User not found");
    const { role, homeStationId } = userRow.rows[0];

    if (role !== "Administrator" && stationId !== homeStationId) {
      throw new HttpError(403, "Only Administrators can switch to a different station");
    }

    const station = await pool.query(`SELECT id, name FROM stations WHERE id = $1`, [stationId]);
    if (station.rows.length === 0) throw new HttpError(404, "Station not found");

    await pool.query(`UPDATE users SET current_station_id = $1 WHERE id = $2`, [stationId, req.user!.sub]);

    const accessToken = signAccessToken({
      sub: req.user!.sub,
      email: req.user!.email,
      role: req.user!.role,
      stationId,
      name: req.user!.name,
    });

    res.json({ accessToken, station: station.rows[0] });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      await pool.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [hashToken(token)]);
    }
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.status(204).end();
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);