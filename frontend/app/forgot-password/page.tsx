"use client";

import { getPublicApiUrl } from "@/lib/api-url"
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const getApiUrl = () => {
    const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const url = getPublicApiUrl();
    return url.replace(/\/+$/, "");
  };

  useEffect(() => {
    // Wake up Render backend in background when forgot password page mounts
    fetch(`${getApiUrl()}/health`).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please provide your email address.");
      return;
    }
    
    setIsLoading(true);
    setError("");
    setSuccess(false);
    
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(apiUrl + "/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || "Request failed");
      }
      
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-4">
      <div className="w-full max-w-md p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl relative">
        
        <Link href="/sign-in" className="absolute top-8 left-8 text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="text-center mb-8 mt-6">
          <h1 className="text-3xl font-light tracking-tight mb-2">Reset Password</h1>
          <p className="text-sm text-zinc-400">
            Enter your email address to receive a secure 6-digit verification code.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-900 rounded-xl text-red-200 text-sm text-center">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-emerald-950/50 border border-emerald-900 rounded-xl text-emerald-200 text-sm text-center">
            If an account exists, a recovery link has been sent. Please check your inbox.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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

          <button
            type="submit"
            disabled={isLoading || success}
            className="w-full py-3.5 bg-zinc-100 text-zinc-900 font-medium rounded-xl hover:bg-white active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Verification Code"}
          </button>
        </form>
      </div>
    </div>
  );
}
