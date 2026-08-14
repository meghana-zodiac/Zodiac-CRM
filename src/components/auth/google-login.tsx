import { useState } from "react";
import { Chrome, LoaderCircle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function GoogleLogin() {
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const signIn = async () => {
    setError(null);
    setIsSigningIn(true);

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setIsSigningIn(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-8">
      <section className="w-full max-w-md rounded-xl border border-border bg-surface p-7 shadow-raised sm:p-9">
        <div className="grid size-11 place-items-center rounded-xl bg-brand-gradient text-primary-foreground shadow-panel">
          <ShieldCheck className="size-5" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">Sign in to Zodiac CRM</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Use your approved organization Google account to access the CRM.
        </p>
        <Button className="mt-7 w-full gap-2" size="lg" onClick={signIn} disabled={isSigningIn}>
          {isSigningIn ? <LoaderCircle className="size-4 animate-spin" /> : <Chrome className="size-4" />}
          Continue with Google
        </Button>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </section>
    </main>
  );
}
