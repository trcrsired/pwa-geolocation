// ------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------
const FREEZE_THRESHOLD = 30 * 1000; // 30 seconds

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

let lastPos = null;
let lastMovementTime = null;
let lastSpeed = 0;

let lastReverseGeocodeTime = 0;
const REVERSE_GEOCODE_INTERVAL = 10 * 60 * 1000;

// ------------------------------------------------------------
// INITIALIZE CHECKBOX
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

// ------------------------------------------------------------
// REVERSE GEOCODING
// ------------------------------------------------------------
async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      headers: { "User-Agent": "pwa-geolocation/1.0" },
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
// POSITION HANDLING
// ------------------------------------------------------------
function handlePosition(pos) {
  const { latitude, longitude, altitude, accuracy, speed } = pos.coords;
  const now = Date.now();

  // Update UI raw fields
  tsEl.textContent = new Date(pos.timestamp).toISOString();
  latEl.textContent = latitude;
  lonEl.textContent = longitude;
  altEl.textContent = altitude ?? "N/A";
  accEl.textContent = accuracy;
  rawEl.textContent = JSON.stringify(pos, null, 2);

  // If GNSS provides speed, use it directly
  if (speed !== null && !isNaN(speed) && speed > 0) {
    lastSpeed = speed;
  } else {
    // Otherwise compute instantaneous speed
    if (lastPos) {
      const sameLocation =
        lastPos.lat === latitude &&
        lastPos.lon === longitude;

      if (sameLocation) {
        // Location did not change
        if (now - lastMovementTime >= FREEZE_THRESHOLD) {
          // Treat as not moving
          lastSpeed = 0;
        }
        // else: treat as moving, keep lastSpeed unchanged
      } else {
        // Location changed → compute speed
        const d = distanceMeters(lastPos.lat, lastPos.lon, latitude, longitude);
        const dt = (pos.timestamp - lastPos.t) / 1000;

        if (dt > 0) {
          lastSpeed = d / dt;
        }

        lastMovementTime = now;
      }
    } else {
      // First point
      lastMovementTime = now;
      lastSpeed = 0;
    }
  }

  // Save current point
  lastPos = { lat: latitude, lon: longitude, t: pos.timestamp };

  // Display speed (no formatting)
  const kmh = lastSpeed * 3.6;
  const mph = lastSpeed * 2.23694;

  speedEl.innerHTML =
    lastSpeed + " m/s<br>" +
    kmh + " km/h<br>" +
    mph + " mph";

  // Reverse geocode occasionally
  if (now - lastReverseGeocodeTime > REVERSE_GEOCODE_INTERVAL) {
    lastReverseGeocodeTime = now;
    reverseGeocode(latitude, longitude).then(name => {
      placeEl.textContent = name;
    });
  }
}

function handleError(err) {
  speedEl.textContent = "N/A";
}

// ------------------------------------------------------------
// START WATCHING
// ------------------------------------------------------------
function startWatching() {
  watchId = navigator.geolocation.watchPosition(
    pos => handlePosition(pos),
    err => handleError(err),
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
