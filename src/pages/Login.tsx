import { useEffect, useRef, useState, type FormEvent } from "react";
import { Flame, Loader2, ArrowLeft, MailCheck, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/AuthContext";

type Step =
  | { name: "signin" }
  | { name: "signup" }
  | { name: "verify-login"; challengeId: string; email: string }
  | { name: "verify-signup"; challengeId: string; email: string };

const inputClass =
  "w-full bg-white/3 border border-border rounded-lg px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:border-accent transition-colors";
const labelClass = "block text-[11px] text-text-faint mb-1.5";

function Brand() {
  return (
    <div className="flex items-center gap-2.5 justify-center mb-7 sm:mb-8">
      <div className="w-9 h-9 rounded-[10px] bg-accent grid place-items-center shrink-0">
        <Flame size={20} className="text-bg" strokeWidth={2.5} />
      </div>
      <div className="text-left leading-tight">
        <div className="text-[16px] font-semibold">FuelMaster</div>
        <div className="text-[11px] text-text-faint">Forecourt Management</div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="text-[12.5px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
      {message}
    </div>
  );
}

export default function Login() {
  const { login, signUp, error } = useAuth();
  const [step, setStep] = useState<Step>({ name: "signin" });

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg px-4 py-8 sm:px-6">
      <div className="w-full max-w-[400px]">
        <Brand />

        {step.name === "signin" && (
          <SignInForm
            error={error}
            onSubmit={async (email, password) => {
              const result = await login(email, password);
              if (result.requiresTwoFactor) {
                setStep({ name: "verify-login", challengeId: result.challengeId, email: result.email });
              }
            }}
            onSwitchToSignup={() => setStep({ name: "signup" })}
          />
        )}

        {step.name === "signup" && (
          <SignUpForm
            error={error}
            onSubmit={async (stationName, adminName, email, password) => {
              const result = await signUp(stationName, adminName, email, password);
              setStep({ name: "verify-signup", challengeId: result.challengeId, email: result.email });
            }}
            onSwitchToSignin={() => setStep({ name: "signin" })}
          />
        )}

        {step.name === "verify-login" && (
          <VerifyForm
            email={step.email}
            challengeId={step.challengeId}
            purpose="login"
            onBack={() => setStep({ name: "signin" })}
          />
        )}

        {step.name === "verify-signup" && (
          <VerifyForm
            email={step.email}
            challengeId={step.challengeId}
            purpose="signup"
            onBack={() => setStep({ name: "signup" })}
          />
        )}
      </div>
    </div>
  );
}

function SignInForm({
  error,
  onSubmit,
  onSwitchToSignup,
}: {
  error: string | null;
  onSubmit: (email: string, password: string) => Promise<void>;
  onSwitchToSignup: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(email, password);
    } catch {
      /* error surfaced via auth context */
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 sm:p-6 space-y-4">
      <div>
        <h1 className="text-[17px] font-semibold mb-1">Sign in</h1>
        <p className="text-[12.5px] text-text-faint">Enter your credentials to access the dashboard.</p>
      </div>

      <ErrorBanner message={error} />

      <div>
        <label className={labelClass}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          autoComplete="email"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 rounded-lg bg-accent text-bg font-semibold text-[13px] flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {submitting && <Loader2 size={15} className="animate-spin" />}
        {submitting ? "Signing in\u2026" : "Sign In"}
      </button>

      <p className="text-[12px] text-text-dim text-center pt-1">
        Don&apos;t have an account?{" "}
        <button type="button" onClick={onSwitchToSignup} className="text-accent hover:underline font-medium">
          Create one
        </button>
      </p>
    </form>
  );
}

