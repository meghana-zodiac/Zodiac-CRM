import { useState } from "react";
import {
  BarChart3,
  Chrome,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ORGANIZATION_EMAIL_DOMAIN } from "@/lib/organization-auth";

export function GoogleLogin({ accessError }: { accessError?: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const signIn = async () => {
    setError(null);
    setIsSigningIn(true);

    const { data, error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        skipBrowserRedirect: true,
        queryParams: {
          hd: ORGANIZATION_EMAIL_DOMAIN,
          prompt: "select_account",
        },
      },
    });

    if (signInError) {
      setError(signInError.message);
      setIsSigningIn(false);
      return;
    }

    if (!data.url) {
      setError("Google sign-in could not be started. Please try again.");
      setIsSigningIn(false);
      return;
    }

    // Google refuses to render inside Lovable's preview frame. Navigate the
    // top-level browsing context instead; this also avoids Safari's COOP block
    // on cross-origin popup handoffs.
    try {
      window.top?.location.assign(data.url);
    } catch {
      window.location.assign(data.url);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7faff] text-slate-950">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(20,72,155,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(20,72,155,0.045)_1px,transparent_1px)] [background-size:44px_44px]"
      />
      <div
        aria-hidden="true"
        className="absolute -left-40 -top-48 size-[34rem] rounded-full bg-blue-200/50 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-56 -right-40 size-[38rem] rounded-full bg-cyan-200/40 blur-3xl"
      />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-14 px-5 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 xl:gap-24">
        <section className="mx-auto hidden max-w-2xl lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/75 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm backdrop-blur">
            <Sparkles className="size-4" />
            One connected workspace
          </div>
          <h1 className="mt-7 max-w-xl text-5xl font-semibold leading-[1.06] tracking-[-0.04em] xl:text-6xl">
            Every relationship. <span className="bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-500 bg-clip-text text-transparent">Clearly managed.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Bring your leads, clients, conversations, deals, and team activity together in one focused CRM built for Zodiac HR.
          </p>

          <div className="mt-10 grid max-w-xl grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/80 bg-white/70 p-5 shadow-[0_18px_60px_-32px_rgba(24,75,150,0.45)] backdrop-blur-md">
              <div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <UsersRound className="size-5" />
              </div>
              <p className="mt-4 font-semibold">Connected records</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">Keep leads, contacts, and clients easy to find.</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/70 p-5 shadow-[0_18px_60px_-32px_rgba(24,75,150,0.45)] backdrop-blur-md">
              <div className="grid size-10 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
                <BarChart3 className="size-5" />
              </div>
              <p className="mt-4 font-semibold">Clear visibility</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">Follow activity and opportunities from one place.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-blue-800 via-blue-600 to-cyan-500 text-lg font-bold text-white shadow-lg shadow-blue-500/20">
              Z
            </div>
            <div>
              <p className="font-semibold tracking-tight">Zodiac CRM</p>
              <p className="text-xs text-slate-500">One connected workspace</p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-white/90 bg-white/85 p-7 shadow-[0_28px_90px_-38px_rgba(20,69,140,0.5)] backdrop-blur-xl sm:p-10">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-800 via-blue-500 to-cyan-400" />
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-800 via-blue-600 to-cyan-500 text-xl font-bold text-white shadow-lg shadow-blue-500/25">
                Z
              </div>
              <div>
                <p className="font-semibold tracking-tight text-slate-900">Zodiac CRM</p>
                <p className="text-xs text-slate-500">Secure team workspace</p>
              </div>
            </div>

            <div className="mt-9">
              <div className="mb-4 grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <ShieldCheck className="size-5" />
              </div>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                Welcome back
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Sign in with your <strong className="font-semibold text-slate-800">@{ORGANIZATION_EMAIL_DOMAIN}</strong> Google Workspace account to continue.
              </p>
            </div>

            <Button
              className="mt-8 h-12 w-full gap-2 rounded-xl border-0 bg-gradient-to-r from-blue-800 via-blue-600 to-cyan-500 text-base font-medium text-white shadow-lg shadow-blue-700/20 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-xl hover:shadow-blue-700/25"
              size="lg"
              onClick={signIn}
              disabled={isSigningIn}
            >
              {isSigningIn ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Chrome className="size-4" />
              )}
              Continue with Google
            </Button>

            {(error || accessError) && (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error || accessError}
              </p>
            )}

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="size-3.5" />
              Restricted to authorised Zodiac HR accounts
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">Zodiac HR Consultants · Internal CRM</p>
        </section>
      </div>
    </main>
  );
}
