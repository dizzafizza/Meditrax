# Deploying Meditrax

Meditrax is split into two parts:

- **Backend** (FastAPI + MongoDB + AI + Web Push) -> hosted on **Emergent**
- **Frontend** (React PWA) -> hosted on **GitHub Pages** at **https://meditrax.ca**

The frontend talks to the backend through the `REACT_APP_BACKEND_URL` environment variable.

---

## 1. Deploy the backend on Emergent

1. In the Emergent editor, click **Deploy**.
2. After it finishes, copy the **deployed backend URL** (e.g. `https://meditrax.emergent.host`).
   - All API routes are under `/api`, so the frontend will call `<backend-url>/api/...`.
3. The backend already reads its secrets from environment variables
   (`MONGO_URL`, `DB_NAME`, `EMERGENT_LLM_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CORS_ORIGINS`).
   - `CORS_ORIGINS` is `*` by default (works for GitHub Pages). To lock it down, set it to
     `https://meditrax.ca` on the deployed backend.

## 2. Push the code to GitHub

Commit the repository (it should contain a `frontend/` folder and this workflow at
`.github/workflows/deploy-pages.yml`).

## 3. Configure the frontend build

In your GitHub repo: **Settings -> Secrets and variables -> Actions -> Variables -> New repository variable**

| Name | Value |
|------|-------|
| `REACT_APP_BACKEND_URL` | your deployed Emergent backend URL (no trailing slash) |

## 4. Enable GitHub Pages

**Settings -> Pages -> Build and deployment -> Source: GitHub Actions.**

Push to `main` (or run the **Deploy frontend to GitHub Pages** workflow manually). It will build the
React app with your backend URL baked in and publish it.

## 5. Custom domain (meditrax.ca)

- `frontend/public/CNAME` already contains `meditrax.ca` (CRA copies it into the build).
- At your DNS provider, point the apex domain to GitHub Pages:

  **Apex (meditrax.ca) -> A records:**
  ```
  185.199.108.153
  185.199.109.153
  185.199.110.153
  185.199.111.153
  ```
  **(optional) www.meditrax.ca -> CNAME -> <your-username>.github.io**

- In **Settings -> Pages**, set the custom domain to `meditrax.ca` and enable **Enforce HTTPS**.

## 6. Verify

- Visit https://meditrax.ca
- Deep links (e.g. /medications) work thanks to the `404.html` SPA fallback.
- On iPhone: Safari -> Share -> **Add to Home Screen**, open the installed app, then enable
  notifications in **Settings** inside Meditrax.

---

### Notes
- Web Push requires the installed PWA (iOS 16.4+). The VAPID keys live on the backend.
- The AI assistant and push sender run on the backend; the static GitHub Pages site never sees the LLM key.
