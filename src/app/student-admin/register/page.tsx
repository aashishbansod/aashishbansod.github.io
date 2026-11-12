"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type RegistrationStep = "register" | "verify" | "success";
type InvitationStatus = "checking" | "ready" | "required" | "error";

type ApiResponse<T> = {
  success?: boolean;
  code?: string;
  message?: string;
  data?: T;
};

type RegistrationData = {
  adminId: string;
  email: string;
  username: string;
  expiresInMinutes: number;
  emailSent: boolean;
  verificationRequired: boolean;
};

type VerificationData = {
  adminId: string;
  username: string;
  email: string;
  active: boolean;
  confirmationEmailSent: boolean;
  loginUrl: string;
};

type ResendData = {
  email: string;
  expiresInMinutes: number;
  emailSent: boolean;
  retryAfterSeconds: number | null;
};

const initialForm = {
  fullName: "",
  email: "",
  phone: "+91",
  username: "",
  password: "",
  confirmPassword: "",
};

function getErrorMessage(payload: ApiResponse<unknown>, fallback: string): string {
  return typeof payload.message === "string" && payload.message.trim()
    ? payload.message
    : fallback;
}

async function readJson<T>(response: Response): Promise<ApiResponse<T>> {
  try {
    return (await response.json()) as ApiResponse<T>;
  } catch {
    return {
      success: false,
      message: "The server returned an invalid response. Please try again.",
    };
  }
}

