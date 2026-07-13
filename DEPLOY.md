# Deploying Meditrax

Meditrax is a **fully static, offline-first PWA**. There is no backend to deploy, no
database, and no server-side secrets — everything runs in the browser and data is
stored locally on the user's device (IndexedDB). The only external network calls the
app ever makes are to **OpenRouter**, and only when a user has entered their own API
key in Settings.

> The `backend/` folder in this repo is legacy code from an earlier architecture and is
> **not used** by the deployed app. See [README.md](README.md#architecture) for details.

---

## 1. Push to GitHub

The repo already ships `.github/workflows/deploy-pages.yml`, which builds the React
app in `frontend/` and publishes it to GitHub Pages on every push to `main`.

## 2. Enable GitHub Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions.**

That's it — no environment variables or repository secrets are required for the build.
Push to `main` (or run the **Deploy frontend to GitHub Pages** workflow manually from
the Actions tab) and it will build and publish the site.

## 3. Custom domain (optional)

`frontend/public/CNAME` currently contains `meditrax.ca` (Create React App copies it
into the build automatically). To use your own domain:

1. Edit `frontend/public/CNAME` to your domain.
2. At your DNS provider, point the domain at GitHub Pages:

   **Apex domain → A records:**
   ```
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```
   **(optional) `www` subdomain → CNAME → `<your-username>.github.io`**

3. In **Settings → Pages**, set the custom domain and enable **Enforce HTTPS**.

To deploy without a custom domain, delete `frontend/public/CNAME` and GitHub Pages will
serve from `https://<your-username>.github.io/<repo-name>/` — in that case also set
`"homepage": "https://<your-username>.github.io/<repo-name>"` in `frontend/package.json`
so asset paths resolve correctly under the repo subpath.

## 4. Verify

- Visit the deployed URL. Deep links (e.g. `/medications`) work thanks to the
  `404.html` SPA fallback the workflow generates from `index.html`.
- On iPhone: Safari → Share → **Add to Home Screen**, open the installed app, then
  enable notifications in **Settings** inside Meditrax.
- Confirm the app works fully offline: add a medication, log a dose, close the tab,
  reopen it — everything should still be there (it's in IndexedDB, not on a server).

## 5. Using the AI features

AI features (assistant chat, medication research, AI insights) are optional and are
enabled per-user, per-device:

1. Get an API key at [openrouter.ai/keys](https://openrouter.ai/keys).
2. In the deployed app, go to **Settings → AI Assistant** and paste the key.
3. The key is stored only in that browser's IndexedDB and is sent only to OpenRouter.

There is nothing to configure at deploy time for this — no repo secrets, no build
variables. Every user brings (and pays for) their own key.

---

### Notes

- **Notifications** are local-only (the Notification API + client-side scheduling).
  There is no push server, so background delivery is best-effort and varies by
  platform — iOS in particular only fires reminders while the installed PWA is open
  or recently active.
- **Data portability**: Settings → Export/Import produces a JSON file the user
  controls — use it to back up or move data between devices; there is no cloud sync.
- **Local development**: see [README.md](README.md#development) for `yarn`/`npm`
  setup, running tests, and the dev server.
