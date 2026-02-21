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

const unitRadios = document.querySelectorAll("input[name='unit']");
const highAccuracyCheckbox = document.getElementById("highAccuracy");

// ------------------------------------------------------------
// STATE
// ------------------------------------------------------------
let unit = localStorage.getItem("unit") || "metric";
let useHighAccuracy = localStorage.getItem("highAccuracy") === "false" ? false : true;

let watchId = null;

// Store all GPS points from the last 30 seconds
let pointHistory = []; // { pos, timestamp }

let lastReverseGeocodeTime = 0;
const REVERSE_GEOCODE_INTERVAL = 10 * 60 * 1000; // 10 minutes

// ------------------------------------------------------------
// RESTORE UI STATE
// ------------------------------------------------------------
unitRadios.forEach(r => r.checked = r.value === unit);
highAccuracyCheckbox.checked = useHighAccuracy;

// ------------------------------------------------------------
// EVENT LISTENERS
// ------------------------------------------------------------
unitRadios.forEach(radio => {
  radio.addEventListener("change", e => {
    unit = e.target.value;
    localStorage.setItem("unit", unit);
  });
});

highAccuracyCheckbox.addEventListener("change", e => {
  useHighAccuracy = e.target.checked;
  localStorage.setItem("highAccuracy", useHighAccuracy);

  navigator.geolocation.clearWatch(watchId);
  startWatching();
});

// ------------------------------------------------------------
// HAVERSINE DISTANCE
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

// ------------------------------------------------------------
// SPEED ENGINE — 30-second baseline method
// ------------------------------------------------------------
function addPoint(pos) {
  const now = Date.now();
  pointHistory.push({ pos, timestamp: now });

  // Keep only last 30 seconds
  pointHistory = pointHistory.filter(p => now - p.timestamp <= 30000);
}

function computeSpeed30s() {
  const now = Date.now();
  if (pointHistory.length < 2) return 0;

  // Target time: 30 seconds ago
  const targetTime = now - 30000;

  let best = null;
  let bestDiff = Infinity;

  for (const p of pointHistory) {
    const diff = Math.abs(p.timestamp - targetTime);
    if (diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  }

  // Fallback: earliest point
  if (!best) best = pointHistory[0];

  const p1 = best.pos;
  const p2 = pointHistory[pointHistory.length - 1].pos;

  const lat1 = p1.coords.latitude;
  const lon1 = p1.coords.longitude;
  const lat2 = p2.coords.latitude;
  const lon2 = p2.coords.longitude;

  const dt = (p2.timestamp - p1.timestamp) / 1000;
  if (dt <= 0) return 0;

  // Skip extremely inaccurate points
  if (p1.coords.accuracy > 100 || p2.coords.accuracy > 100) return 0;

  const dist = distanceMeters(lat1, lon1, lat2, lon2);
  return dist / dt;
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

      // Add point to 30s history
      addPoint(pos);

      // Compute speed using 30-second baseline
      const s = computeSpeed30s();
      const kmh = s * 3.6;
      const mph = s * 2.23694;

      // MULTI-LINE SPEED OUTPUT
      speedEl.innerHTML =
        `${s} m/s<br>` +
        `${kmh} km/h<br>` +
        `${mph} mph`;

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
