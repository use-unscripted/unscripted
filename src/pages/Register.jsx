import React, { useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { redirectAfterAuth } from "@/lib/post-auth-redirect";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";
import PasswordField from "@/components/PasswordField";
import PasswordChecklist from "@/components/PasswordChecklist";
import { validatePassword, isPasswordValid } from "@/lib/password-validation";
import { trackFunnel } from "@/lib/funnel";

/* This screen is reached from more than one place, and it used to introduce
   itself as a path test no matter which. Someone who clicked "See a full
   mission guide" on the landing page got a password form headed "Save Your
   Path Test" for something they never started, with no way back. The heading
   has to name the thing that was clicked. */
const INTENTS = {
  "mission-guide": {
    title: "See a full Mission Guide",
    // Guides are per-experiment and generated on request. Only the setup flow
    // generates one for you; an experiment created anywhere else starts with no
    // guide at all. Promise the route to a guide, not its automatic arrival.
    subtitle:
      "Mission Guides are written for the experiment you choose, so they live inside your account. Create one, pick an experiment, and generate its guide.",
    backTo: "/",
    backLabel: "Back to Unscripted",
  },
};

const DEFAULT_INTENT = {
  title: "Save Your Path Test",
  subtitle:
    "Create an account to generate your tailored paths, save your progress, and return anytime.",
  backTo: "/",
  backLabel: "Back to Unscripted",
};

export default function Register() {
  const [searchParams] = useSearchParams();
  // Own-property lookup only: ?intent=toString (or constructor, __proto__, ...)
  // otherwise resolves up the prototype chain to something truthy, which slips
  // past the ?? fallback and renders the screen with no heading and no way back.
  const intentKey = searchParams.get("intent");
  const intent = Object.hasOwn(INTENTS, intentKey ?? "") ? INTENTS[intentKey] : DEFAULT_INTENT;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const submittingRef = useRef(false);

  const passwordValid = isPasswordValid(password, email);
  const passwordsMatch = password === confirmPassword;
  const showConfirmMismatch = confirmPassword.length > 0 && !passwordsMatch;
  const canSubmit = email.length > 0 && passwordValid && passwordsMatch && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return; // prevent double-submit
    setError("");

    // Re-validate immediately before submission
    if (!isPasswordValid(password, email)) {
      setError("Please satisfy all password requirements before continuing.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      // Email/password accepted and a code is on its way. No address is ever
      // sent with the event — only the fact that a visitor got this far.
      trackFunnel('register_code_sent', { method: 'password' });
      setShowOtp(true);
      // Clear password from state after successful registration step
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      // Never expose raw internal errors or tokens
      const msg = err.message || "";
      if (msg.toLowerCase().includes("already")) {
        setError("An account with this email already exists. Try logging in.");
      } else {
        setError("Registration failed. Please check your details and try again.");
      }
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      trackFunnel('account_created', { method: 'password' });
      await redirectAfterAuth();
    } catch (err) {
      setError(err.message || "Invalid verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({ title: "Code sent", description: "Check your email for the new code." });
    } catch (err) {
      setError(err.message || "Failed to resend code.");
    }
  };

  const handleGoogle = () => {
    // Fired before the redirect leaves the page. Whether the account was
    // actually created shows up as account_created on the way back.
    trackFunnel('register_provider_started', { method: 'google' });
    base44.auth.loginWithProvider("google", "/post-auth");
  };

  if (showOtp) {
    return (
      <AuthLayout icon={Mail} title="Verify your email" subtitle={`We sent a code to ${email}`}>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">
            {error}
          </div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          className="w-full h-12 font-semibold text-white border-none"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : "Verify"}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn't receive the code?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">Resend</button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title={intent.title}
      subtitle={intent.subtitle}
      backTo={intent.backTo}
      backLabel={intent.backLabel}
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link>
        </>
      }
    >
      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordChecklist
            password={password}
            email={email}
            confirmPassword={confirmPassword}
            showConfirmError={showConfirmMismatch}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <PasswordField
            id="confirm"
            label="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <Button
          type="submit"
          className="w-full h-12 font-semibold text-white border-none"
          style={{ background: canSubmit ? 'var(--brand-navy-900)' : undefined, boxShadow: canSubmit ? '0 8px 24px rgba(31,58,95,0.25)' : undefined }}
          disabled={!canSubmit}
        >
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</> : "Create account"}
        </Button>

        {/* Consent notice — covers the Google button above as well as this one.
            Must stay visible on both paths into an account. */}
        <p className="pt-1 text-center text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          By creating an account you agree to our{" "}
          <Link to="/terms" className="font-semibold underline underline-offset-2">Terms</Link>{" "}
          and{" "}
          <Link to="/privacy" className="font-semibold underline underline-offset-2">Privacy Policy</Link>.
          You must be at least 13, and if you are under 18 you need a parent or guardian&rsquo;s permission.
        </p>
      </form>
    </AuthLayout>
  );
}