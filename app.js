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
let history = []; // last 5 raw pos objects

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
// ACCURACY-AWARE SPEED FROM LAST 5 POINTS
// ------------------------------------------------------------
function computeSpeedFromHistory() {
  if (history.length < 2) return 0;

  let totalDist = 0;
  let totalTime = 0;

  for (let i = 1; i < history.length; i++) {
    const p1 = history[i - 1];
    const p2 = history[i];

    const lat1 = p1.coords.latitude;
    const lon1 = p1.coords.longitude;
    const lat2 = p2.coords.latitude;
    const lon2 = p2.coords.longitude;

    const acc1 = p1.coords.accuracy || 0;
    const acc2 = p2.coords.accuracy || 0;

    const dist = distanceMeters(lat1, lon1, lat2, lon2);
    const dt = (p2.timestamp - p1.timestamp) / 1000;

    if (dt <= 0) continue;

    const combinedAccuracy = acc1 + acc2;
    const effectiveDist = Math.max(0, dist - combinedAccuracy);

    totalDist += effectiveDist;
    totalTime += dt;
  }

  if (totalTime === 0) return 0;
  return totalDist / totalTime;
}

// ------------------------------------------------------------
// REVERSE GEOCODING (OpenStreetMap)
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

      history.push(pos);
      if (history.length > 5) history.shift();

      const s = computeSpeedFromHistory();
      const kmh = s * 3.6;
      const mph = s * 2.23694;

      if (unit === "metric") {
        speedEl.textContent = `${s} m/s (${kmh} km/h)`;
      } else {
        speedEl.textContent = `${s} m/s (${kmh} km/h, ${mph} mph)`;
      }

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


// ------------------------------------------------------------
// DIRECTION / HEADING (Compass)
// ------------------------------------------------------------
const headingEl = document.getElementById("heading");

// Try Generic Sensor API first
function startCompassSensor() {
  if ("AbsoluteOrientationSensor" in window) {
    try {
      const sensor = new AbsoluteOrientationSensor({ frequency: 30 });
      sensor.addEventListener("reading", () => {
        const q = sensor.quaternion;
        if (!q) return;

        // Convert quaternion → yaw (heading)
        const [x, y, z, w] = q;

        const siny = 2 * (w * z + x * y);
        const cosy = 1 - 2 * (y * y + z * z);
        let heading = Math.atan2(siny, cosy) * (180 / Math.PI);

        if (heading < 0) heading += 360;

        headingEl.textContent = heading.toFixed(1);
      });

      sensor.addEventListener("error", () => {
        console.warn("Orientation sensor error");
      });

      sensor.start();
      return true;

    } catch (e) {
      console.warn("AbsoluteOrientationSensor failed:", e);
      return false;
    }
  }

  return false;
}

// Fallback: DeviceOrientationEvent
function startCompassFallback() {
  if (!("DeviceOrientationEvent" in window)) {
    headingEl.textContent = "N/A";
    return;
  }

  window.addEventListener("deviceorientation", e => {
    if (e.absolute === true && e.alpha != null) {
      let heading = 360 - e.alpha; // alpha is clockwise from north
      if (heading < 0) heading += 360;
      headingEl.textContent = heading.toFixed(1);
    }
  });
}

// Start direction sensing
if (!startCompassSensor()) {
  startCompassFallback();
}
