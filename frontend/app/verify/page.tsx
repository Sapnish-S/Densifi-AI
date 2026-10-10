"use client";

import { getPublicApiUrl } from "@/lib/api-url"
import { useState, useEffect, useRef, KeyboardEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(urlEmail);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const getApiUrl = () => {
    const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const url = getPublicApiUrl();
    return url.replace(/\/+$/, "");
  };

  useEffect(() => {
    // Wake up Render backend in background when verify page mounts
    fetch(`${getApiUrl()}/health`).catch(() => {});
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input if value is entered
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please provide your email address.");
      return;
    }
    const otpValue = otp.join("");
    if (otpValue.length < 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }
    
    setIsLoading(true);
    setError("");
    
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(apiUrl + "/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpValue }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || "Verification failed");
      }
      
      setSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError("Please provide your email address to resend the code.");
      return;
    }
    setIsLoading(true);
    setError("");
    setResendMessage("");
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || "Failed to resend code");
      }
      
      setResendMessage("A new 6-digit code has been sent to your email.");
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
          <h1 className="text-3xl font-light tracking-tight mb-2">Verify Account</h1>
          <p className="text-sm text-zinc-400">
            Enter the 6-digit clinical security code sent to
            {urlEmail ? <span className="text-zinc-200 font-medium ml-1 block mt-1">{urlEmail}</span> : " your email."}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-900 rounded-xl text-red-200 text-sm text-center">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-emerald-950/50 border border-emerald-900 rounded-xl text-emerald-200 text-sm text-center">
            Verification successful. Redirecting to dashboard...
          </div>
        )}

        {resendMessage && (
          <div className="mb-6 p-4 bg-emerald-950/50 border border-emerald-900 rounded-xl text-emerald-200 text-sm text-center">
            {resendMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {!urlEmail && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="patient@example.com"
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all placeholder:text-zinc-600 text-zinc-100"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Security Code
            </label>
            <div className="flex gap-2 sm:gap-3 justify-between">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-light bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all text-zinc-100"
                  required
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || success}
            className="w-full py-3.5 bg-zinc-100 text-zinc-900 font-medium rounded-xl hover:bg-white active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Account"}
          </button>

          <div className="text-center pt-4">
            <button
              type="button"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              onClick={handleResend}
              disabled={isLoading || success}
            >
              Didn't receive a code? <span className="underline underline-offset-4">Resend Code</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}
