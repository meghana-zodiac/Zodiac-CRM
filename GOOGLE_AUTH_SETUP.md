# Google sign-in setup

This project uses **Lovable Cloud**. Enable Google authentication from the Lovable project rather than creating a separate Supabase account.

1. Open the project in Lovable.
2. Select **Cloud → Users → Auth → Google**.
3. Enable Google sign-in and select **Managed by Lovable** (recommended). Lovable manages the OAuth credentials and redirect setup.
4. Test the **Continue with Google** button in Preview, then publish the app.
5. Apply the Supabase migrations through the Lovable Cloud database migration workflow. The latest migration restricts CRM table access to authenticated Google users whose email address ends exactly in `@zodiachrc.com`.

The app passes Google's `hd=zodiachrc.com` parameter to make the correct Workspace account easier to select. This parameter is only a user-interface hint; the application middleware and database row-level-security policies enforce the domain independently.
