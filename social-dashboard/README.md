# Strava Dashboard

A personal dashboard that reads your live activity data straight from your own
Strava account: distance, time, elevation, weekly trends, activity mix, and a
recent-activities table. Runs locally; no data leaves your machine except the
calls to Strava's own API.

## 1. Create a Strava API application

1. Go to https://www.strava.com/settings/api and create an app (any name/website
   works for personal use).
2. Set **Authorization Callback Domain** to `localhost`.
3. Note the **Client ID** and **Client Secret** shown on that page.

## 2. Configure

```bash
cd social-dashboard
cp .env.example .env
```

Edit `.env`:

```
STRAVA_CLIENT_ID=<your client id>
STRAVA_CLIENT_SECRET=<your client secret>
STRAVA_REDIRECT_URI=http://localhost:3000/auth/strava/callback
PORT=3000
```

## 3. Run

```bash
npm install
npm start
```

Open http://localhost:3000, click **Connect with Strava**, authorize the app,
and you'll land back on your dashboard.

## Notes

- Your OAuth tokens are stored locally in `social-dashboard/tokens.json`
  (gitignored) and refreshed automatically — you only authorize once.
- Click **Disconnect** in the top bar to delete the stored token.
- The dashboard reads your most recent 200 activities per load; the date
  filters (30 / 90 days, this year, all time) scope everything client-side
  from that set.
- Distances are shown in kilometers.
