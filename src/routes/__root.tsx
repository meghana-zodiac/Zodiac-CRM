import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CrmShell } from "@/components/crm/crm-shell";
import { Toaster } from "@/components/ui/sonner";
import { GoogleLogin } from "@/components/auth/google-login";
import { supabase } from "@/integrations/supabase/client";
import { ORGANIZATION_EMAIL_DOMAIN, isOrganizationGoogleUser } from "@/lib/organization-auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Zodiac CRM" },
      {
        name: "description",
        content:
          "A modern Sales CRM application for managing leads, contacts, accounts, deals, and activities.",
      },
      { property: "og:title", content: "Zodiac CRM" },
      {
        property: "og:description",
        content:
          "A modern Sales CRM application for managing leads, contacts, accounts, deals, and activities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Zodiac CRM" },
      {
        name: "twitter:description",
        content:
          "A modern Sales CRM application for managing leads, contacts, accounts, deals, and activities.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5daff42464c13ac8e53cd00cdc9a5997/id-preview-aaf5b953--c26f2ca1-1043-4d47-ae1b-94a200d2b67d.lovable.app-1786434475090.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5daff42464c13ac8e53cd00cdc9a5997/id-preview-aaf5b953--c26f2ca1-1043-4d47-ae1b-94a200d2b67d.lovable.app-1786434475090.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap",
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [isLoading, setIsLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const applyUser = (user: Parameters<typeof isOrganizationGoogleUser>[0]) => {
      if (!mounted) return;

      const isAllowed = isOrganizationGoogleUser(user);
      setIsSignedIn(isAllowed);
      setAccessError(
        user && !isAllowed
          ? `Access is limited to Google Workspace accounts ending in @${ORGANIZATION_EMAIL_DOMAIN}.`
          : null,
      );
      setIsLoading(false);

      if (user && !isAllowed) {
        void supabase.auth.signOut();
      }
    };

    // Wait for Supabase to process OAuth tokens from the callback URL before
    // deciding whether to show the CRM or the login screen.
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        if (mounted) {
          setAccessError(error.message);
          setIsLoading(false);
        }
        return;
      }

      applyUser(data.session?.user ?? null);
    });

    // Calling another async auth method inside this callback can deadlock on
    // Supabase's internal auth lock. The event already contains the session.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {isLoading ? (
        <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
          Checking your session…
        </main>
      ) : isSignedIn ? (
        <CrmShell>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </CrmShell>
      ) : (
        <GoogleLogin accessError={accessError} />
      )}
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