export default function StudentAdminRegisterPage() {
  const [step, setStep] = useState<RegistrationStep>("register");
  const [invitationStatus, setInvitationStatus] = useState<InvitationStatus>("checking");
  const [form, setForm] = useState(initialForm);
  const [otp, setOtp] = useState("");
  const [adminData, setAdminData] = useState<RegistrationData | null>(null);
  const [verifiedData, setVerifiedData] = useState<VerificationData | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [otpExpiresIn, setOtpExpiresIn] = useState(10 * 60);

  useEffect(() => {
    let active = true;
    const currentUrl = new URL(window.location.href);
    const invitation = currentUrl.searchParams.get("invite");

    if (!invitation) {
      setInvitationStatus("required");
      return () => {
        active = false;
      };
    }

    currentUrl.searchParams.delete("invite");
    window.history.replaceState(
      window.history.state,
      "",
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
    );

    const controller = new AbortController();

    async function validateInvitation() {
      try {
        const response = await fetch(
          `/api/student-admin/register?invite=${encodeURIComponent(invitation!)}`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
            headers: { Accept: "application/json" },
          },
        );

        const payload = await readJson<unknown>(response);

        if (!response.ok || payload.success !== true) {
          throw new Error(getErrorMessage(payload, "This private invitation link is invalid or expired."));
        }

        if (active) {
          setInvitationStatus("ready");
          setNotice("Private invitation verified. You can now create your account.");
        }
      } catch (invitationError) {
        if (!active || controller.signal.aborted) return;
        setInvitationStatus("error");
        setError(
          invitationError instanceof Error
            ? invitationError.message
            : "Unable to verify the private invitation.",
        );
      }
    }

    void validateInvitation();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  useEffect(() => {
    if (step !== "verify" || otpExpiresIn <= 0) return;
    const timer = window.setTimeout(() => {
      setOtpExpiresIn((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [step, otpExpiresIn]);

  const passwordChecks = useMemo(
    () => ({
      length: form.password.length >= 10 && form.password.length <= 128,
      upper: /[A-Z]/.test(form.password),
      lower: /[a-z]/.test(form.password),
      number: /\d/.test(form.password),
    }),
    [form.password],
  );

  const passwordValid = Object.values(passwordChecks).every(Boolean);
  const passwordsMatch = form.password === form.confirmPassword;
  const canSubmit =
    !loading &&
    invitationStatus === "ready" &&
    form.fullName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) &&
    /^\+?[1-9]\d{6,14}$/.test(form.phone.replace(/[\s()-]/g, "")) &&
    /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])$/.test(form.username.trim()) &&
    form.username.trim().length >= 3 &&
    form.username.trim().length <= 30 &&
    passwordValid &&
    passwordsMatch;

  function updateField(field: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (invitationStatus !== "ready") {
      setError("Open a valid private invitation link before registering.");
      return;
    }

    if (!canSubmit) {
      setError("Please check all fields and make sure your password meets the requirements.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/student-admin/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          username: form.username.trim().toLowerCase(),
          password: form.password,
        }),
      });

      const payload = await readJson<RegistrationData>(response);
      const data = payload.data;

      if (!data?.email || !data.adminId || !data.username) {
        throw new Error(getErrorMessage(payload, "Registration could not be completed."));
      }

      setAdminData(data);
      setOtpExpiresIn((data.expiresInMinutes || 10) * 60);
      setResendSeconds(60);
      setStep("verify");

      if (data.emailSent) {
        setNotice("Registration saved. We sent a six-digit verification code to your email.");
      } else {
        setNotice("Your registration is saved, but the email could not be delivered. Use Resend code when the timer finishes.");
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to register right now. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

    async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!adminData?.email || !/^\d{6}$/.test(otp)) {
      setError("Enter the six-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/student-admin/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          email: adminData.email,
          otp,
        }),
      });

      const payload = await readJson<VerificationData>(response);

      if (!response.ok || !payload.data?.active || !payload.data.adminId) {
        throw new Error(getErrorMessage(payload, "Verification failed. Check the code and try again."));
      }

      setVerifiedData(payload.data);
      setStep("success");
      setNotice("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to verify the code. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!adminData?.email || resendSeconds > 0 || resending) return;

    setError("");
    setNotice("");
    setResending(true);

    try {
      const response = await fetch("/api/student-admin/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ email: adminData.email }),
      });

      const payload = await readJson<ResendData>(response);
      const data = payload.data;

      if (!data) {
        throw new Error(getErrorMessage(payload, "Unable to resend the verification code."));
      }

      if (data.emailSent) {
        setOtp("");
        setOtpExpiresIn((data.expiresInMinutes || 10) * 60);
        setResendSeconds(data.retryAfterSeconds ?? 60);
        setNotice("A new verification code has been sent to your email.");
      } else {
        setResendSeconds(data.retryAfterSeconds ?? 60);
        setError(getErrorMessage(payload, "Email delivery failed. Please try again after the cooldown."));
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to resend the verification code.",
      );
    } finally {
      setResending(false);
    }
  }

  function returnToRegistration() {
    setStep("register");
    setOtp("");
    setAdminData(null);
    setError("");
    setNotice("");
    setResendSeconds(0);
    setOtpExpiresIn(10 * 60);
  }

  return (
    <main className="cn-register-page">
      <div className="cn-background-grid" />
      <div className="cn-orb cn-orb-one" />
      <div className="cn-orb cn-orb-two" />

      <header className="cn-topbar">
        <a className="cn-brand" href="/" aria-label="CyberNet Careers home">
          <span className="cn-brand-mark">CN</span>
          <span>
            <strong>CyberNet</strong>
            <small>CAREERS</small>
          </span>
        </a>
        <a className="cn-top-link" href="/login?mode=student-admin">
          Already registered? <strong>Sign in</strong>
        </a>
      </header>

      <section className="cn-register-shell">
        <div className="cn-card">
          <div className="cn-card-head">
            <div>
              <span className="cn-step-label">
                {step === "register" ? "STEP 01 / 02" : step === "verify" ? "STEP 02 / 02" : "REGISTRATION COMPLETE"}
              </span>
              <h2>
                {step === "register" && "Create your account"}
                {step === "verify" && "Verify your email"}
                {step === "success" && "Account activated"}
              </h2>
              <p>
                {step === "register" && "Enter your details to request private access."}
                {step === "verify" && "Enter the code sent to your registered email."}
                {step === "success" && "Your Student Operations Admin account is ready."}
              </p>
            </div>
            <div className="cn-card-icon">
              {step === "success" ? "✓" : step === "verify" ? "✉" : "＋"}
            </div>
          </div>

          <div className="cn-progress" aria-label={`Registration ${step} progress`}>
            <span className={step === "register" ? "active" : "complete"} />
            <span className={step === "register" ? "" : "active"} />
          </div>

          {error && <div className="cn-alert cn-alert-error" role="alert">{error}</div>}
          {notice && <div className="cn-alert cn-alert-info" role="status">{notice}</div>}

          {step === "register" && invitationStatus !== "ready" && (
            <div className="cn-invitation-state" role="status" aria-live="polite">
              <div className={`cn-invitation-icon ${invitationStatus === "error" ? "error" : ""}`}>
                {invitationStatus === "checking" ? <span className="cn-spinner cn-spinner-blue" /> : invitationStatus === "error" ? "!" : "⌑"}
              </div>
              <h3>
                {invitationStatus === "checking" && "Verifying private access"}
                {invitationStatus === "required" && "Private invitation required"}
                {invitationStatus === "error" && "Invitation could not be verified"}
              </h3>
              <p>
                {invitationStatus === "checking" && "Please wait while we securely validate your invitation."}
                {invitationStatus === "required" && "This registration portal is restricted. Open the private invitation link provided by your CyberNet administrator to continue."}
                {invitationStatus === "error" && "Your invitation link may be invalid or expired. Request a fresh private invitation from your CyberNet administrator."}
              </p>
              {invitationStatus === "error" && (
                <button type="button" className="cn-text-button" onClick={() => window.location.reload()}>
                  Try again
                </button>
              )}
            </div>
          )}

          {step === "register" && invitationStatus === "ready" && (
            <form className="cn-form" onSubmit={handleRegister}>
              <div className="cn-field">
                <label htmlFor="fullName">Full name</label>
                <input id="fullName" autoComplete="name" maxLength={120} placeholder="Enter your full name" value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} required />
              </div>

              <div className="cn-field">
                <label htmlFor="email">Work email address</label>
                <input id="email" type="email" autoComplete="email" maxLength={254} placeholder="name@company.com" value={form.email} onChange={(event) => updateField("email", event.target.value)} required />
              </div>

              <div className="cn-field">
                <label htmlFor="phone">Mobile number <span>Include country code</span></label>
                <input id="phone" type="tel" autoComplete="tel" maxLength={20} placeholder="+919876543210" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} required />
              </div>

              <div className="cn-field">
                <label htmlFor="username">Choose username</label>
                <input id="username" autoComplete="username" minLength={3} maxLength={30} placeholder="e.g. operations.admin" value={form.username} onChange={(event) => updateField("username", event.target.value)} required />
                <small className="cn-hint">3–30 characters · letters, numbers, dot, underscore or hyphen</small>
              </div>

              <div className="cn-field">
                <label htmlFor="password">Create password</label>
                <div className="cn-password-wrap">
                  <input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={10} maxLength={128} placeholder="Create a strong password" value={form.password} onChange={(event) => updateField("password", event.target.value)} required />
                  <button type="button" className="cn-show-password" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
                </div>
                <div className="cn-password-rules">
                  <span className={passwordChecks.length ? "valid" : ""}>10–128 characters</span>
                  <span className={passwordChecks.upper && passwordChecks.lower ? "valid" : ""}>Uppercase and lowercase</span>
                  <span className={passwordChecks.number ? "valid" : ""}>At least one number</span>
                </div>
              </div>

              <div className="cn-field">
                <label htmlFor="confirmPassword">Confirm password</label>
                <div className="cn-password-wrap">
                  <input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" maxLength={128} placeholder="Re-enter your password" value={form.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} required />
                  <button type="button" className="cn-show-password" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>{showConfirmPassword ? "Hide" : "Show"}</button>
                </div>
                {form.confirmPassword && !passwordsMatch && <small className="cn-inline-error">Passwords do not match.</small>}
              </div>

              <button className="cn-primary-button" type="submit" disabled={!canSubmit}>
                {loading ? <><span className="cn-spinner" /> Creating account...</> : <>Create account <span>→</span></>}
              </button>
              <p className="cn-legal">By continuing, you confirm that the information provided is accurate and that you are authorized to register for this private portal.</p>
            </form>
          )}

                    {step === "verify" && (
            <form className="cn-form cn-verify-form" onSubmit={handleVerify}>
              <div className="cn-email-summary">
                <span className="cn-email-icon">✉</span>
                <span><small>VERIFICATION EMAIL SENT TO</small><strong>{adminData?.email}</strong></span>
              </div>

              <div className="cn-field">
                <label htmlFor="otp">Six-digit verification code</label>
                <input
                  id="otp"
                  className="cn-otp-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                />
                <small className="cn-hint">Enter the latest code from your email. Do not share it with anyone.</small>
              </div>

              <div className="cn-otp-meta">
                <span>Code expires in <strong>{formatTime(otpExpiresIn)}</strong></span>
                <span>{otpExpiresIn === 0 ? "Code expired" : "10-minute validity"}</span>
              </div>

              <button className="cn-primary-button" type="submit" disabled={loading || otp.length !== 6}>
                {loading ? <><span className="cn-spinner" /> Verifying...</> : <>Verify and activate <span>→</span></>}
              </button>

              <div className="cn-resend-row">
                <span>Didn't receive the email?</span>
                <button type="button" onClick={handleResend} disabled={resending || resendSeconds > 0}>
                  {resending ? "Sending..." : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
                </button>
              </div>

              <button className="cn-text-button" type="button" onClick={returnToRegistration}>← Back to registration</button>
            </form>
          )}

          {step === "success" && verifiedData && (
            <div className="cn-success-panel">
              <div className="cn-success-mark">✓</div>
              <h3>Email verified successfully</h3>
              <p>Your Student Operations Admin account has been activated. You can now sign in.</p>

              <div className="cn-credential-card">
                <div><span>ADMIN ID</span><strong>{verifiedData.adminId}</strong></div>
                <div><span>USERNAME</span><strong>{verifiedData.username}</strong></div>
                <div><span>REGISTERED EMAIL</span><strong>{verifiedData.email}</strong></div>
                <button type="button" className="cn-copy-button" onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(verifiedData.adminId);
                    setNotice("Admin ID copied.");
                  } catch {
                    setNotice("Your Admin ID is shown above. Please copy it manually.");
                  }
                }}>Copy Admin ID</button>
              </div>

              <div className="cn-confirmation-note">
                {verifiedData.confirmationEmailSent
                  ? "Your account confirmation details have also been sent to your email."
                  : "Your account is active. The confirmation email could not be delivered, so keep your Admin ID safe."}
              </div>

              <a className="cn-primary-button cn-link-button" href={verifiedData.loginUrl || "/login?mode=student-admin"}>
                Continue to Student Admin login <span>→</span>
              </a>
            </div>
          )}
        </div>
      </section>

      <footer className="cn-footer">
        <span>© {new Date().getFullYear()} CyberNet Careers</span>
        <span>Private Student Operations Portal</span>
      </footer>

      <style jsx global>{`
        * { box-sizing: border-box; }
        .cn-register-page { min-height: 100vh; position: relative; overflow: hidden; padding: 0 5.5%; color: #17233d; background: #f5f8ff; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .cn-background-grid { position: absolute; inset: 0; pointer-events: none; opacity: .38; background-image: linear-gradient(rgba(45, 91, 170, .055) 1px, transparent 1px), linear-gradient(90deg, rgba(45, 91, 170, .055) 1px, transparent 1px); background-size: 42px 42px; mask-image: linear-gradient(to bottom, black, transparent 85%); }
        .cn-orb { position: absolute; border-radius: 50%; filter: blur(2px); pointer-events: none; }
        .cn-orb-one { width: 440px; height: 440px; top: 100px; left: -270px; background: radial-gradient(circle, rgba(60, 123, 255, .12), transparent 70%); }
        .cn-orb-two { width: 500px; height: 500px; right: -300px; bottom: -100px; background: radial-gradient(circle, rgba(28, 92, 210, .11), transparent 70%); }
        .cn-topbar { position: relative; z-index: 1; height: 88px; display: flex; align-items: center; justify-content: space-between; max-width: 1440px; margin: 0 auto; border-bottom: 1px solid rgba(31, 68, 130, .09); }
        .cn-brand { display: inline-flex; align-items: center; gap: 11px; color: #14264b; text-decoration: none; }
        .cn-brand-mark { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px; color: white; font-weight: 850; font-size: 14px; letter-spacing: -1px; background: linear-gradient(135deg, #1763df, #0b2c72); box-shadow: 0 7px 18px rgba(28, 87, 190, .24); }
        .cn-brand strong { display: block; font-size: 17px; letter-spacing: -.5px; line-height: 1.1; }
        .cn-brand small { display: block; margin-top: 4px; color: #6d7e9d; font-size: 9px; font-weight: 800; letter-spacing: 2.2px; }
        .cn-top-link { color: #75819a; font-size: 12px; text-decoration: none; }
        .cn-top-link strong { color: #1558c7; margin-left: 4px; }
        .cn-register-shell { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; width: 100%; min-height: calc(100vh - 150px); margin: 0 auto; padding: 48px 0 56px; }
        .cn-card { width: min(100%, 540px); margin: 0 auto; padding: 32px; border: 1px solid rgba(214, 226, 246, .9); border-radius: 20px; background: rgba(255,255,255,.96); box-shadow: 0 24px 70px rgba(37, 70, 125, .11), 0 3px 10px rgba(37,70,125,.035); }
        .cn-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 15px; }
        .cn-step-label { color: #3470cf; font-size: 9px; font-weight: 850; letter-spacing: 1.5px; }
        .cn-card-head h2 { margin: 10px 0 6px; color: #172744; font-size: 23px; letter-spacing: -.8px; font-weight: 800; }
        .cn-card-head p { margin: 0; color: #8490a5; font-size: 11px; line-height: 1.6; }
        .cn-card-icon { width: 42px; height: 42px; display: grid; place-items: center; flex: 0 0 42px; border-radius: 13px; color: #1b62d0; background: #edf4ff; font-size: 22px; font-weight: 600; }
        .cn-progress { display: flex; gap: 7px; margin: 23px 0 22px; }
        .cn-progress span { height: 4px; flex: 1; border-radius: 10px; background: #e8edf5; }
        .cn-progress span.active, .cn-progress span.complete { background: #2168d7; }
        .cn-form { display: grid; gap: 14px; }
        .cn-field { display: grid; gap: 7px; }
        .cn-field label { color: #3a4963; font-size: 10px; font-weight: 750; }
        .cn-field label span { margin-left: 5px; color: #97a2b4; font-size: 9px; font-weight: 500; }
        .cn-field input { width: 100%; height: 43px; padding: 0 13px; outline: none; border: 1px solid #e1e7f0; border-radius: 9px; color: #1d2b45; background: #fbfcfe; font: inherit; font-size: 11px; transition: border-color .18s, box-shadow .18s, background .18s; }
        .cn-field input::placeholder { color: #a8b1c0; }
        .cn-field input:focus { border-color: #6a9be9; background: #fff; box-shadow: 0 0 0 3px rgba(49, 111, 211, .1); }
        .cn-hint { color: #929daf; font-size: 9px; line-height: 1.5; }
        .cn-password-wrap { position: relative; }
        .cn-password-wrap input { padding-right: 58px; }
        .cn-show-password { position: absolute; top: 50%; right: 11px; transform: translateY(-50%); border: 0; color: #2864bd; background: transparent; font-size: 10px; font-weight: 750; cursor: pointer; }
        .cn-password-rules { display: flex; flex-wrap: wrap; gap: 6px 12px; }
        .cn-password-rules span { color: #a0aaba; font-size: 9px; }
        .cn-password-rules span::before { content: "○"; margin-right: 4px; }
        .cn-password-rules span.valid { color: #17845d; }
        .cn-password-rules span.valid::before { content: "✓"; }
        .cn-inline-error { color: #c24141; font-size: 10px; }
        .cn-primary-button { width: 100%; min-height: 46px; display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 5px; padding: 12px 16px; border: 0; border-radius: 9px; color: #fff; background: linear-gradient(105deg, #1765dd, #124cb0); box-shadow: 0 8px 18px rgba(26, 91, 193, .2); font: inherit; font-size: 11px; font-weight: 800; text-decoration: none; cursor: pointer; transition: transform .18s, box-shadow .18s, opacity .18s; }
        .cn-primary-button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 11px 23px rgba(26, 91, 193, .25); }
        .cn-primary-button:disabled { opacity: .48; cursor: not-allowed; box-shadow: none; }
        .cn-primary-button > span:last-child { font-size: 17px; line-height: 10px; }
        .cn-legal { margin: 0; color: #9aa4b4; font-size: 9px; line-height: 1.6; text-align: center; }
        .cn-alert { margin: 0 0 15px; padding: 11px 12px; border-radius: 9px; font-size: 10px; line-height: 1.6; }
        .cn-alert-error { border: 1px solid #f4d3d3; color: #a53232; background: #fff6f6; }
        .cn-alert-info { border: 1px solid #d8e7fc; color: #2458a3; background: #f3f8ff; }
        .cn-spinner { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: cn-spin .7s linear infinite; }
        @keyframes cn-spin { to { transform: rotate(360deg); } }
        .cn-verify-form { gap: 19px; }
        .cn-email-summary { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid #e2ebf9; border-radius: 11px; background: #f7faff; }
        .cn-email-icon { width: 35px; height: 35px; display: grid; place-items: center; border-radius: 10px; color: #2165ca; background: #e7f0ff; font-size: 17px; }
        .cn-email-summary small, .cn-email-summary strong { display: block; }
        .cn-email-summary small { color: #8794aa; font-size: 8px; font-weight: 800; letter-spacing: 1px; }
        .cn-email-summary strong { margin-top: 5px; color: #263b5c; font-size: 11px; overflow-wrap: anywhere; }
        .cn-otp-input { height: 58px !important; text-align: center; font-size: 23px !important; font-weight: 800 !important; letter-spacing: 13px; padding-left: 22px !important; }
        .cn-otp-meta { display: flex; justify-content: space-between; gap: 10px; color: #8491a7; font-size: 9px; }
        .cn-otp-meta strong { color: #245eb7; font-variant-numeric: tabular-nums; }
        .cn-resend-row { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 5px; color: #8995a8; font-size: 10px; }
        .cn-resend-row button, .cn-text-button { padding: 4px; border: 0; color: #1b5fc5; background: transparent; font: inherit; font-size: 10px; font-weight: 800; cursor: pointer; }
        .cn-resend-row button:disabled { color: #9aa6b8; cursor: not-allowed; }
        .cn-text-button { justify-self: center; color: #77859c; font-weight: 650; }
        .cn-invitation-state { display: grid; justify-items: center; padding: 28px 12px 18px; text-align: center; }
        .cn-invitation-icon { width: 54px; height: 54px; display: grid; place-items: center; margin-bottom: 15px; border: 1px solid #dce8fb; border-radius: 16px; color: #1d62c9; background: #edf4ff; font-size: 25px; font-weight: 800; }
        .cn-invitation-icon.error { border-color: #f1d5d5; color: #b43c3c; background: #fff4f4; }
        .cn-invitation-state h3 { margin: 0 0 8px; color: #1b2b47; font-size: 17px; letter-spacing: -.35px; }
        .cn-invitation-state p { max-width: 340px; margin: 0; color: #8290a7; font-size: 11px; line-height: 1.8; }
        .cn-spinner-blue { border-color: rgba(35, 101, 202, .2); border-top-color: #2168d7; }
        .cn-success-panel { display: grid; justify-items: center; text-align: center; }
        .cn-success-mark { width: 62px; height: 62px; display: grid; place-items: center; margin: 6px 0 13px; border-radius: 50%; color: #16845e; background: #e7f8f0; box-shadow: 0 0 0 8px #f3fbf7; font-size: 29px; font-weight: 700; }
        .cn-success-panel h3 { margin: 6px 0; color: #1b2b47; font-size: 19px; letter-spacing: -.5px; }
        .cn-success-panel > p { max-width: 330px; margin: 0; color: #8491a6; font-size: 10px; line-height: 1.7; }
        .cn-credential-card { width: 100%; display: grid; gap: 13px; margin: 22px 0 14px; padding: 17px; border: 1px solid #e0e9f7; border-radius: 12px; background: #f8faff; text-align: left; }
        .cn-credential-card div span, .cn-credential-card div strong { display: block; }
        .cn-credential-card div span { color: #8a97ab; font-size: 8px; font-weight: 800; letter-spacing: 1px; }
        .cn-credential-card div strong { margin-top: 5px; color: #21385e; font-size: 12px; overflow-wrap: anywhere; }
        .cn-copy-button { justify-self: start; padding: 7px 10px; border: 1px solid #d5e3f8; border-radius: 7px; color: #1d5dbb; background: #fff; font-size: 9px; font-weight: 800; cursor: pointer; }
        .cn-confirmation-note { margin-bottom: 14px; color: #7888a0; font-size: 9px; line-height: 1.6; }
        .cn-link-button { margin-top: 5px; }
        .cn-footer { position: relative; z-index: 1; display: flex; justify-content: space-between; gap: 12px; max-width: 1440px; margin: 0 auto; padding: 17px 0 22px; border-top: 1px solid rgba(31, 68, 130, .09); color: #9aa5b6; font-size: 9px; }
        @media (max-width: 900px) { .cn-card { padding: 26px; } }
        @media (max-width: 720px) { .cn-register-page { padding: 0 20px; } .cn-topbar { height: 72px; } .cn-register-shell { min-height: calc(100vh - 132px); padding: 30px 0 36px; } .cn-card { padding: 23px 19px; } .cn-footer { font-size: 8px; } }
        @media (max-width: 380px) { .cn-top-link { font-size: 10px; } .cn-brand strong { font-size: 15px; } .cn-card-head h2 { font-size: 20px; } .cn-otp-input { letter-spacing: 9px; } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }
      `}</style>
    </main>
  );
}