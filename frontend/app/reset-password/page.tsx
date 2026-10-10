"use client";

import { getPublicApiUrl } from "@/lib/api-url"
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [otpCode, setOtpCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  const getApiUrl = () => {
    const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const url = getPublicApiUrl();
    return url.replace(/\/+$/, "");
  };

  useEffect(() => {
    // Wake up Render backend in background when reset page mounts
    fetch(`${getApiUrl()}/health`).catch(() => {});
  }, []);

  useEffect(() => {
    // Client-side validation
    const errors = [];
    if (password.length > 0 && password.length < 8) {
      errors.push("Password must be at least 8 characters long.");
    }
    if (confirmPassword.length > 0 && password !== confirmPassword) {
      errors.push("Passwords do not match.");
    }
    setValidationErrors(errors);
  }, [password, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationErrors.length > 0) {
      setError("Please fix the validation errors before submitting.");
      return;
    }
    if (!email) {
      setError("Missing email address. Please start the password reset process again.");
      return;
    }
    if (!otpCode || !password || !confirmPassword) {
      setError("Please fill out all fields.");
      return;
    }
    
    setIsLoading(true);
    setError("");
    
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(apiUrl + "/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp_code: otpCode, new_password: password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        const errorMsg = typeof data.detail === 'string' ? data.detail : (data.detail?.message || "Failed to reset password");
        throw new Error(errorMsg);
      }
      
      setSuccess(true);
      setTimeout(() => {
        router.push("/sign-in");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-4">
      <div className="w-full max-w-md p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light tracking-tight mb-2">Create New Password</h1>
          <p className="text-sm text-zinc-400">
            Enter the 6-digit code sent to your email and your new password.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 flex gap-3 items-start bg-red-950/50 border border-red-900 rounded-xl text-red-200 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-emerald-950/50 border border-emerald-900 rounded-xl text-emerald-200 text-sm text-center">
            Password reset successful. Redirecting to sign in...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Verification Code
            </label>
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all placeholder:text-zinc-600 text-zinc-100 tracking-widest font-mono"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all placeholder:text-zinc-600 text-zinc-100 pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all placeholder:text-zinc-600 text-zinc-100 pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {validationErrors.length > 0 && (
            <ul className="text-xs text-red-400 space-y-1 list-disc pl-4">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}

          <button
            type="submit"
            disabled={isLoading || success || validationErrors.length > 0}
            className="w-full py-3.5 bg-zinc-100 text-zinc-900 font-medium rounded-xl hover:bg-white active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none mt-4"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
