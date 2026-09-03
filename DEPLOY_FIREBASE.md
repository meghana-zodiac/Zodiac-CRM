# Deploying to Firebase (project: `zodiac-crm-app`)

This app is a **TanStack Start SSR** app (it uses server functions, e.g. the Apollo
prospecting call), so Firebase Hosting alone (static files) is not enough. The setup here is
the standard Firebase pattern for SSR apps:

- **Firebase Hosting** serves the static client assets from `.output/public`
- **Cloud Run** (`zodiac-crm-ssr`) runs the SSR/server-function bundle from `.output/server`
- A Hosting rewrite (`firebase.json`) sends all other requests to the Cloud Run service

> Requires the **Blaze (pay-as-you-go)** plan — Cloud Run is not available on Spark.

## One-time setup

1. In Google Cloud, enable: Cloud Run API, Cloud Build API, Artifact Registry API.
2. Create a service account (or reuse the Firebase one) with roles:
   `Firebase Hosting Admin`, `Cloud Run Admin`, `Cloud Build Editor`,
   `Artifact Registry Writer`, `Service Account User`.
3. Add its JSON key to GitHub → Settings → Secrets → Actions as
   `FIREBASE_SERVICE_ACCOUNT_ZODIAC_CRM_APP`.
4. Add these repo secrets too:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (build-time, client)
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `LOVABLE_API_KEY` (runtime, Cloud Run)

## Deploy

Push to `main` — `.github/workflows/firebase-hosting-merge.yml` builds with
`NITRO_PRESET=node`, deploys the container to Cloud Run, then deploys Hosting.

Manual deploy from your machine:

```bash
NITRO_PRESET=node bun run build
gcloud run deploy zodiac-crm-ssr --project zodiac-crm-app --region us-central1 \
  --source . --allow-unauthenticated --port 8080
firebase deploy --only hosting
```

## Notes

- `.github/workflows/deploy.yml` still FTP-deploys to BigRock on every push to `main`.
  Delete it if Firebase is now the only host.
- Region is `us-central1` in both `firebase.json` and the workflow — change both together.
- The database/auth backend stays where it is; Firebase only hosts the app.
