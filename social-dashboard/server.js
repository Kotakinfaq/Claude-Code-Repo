require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.STRAVA_REDIRECT_URI || `http://localhost:${PORT}/auth/strava/callback`;
const TOKEN_PATH = path.join(__dirname, "tokens.json");
const STRAVA_API = "https://www.strava.com/api/v3";

function requireCredentials(res) {
  if (CLIENT_ID && CLIENT_SECRET) return true;
  res
    .status(500)
    .send("Missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET. Copy .env.example to .env and fill them in.");
  return false;
}

function readTokens() {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
}

function writeTokens(tokens) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

async function exchangeToken(body) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...body }),
  });
  if (!res.ok) throw new Error(`Strava token request failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function getValidAccessToken() {
  const tokens = readTokens();
  if (!tokens) {
    const err = new Error("not_connected");
    err.code = "not_connected";
    throw err;
  }
  if (tokens.expires_at * 1000 > Date.now() + 60_000) return tokens.access_token;

  const refreshed = await exchangeToken({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
  });
  writeTokens(refreshed);
  return refreshed.access_token;
}

async function stravaGet(endpoint, accessToken) {
  const res = await fetch(`${STRAVA_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Strava API error ${res.status} on ${endpoint}: ${await res.text()}`);
  return res.json();
}

const app = express();
app.use(express.static(path.join(__dirname, "public")));

app.get("/auth/strava", (req, res) => {
  if (!requireCredentials(res)) return;
  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", "read,activity:read_all,profile:read_all");
  res.redirect(url.toString());
});

app.get("/auth/strava/callback", async (req, res) => {
  if (!requireCredentials(res)) return;
  const { code, error } = req.query;
  if (error) return res.status(400).send(`Strava authorization failed: ${error}`);
  if (!code) return res.status(400).send("Missing authorization code.");
  try {
    const tokens = await exchangeToken({ code, grant_type: "authorization_code" });
    writeTokens(tokens);
    res.redirect("/");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/api/logout", (req, res) => {
  if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
  res.json({ ok: true });
});

app.get("/api/status", (req, res) => {
  res.json({ connected: !!readTokens(), hasCredentials: !!(CLIENT_ID && CLIENT_SECRET) });
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const accessToken = await getValidAccessToken();
    const athlete = await stravaGet("/athlete", accessToken);
    const [activities, stats] = await Promise.all([
      stravaGet("/athlete/activities?per_page=200", accessToken),
      stravaGet(`/athletes/${athlete.id}/stats`, accessToken),
    ]);
    res.json({ athlete, activities, stats });
  } catch (err) {
    if (err.code === "not_connected") {
      return res.status(401).json({ error: "not_connected" });
    }
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Strava dashboard running at http://localhost:${PORT}`);
});
