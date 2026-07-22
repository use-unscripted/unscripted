import React, { useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import PasswordField from "@/components/PasswordField";
import PasswordChecklist from "@/components/PasswordChecklist";
import { isPasswordValid } from "@/lib/password-validation";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const submittingRef = useRef(false);

  const passwordValid = isPasswordValid(newPassword);
  const passwordsMatch = newPassword === confirmPassword;
  const showConfirmMismatch = confirmPassword.length > 0 && !passwordsMatch;
  const canSubmit = passwordValid && passwordsMatch && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setError("");

    if (!isPasswordValid(newPassword)) {
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
      await base44.auth.resetPassword({ resetToken, newPassword });
      // Clear passwords from state on success
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (err) {
      // Never expose tokens or internal details
      setError("Password reset failed. Your link may have expired — please request a new one.");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  if (!resetToken) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Invalid reset link"
        subtitle="This password reset link is missing or invalid"
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            Request a new link
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          The link you used appears to be incomplete. Please request a new password reset email.
        </p>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout
        icon={CheckCircle2}
        title="Password updated"
        subtitle="Your new password has been set successfully."
      >
        <p className="text-sm text-center text-muted-foreground mb-6">
          You can now log in with your new password.
        </p>
        <Button
          className="w-full h-12 font-semibold text-white border-none"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}
          onClick={() => { window.location.href = "/login"; }}
        >
          Go to Login
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={Lock} title="New password" subtitle="Enter your new password below">
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <PasswordField
            id="password"
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoFocus
          />
          <PasswordChecklist
            password={newPassword}
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
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Resetting...</> : "Reset password"}
        </Button>
      </form>
    </AuthLayout>
  );
}