(() => {
  "use strict";

  const TYPE_BUCKETS = [
    { key: "Run", match: ["Run", "TrailRun"], color: "--series-1" },
    { key: "Ride", match: ["Ride", "VirtualRide", "GravelRide", "MountainBikeRide", "EBikeRide"], color: "--series-2" },
    { key: "Swim", match: ["Swim"], color: "--series-3" },
    { key: "Walk", match: ["Walk"], color: "--series-4" },
    { key: "Hike", match: ["Hike"], color: "--series-5" },
    { key: "Strength", match: ["WeightTraining", "Workout", "Crossfit", "StrengthTraining"], color: "--series-6" },
    { key: "Yoga", match: ["Yoga"], color: "--series-7" },
  ];
  const OTHER_BUCKET = { key: "Other", color: "--series-8" };

  function bucketFor(type) {
    return TYPE_BUCKETS.find((b) => b.match.includes(type)) || OTHER_BUCKET;
  }

  // ---------- formatting ----------

  function formatKm(meters) {
    return (meters / 1000).toFixed(1);
  }

  function formatCompact(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return Math.round(n).toLocaleString();
  }

  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  }

  function formatPaceOrSpeed(type, meters, seconds) {
    if (!meters || !seconds) return "—";
    const km = meters / 1000;
    if (["Run", "TrailRun", "Walk", "Hike"].includes(type)) {
      const paceSecPerKm = seconds / km;
      const m = Math.floor(paceSecPerKm / 60);
      const s = Math.round(paceSecPerKm % 60);
      return `${m}:${String(s).padStart(2, "0")} /km`;
    }
    const kmh = km / (seconds / 3600);
    return `${kmh.toFixed(1)} km/h`;
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function weekStart(iso) {
    const d = new Date(iso);
    const day = d.getDay(); // 0 = Sunday
    const diff = (day + 6) % 7; // days since Monday
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - diff);
    return d;
  }

  // ---------- tooltip ----------

  const tooltipEl = document.getElementById("tooltip");
  function showTooltip(target, html) {
    tooltipEl.textContent = "";
    const strong = document.createElement("strong");
    strong.textContent = html.value;
    tooltipEl.appendChild(strong);
    if (html.label) {
      tooltipEl.appendChild(document.createTextNode(" " + html.label));
    }
    const rect = target.getBoundingClientRect();
    tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
    tooltipEl.style.top = `${rect.top - 8}px`;
    tooltipEl.hidden = false;
  }
  function hideTooltip() {
    tooltipEl.hidden = true;
  }
  function wireTooltip(el, getContent) {
    el.tabIndex = 0;
    el.addEventListener("mouseenter", () => showTooltip(el, getContent()));
    el.addEventListener("focus", () => showTooltip(el, getContent()));
    el.addEventListener("mouseleave", hideTooltip);
    el.addEventListener("blur", hideTooltip);
  }

  // ---------- theme ----------

  const themeToggle = document.getElementById("theme-toggle");
  function applyStoredTheme() {
    try {
      const stored = localStorage.getItem("dashboard-theme");
      if (stored) document.documentElement.setAttribute("data-theme", stored);
    } catch (e) {
      /* localStorage unavailable — fall back to system theme */
    }
  }
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("dashboard-theme", next);
    } catch (e) {
      /* ignore */
    }
  });
  applyStoredTheme();

  // ---------- rendering ----------

  const dashboardEl = document.getElementById("dashboard");
  const connectScreenEl = document.getElementById("connect-screen");
  const logoutBtn = document.getElementById("logout-btn");

  let allActivities = [];
  let athlete = null;
  let currentRangeDays = 30;

  function filteredActivities() {
    if (currentRangeDays === "all") return allActivities;
    const cutoff = Date.now() - currentRangeDays * 86400000;
    return allActivities.filter((a) => new Date(a.start_date).getTime() >= cutoff);
  }

  function renderAthleteHeader() {
    const el = document.getElementById("athlete-header");
    el.textContent = "";

    const img = document.createElement("img");
    img.className = "athlete-avatar";
    img.src = athlete.profile_medium || "";
    img.alt = "";
    el.appendChild(img);

    const info = document.createElement("div");
    const name = document.createElement("p");
    name.className = "athlete-name";
    name.textContent = `${athlete.firstname || ""} ${athlete.lastname || ""}`.trim() || "Athlete";
    info.appendChild(name);

    const location = [athlete.city, athlete.state, athlete.country].filter(Boolean).join(", ");
    if (location) {
      const loc = document.createElement("p");
      loc.className = "athlete-location";
      loc.textContent = location;
      info.appendChild(loc);
    }
    el.appendChild(info);
  }

  function renderStatTiles() {
    const acts = filteredActivities();
    const totalDistance = acts.reduce((sum, a) => sum + (a.distance || 0), 0);
    const totalTime = acts.reduce((sum, a) => sum + (a.moving_time || 0), 0);
    const totalElevation = acts.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0);

    const tiles = [
      { label: "Distance", value: `${formatCompact(totalDistance / 1000)} km` },
      { label: "Moving time", value: formatDuration(totalTime) },
      { label: "Elevation gain", value: `${formatCompact(totalElevation)} m` },
      { label: "Activities", value: formatCompact(acts.length) },
    ];

    const el = document.getElementById("stat-tiles");
    el.textContent = "";
    for (const tile of tiles) {
      const card = document.createElement("div");
      card.className = "stat-tile";
      const label = document.createElement("p");
      label.className = "stat-label";
      label.textContent = tile.label;
      const value = document.createElement("p");
      value.className = "stat-value";
      value.textContent = tile.value;
      card.appendChild(label);
      card.appendChild(value);
      el.appendChild(card);
    }
  }

  function renderWeeklyChart() {
    const acts = filteredActivities();
    const byWeek = new Map();
    for (const a of acts) {
      const key = weekStart(a.start_date).toISOString();
      byWeek.set(key, (byWeek.get(key) || 0) + (a.distance || 0));
    }
    const weeks = [...byWeek.entries()]
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .slice(-12);

    const el = document.getElementById("weekly-chart");
    el.textContent = "";

    if (weeks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No activities in this range.";
      el.appendChild(empty);
      return;
    }

    const max = Math.max(...weeks.map(([, meters]) => meters), 1);

    for (const [weekIso, meters] of weeks) {
      const col = document.createElement("div");
      col.className = "bar-col";

      const bar = document.createElement("div");
      bar.className = "bar";
      const pct = Math.max((meters / max) * 100, meters > 0 ? 4 : 0);
      bar.style.height = `${pct}%`;
      wireTooltip(bar, () => ({ value: `${formatKm(meters)} km`, label: `week of ${formatDate(weekIso)}` }));
      col.appendChild(bar);

      const tick = document.createElement("div");
      tick.className = "bar-tick";
      tick.textContent = formatDate(weekIso);
      col.appendChild(tick);

      el.appendChild(col);
    }
  }

  function renderTypeMix() {
    const acts = filteredActivities();
    const counts = new Map();
    for (const a of acts) {
      const bucket = bucketFor(a.type);
      counts.set(bucket.key, (counts.get(bucket.key) || { count: 0, color: bucket.color }));
      counts.get(bucket.key).count += 1;
    }
    const rows = [...counts.entries()].sort((a, b) => b[1].count - a[1].count);

    const el = document.getElementById("type-mix");
    el.textContent = "";

    if (rows.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No activities in this range.";
      el.appendChild(empty);
      return;
    }

    const max = Math.max(...rows.map(([, v]) => v.count), 1);

    for (const [typeName, { count, color }] of rows) {
      const row = document.createElement("div");
      row.className = "type-row";

      const name = document.createElement("span");
      name.className = "type-name";
      name.textContent = typeName;

      const track = document.createElement("div");
      track.className = "type-track";
      const fill = document.createElement("div");
      fill.className = "type-fill";
      fill.style.width = `${(count / max) * 100}%`;
      fill.style.background = `var(${color})`;
      wireTooltip(track, () => ({ value: String(count), label: count === 1 ? "activity" : "activities" }));
      track.appendChild(fill);

      const value = document.createElement("span");
      value.className = "type-value";
      value.textContent = String(count);

      row.appendChild(name);
      row.appendChild(track);
      row.appendChild(value);
      el.appendChild(row);
    }
  }

  function renderActivitiesTable() {
    const acts = [...filteredActivities()]
      .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
      .slice(0, 30);

    const body = document.getElementById("activities-body");
    body.textContent = "";

    if (acts.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.className = "empty-state";
      td.textContent = "No activities in this range.";
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }

    for (const a of acts) {
      const bucket = bucketFor(a.type);
      const tr = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = a.name || "Untitled";

      const typeCell = document.createElement("td");
      const pill = document.createElement("span");
      pill.className = "type-pill";
      const dot = document.createElement("span");
      dot.className = "type-dot";
      dot.style.background = `var(${bucket.color})`;
      pill.appendChild(dot);
      pill.appendChild(document.createTextNode(a.type || "Other"));
      typeCell.appendChild(pill);

      const dateCell = document.createElement("td");
      dateCell.textContent = formatDate(a.start_date);

      const distCell = document.createElement("td");
      distCell.textContent = a.distance ? `${formatKm(a.distance)} km` : "—";

      const timeCell = document.createElement("td");
      timeCell.textContent = formatDuration(a.moving_time || 0);

      const paceCell = document.createElement("td");
      paceCell.textContent = formatPaceOrSpeed(a.type, a.distance, a.moving_time);

      tr.appendChild(nameCell);
      tr.appendChild(typeCell);
      tr.appendChild(dateCell);
      tr.appendChild(distCell);
      tr.appendChild(timeCell);
      tr.appendChild(paceCell);
      body.appendChild(tr);
    }
  }

  function renderAll() {
    renderAthleteHeader();
    renderStatTiles();
    renderWeeklyChart();
    renderTypeMix();
    renderActivitiesTable();
  }

  document.getElementById("date-filters").addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const range = btn.dataset.range;
    currentRangeDays = range === "all" ? "all" : Number(range);
    renderStatTiles();
    renderWeeklyChart();
    renderTypeMix();
    renderActivitiesTable();
  });

  logoutBtn.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    location.reload();
  });

  // ---------- boot ----------

  async function boot() {
    const status = await fetch("/api/status").then((r) => r.json());

    if (!status.connected) {
      connectScreenEl.hidden = false;
      if (!status.hasCredentials) {
        document.getElementById("connect-title").textContent = "Strava API credentials needed";
        document.getElementById("connect-body").textContent =
          "Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in social-dashboard/.env, then restart the server. See the README for how to get them.";
        document.getElementById("connect-link").hidden = true;
      }
      return;
    }

    const data = await fetch("/api/dashboard").then((r) => r.json());
    if (data.error) {
      connectScreenEl.hidden = false;
      document.getElementById("connect-body").textContent = `Couldn't load your data: ${data.error}`;
      return;
    }

    athlete = data.athlete;
    allActivities = data.activities;

    dashboardEl.hidden = false;
    logoutBtn.hidden = false;
    renderAll();
  }

  boot();
})();
