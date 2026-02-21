// ------------------------------------------------------------
// UI ELEMENTS
// ------------------------------------------------------------
const speedEl = document.getElementById("speed");
const latEl = document.getElementById("lat");
const lonEl = document.getElementById("lon");
const altEl = document.getElementById("alt");
const accEl = document.getElementById("acc");
const tsEl = document.getElementById("ts");
const placeEl = document.getElementById("place");
const rawEl = document.getElementById("raw");

const highAccuracyCheckbox = document.getElementById("highAccuracy");

// ------------------------------------------------------------
// STATE
// ------------------------------------------------------------
let useHighAccuracy = localStorage.getItem("highAccuracy") === "false" ? false : true;
let watchId = null;

// Store points for regression (e.g. last 2 minutes)
let pointHistory = []; // { t, lat, lon, acc }

let lastReverseGeocodeTime = 0;
const REVERSE_GEOCODE_INTERVAL = 10 * 60 * 1000; // 10 minutes
const HISTORY_WINDOW_MS = 120000; // 2 minutes

// ------------------------------------------------------------
// RESTORE UI STATE
// ------------------------------------------------------------
if (highAccuracyCheckbox) {
  highAccuracyCheckbox.checked = useHighAccuracy;
  highAccuracyCheckbox.addEventListener("change", e => {
    useHighAccuracy = e.target.checked;
    localStorage.setItem("highAccuracy", useHighAccuracy);
    navigator.geolocation.clearWatch(watchId);
    startWatching();
  });
}

// ------------------------------------------------------------
// GEO MATH
// ------------------------------------------------------------
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Convert lat/lon to local x,y in meters around a reference
function latLonToXY(lat, lon, lat0, lon0) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;

  const dLat = toRad(lat - lat0);
  const dLon = toRad(lon - lon0);
  const meanLat = toRad((lat + lat0) / 2);

  const x = R * dLon * Math.cos(meanLat);
  const y = R * dLat;
  return { x, y };
}

// ------------------------------------------------------------
// REGRESSION-BASED SPEED ESTIMATION
// ------------------------------------------------------------
function addPointForRegression(pos) {
  const t = pos.timestamp; // ms
  const { latitude, longitude, accuracy } = pos.coords;

  pointHistory.push({
    t,
    lat: latitude,
    lon: longitude,
    acc: accuracy || 10000
  });

  const now = Date.now();
  pointHistory = pointHistory.filter(p => now - p.t <= HISTORY_WINDOW_MS);
}

function computeSpeedFromRegression() {
  if (pointHistory.length < 3) return 0;

  // Reference point for local coordinates
  const ref = pointHistory[0];
  const lat0 = ref.lat;
  const lon0 = ref.lon;

  // Build arrays for regression
  const t0 = pointHistory[0].t / 1000; // seconds
  const xs = [];
  const ys = [];
  const ts = [];
  const ws = [];

  for (const p of pointHistory) {
    const { x, y } = latLonToXY(p.lat, p.lon, lat0, lon0);
    const t = p.t / 1000 - t0; // seconds since first point

    // Weight: inverse square of accuracy (but clamp to avoid infinities)
    const acc = Math.max(p.acc, 1);
    const w = 1 / (acc * acc);

    xs.push(x);
    ys.push(y);
    ts.push(t);
    ws.push(w);
  }

  // Weighted linear regression: x(t) and y(t)
  function weightedSlope(t, v, w) {
    const n = t.length;
    if (n < 2) return 0;

    let Sw = 0, Swt = 0, Swv = 0, Swtt = 0, Swtv = 0;
    for (let i = 0; i < n; i++) {
      const wi = w[i];
      const ti = t[i];
      const vi = v[i];
      Sw += wi;
      Swt += wi * ti;
      Swv += wi * vi;
      Swtt += wi * ti * ti;
      Swtv += wi * ti * vi;
    }

    const denom = Sw * Swtt - Swt * Swt;
    if (denom === 0) return 0;

    // slope = (Sw * Swtv - Swt * Swv) / denom
    return (Sw * Swtv - Swt * Swv) / denom;
  }

  const vx = weightedSlope(ts, xs, ws); // m/s
  const vy = weightedSlope(ts, ys, ws); // m/s

  const speed = Math.sqrt(vx * vx + vy * vy);
  return speed;
}

// ------------------------------------------------------------
// REVERSE GEOCODING
// ------------------------------------------------------------
async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      headers: {
        "User-Agent": "pwa-geolocation/1.0 (https://github.com/trcrsired/pwa-geolocation)"
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) return "Unknown location";

    const data = await res.json();
    return data.display_name || "Unknown location";

  } catch (e) {
    return "Unknown location";
  }
}

// ------------------------------------------------------------
// START WATCHING POSITION
// ------------------------------------------------------------
function startWatching() {
  watchId = navigator.geolocation.watchPosition(
    pos => {
      const { latitude, longitude, altitude, accuracy } = pos.coords;

      tsEl.textContent = new Date(pos.timestamp).toISOString();
      latEl.textContent = latitude;
      lonEl.textContent = longitude;
      altEl.textContent = altitude ?? "N/A";
      accEl.textContent = accuracy;

      rawEl.textContent = JSON.stringify(pos, null, 2);

      // Add to regression history
      addPointForRegression(pos);

      // Compute speed from regression
      const s = computeSpeedFromRegression();
      const kmh = s * 3.6;
      const mph = s * 2.23694;

      // Always show all units, multi-line
      speedEl.innerHTML =
        `${s.toFixed(2)} m/s<br>` +
        `${kmh.toFixed(2)} km/h<br>` +
        `${mph.toFixed(2)} mph`;

      // Reverse geocode occasionally
      const now = Date.now();
      if (now - lastReverseGeocodeTime > REVERSE_GEOCODE_INTERVAL) {
        lastReverseGeocodeTime = now;

        reverseGeocode(latitude, longitude).then(name => {
          placeEl.textContent = name;
        });
      }
    },
    err => {
      speedEl.textContent = "N/A";
    },
    {
      enableHighAccuracy: useHighAccuracy,
      maximumAge: 500,
      timeout: 50000
    }
  );
}

// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------
startWatching();