function SignUpForm({
  error,
  onSubmit,
  onSwitchToSignin,
}: {
  error: string | null;
  onSubmit: (stationName: string, adminName: string, email: string, password: string) => Promise<void>;
  onSwitchToSignin: () => void;
}) {
  const [stationName, setStationName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (password !== confirmPassword) {
      setLocalError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(stationName, adminName, email, password);
    } catch {
      /* error surfaced via auth context */
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 sm:p-6 space-y-3.5">
      <div>
        <h1 className="text-[17px] font-semibold mb-1">Create your account</h1>
        <p className="text-[12.5px] text-text-faint">Sets up your station and its first administrator.</p>
      </div>

      <ErrorBanner message={localError ?? error} />

      <div>
        <label className={labelClass}>Station Name</label>
        <input
          value={stationName}
          onChange={(e) => setStationName(e.target.value)}
          required
          autoFocus
          placeholder="e.g. Westlands Service Station"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Your Full Name</label>
        <input value={adminName} onChange={(e) => setAdminName(e.target.value)} required className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className={labelClass}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 rounded-lg bg-accent text-bg font-semibold text-[13px] flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {submitting && <Loader2 size={15} className="animate-spin" />}
        {submitting ? "Creating account\u2026" : "Create Account"}
      </button>

      <p className="text-[12px] text-text-dim text-center pt-1">
        Already have an account?{" "}
        <button type="button" onClick={onSwitchToSignin} className="text-accent hover:underline font-medium">
          Sign in
        </button>
      </p>
    </form>
  );
}

function VerifyForm({
  email,
  challengeId,
  purpose,
  onBack,
}: {
  email: string;
  challengeId: string;
  purpose: "login" | "signup";
  onBack: () => void;
}) {
  const { verifyTwoFactor, resendTwoFactor, verifySignup, resendSignup, error } = useAuth();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sent" | "cooldown">("idle");
  const [cooldown, setCooldown] = useState(0);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) inputsRef.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    setCode(pasted.padEnd(6, "").split("").slice(0, 6));
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fullCode = code.join("");
    if (fullCode.length !== 6) return;
    setSubmitting(true);
    try {
      if (purpose === "login") await verifyTwoFactor(challengeId, fullCode);
      else await verifySignup(challengeId, fullCode);
    } catch {
      /* error surfaced via auth context */
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResendState("cooldown");
    setCooldown(30);
    try {
      if (purpose === "login") await resendTwoFactor(challengeId);
      else await resendSignup(challengeId);
      setResendState("sent");
    } catch {
      setResendState("idle");
      setCooldown(0);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 sm:p-6 space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-[12px] text-text-faint hover:text-text-dim -mb-1"
      >
        <ArrowLeft size={13} /> Back
      </button>

      <div className="text-center">
        <div className="w-11 h-11 rounded-full bg-accent-soft text-accent grid place-items-center mx-auto mb-3">
          <ShieldCheck size={20} />
        </div>
        <h1 className="text-[16px] font-semibold mb-1">Verify it&apos;s you</h1>
        <p className="text-[12.5px] text-text-faint flex items-center justify-center gap-1.5 flex-wrap">
          <MailCheck size={13} className="shrink-0" /> Code sent to <span className="font-medium text-text-dim">{email}</span>
        </p>
      </div>

      <ErrorBanner message={error} />

      <div className="flex items-center justify-center gap-2" onPaste={handlePaste}>
        {code.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            value={digit}
            onChange={(e) => handleDigitChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            inputMode="numeric"
            maxLength={1}
            className="w-10 h-12 sm:w-11 sm:h-13 text-center text-[18px] font-semibold font-mono-num bg-white/3 border border-border rounded-lg focus:outline-none focus:border-accent"
          />
        ))}
      </div>

      <button
        type="submit"
        disabled={submitting || code.join("").length !== 6}
        className="w-full py-2.5 rounded-lg bg-accent text-bg font-semibold text-[13px] flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {submitting && <Loader2 size={15} className="animate-spin" />}
        {submitting ? "Verifying\u2026" : "Verify"}
      </button>

      <p className="text-[12px] text-text-dim text-center">
        {resendState === "cooldown" ? (
          <span className="text-text-faint">Resend available in {cooldown}s</span>
        ) : (
          <button type="button" onClick={handleResend} className="text-accent hover:underline font-medium">
            {resendState === "sent" ? "Code resent \u2014 send again" : "Didn't get a code? Resend"}
          </button>
        )}
      </p>
    </form>
  );
}