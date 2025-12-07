This project is a Vite + React frontend intended to be hosted as a static site.

Quick Render deployment guide

1) Connect repository on Render
   - Sign in to Render (https://render.com) and choose "New" → "Web Service" or "Static Site".
   - Instead of using the UI, this repo includes `render.yaml` so you can use Render's automatic spec-based deploy.

2) What `render.yaml` does
   - Builds the app with `npm ci && npm run build`.
   - Publishes the `dist` directory (the Vite output).
   - Rewrites all routes to `/index.html` so the SPA routing works on direct links.

3) Build / Preview locally

Install deps and run dev server (mobile-friendly preview):

```bash
npm ci
npm run dev
```

For a production build (what Render runs):

```bash
npm run build
# then serve `dist` with a static server, e.g.:
# npx serve dist
```

4) Mobile compatibility notes
- The app is responsive (Tailwind). Test on a mobile browser (Chrome on Android / Safari on iOS).
- Web Bluetooth: iOS Safari does not support Web Bluetooth. Use a Chromium-based browser on Android for smartwatch connectivity.
- Web Bluetooth requires a secure context: `https://` or `http://localhost`. Render provides HTTPS by default, so the deployed site will work.
- Location API requires user permission and secure context as well.

5) Backend / API / ML model integration
- This repo is the frontend only. For full functionality you will need:
  - An API endpoint(s) to fetch weather/pollen and to store user logs/predictions.
  - Authentication endpoints for login/registration (email confirmation flow).
  - ML model endpoints (serving prediction models). These can be hosted as separate Render services or other cloud functions.
- Use environment variables for API base URLs and keys. You can add them on Render's dashboard or in `render.yaml` as `envVars`.

6) Recommended next steps
- Add a deploy preview by connecting the repo to Render and pushing a branch.
- Create separate Render services for your ML models (Docker or Python web service) and your database (managed DB or Supabase).
- Add `DISABLE_SSR` or other env vars if needed.

If you want, I can:
- Add environment-variable wiring (e.g. `VITE_API_BASE_URL`) to the code and to `render.yaml`.
- Add a small `status` page or health-check endpoint to verify backend connectivity.
- Prepare a Dockerfile if you'd rather host the frontend in a container.
