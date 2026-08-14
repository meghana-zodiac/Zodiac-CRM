# Google sign-in setup

This project uses **Lovable Cloud**. Enable Google authentication from the Lovable project rather than creating a separate Supabase account.

1. Open the project in Lovable.
2. Select **Cloud → Users → Auth → Google**.
3. Enable Google sign-in and select **Managed by Lovable** (recommended). Lovable manages the OAuth credentials and redirect setup.
4. Test the **Continue with Google** button in Preview, then publish the app.
5. Apply `supabase/migrations/20260814090000_require_authenticated_crm_access.sql` through the Lovable Cloud database migration workflow. It removes anonymous database access and permits the CRM tables only for authenticated users.

Managed Google sign-in authenticates Google accounts, but it does not by itself limit access to a particular company domain. If this CRM must be restricted to your Google Workspace organization, configure Lovable Cloud SAML SSO for your organization domain or maintain an approved-user allow-list before launch.
