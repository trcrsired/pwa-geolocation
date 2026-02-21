// ------------------------------------------------------------
// CONFIGURABLE WINDOWS (in ms)
// ------------------------------------------------------------
let START_WINDOW = 30 * 1000;    // 30 seconds
let DISCARD_WINDOW = 45 * 1000; // 45 seconds

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

// All points within DISCARD_WINDOW
let fullHistory = []; // { t, lat, lon, acc }

// Points within START_WINDOW
let startQueue = []; // subset of fullHistory

// Speed samples (computed from averaged start → current)
let speedSamples = []; // { t, v }

// Last good position (for UI fallback)
let lastGoodPos = null;
let lastGoodTime = null;

// Reverse geocode timer
let lastReverseGeocodeTime = 0;
const REVERSE_GEOCODE_INTERVAL = 10 * 60 * 1000;

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

// ------------------------------------------------------------
// HISTORY MANAGEMENT
// ------------------------------------------------------------
function addPoint(pos) {
  const t = pos.timestamp;
  const { latitude, longitude, accuracy } = pos.coords;

  const p = { t, lat: latitude, lon: longitude, acc: accuracy };

  fullHistory.push(p);

  const now = Date.now();

  // Remove points older than DISCARD_WINDOW
  fullHistory = fullHistory.filter(pt => now - pt.t <= DISCARD_WINDOW);

  // Maintain startQueue (points within START_WINDOW)
  startQueue = fullHistory.filter(pt => now - pt.t <= START_WINDOW);
}

// ------------------------------------------------------------
// COMPUTE AVERAGED STARTING POINT
// ------------------------------------------------------------
function computeStartPoint(currentPoint) {
  const N = startQueue.length;

  if (N === 0) {
    return fullHistory.length > 0 ? fullHistory[0] : currentPoint;
  }

  // If we haven't reached START_WINDOW, exclude current point
  let pts = startQueue;
  if (Date.now() - startQueue[0].t < START_WINDOW && N > 1) {
    pts = startQueue.slice(0, -1);
  }

  let sumLat = 0;
  let sumLon = 0;
  let sumT = 0;

  for (const p of pts) {
    sumLat += p.lat;
    sumLon += p.lon;
    sumT += p.t;
  }

  const M = pts.length;

  return {
    lat: sumLat / M,
    lon: sumLon / M,
    t: sumT / M
  };
}

// ------------------------------------------------------------
// COMPUTE SPEED SAMPLE (statistical fallback)
// ------------------------------------------------------------
function computeSpeedSample(start, current) {
  const d = distanceMeters(start.lat, start.lon, current.lat, current.lon);
  const dt = (current.t - start.t) / 1000;

  if (dt <= 0) return 0;
  return d / dt;
}

// ------------------------------------------------------------
// COMPUTE DISPLAY SPEED (average of last START_WINDOW samples)
// ------------------------------------------------------------
function computeDisplaySpeed() {
  const now = Date.now();
  const recent = speedSamples.filter(s => now - s.t <= START_WINDOW);

  if (recent.length === 0) return 0;

  let sum = 0;
  for (const s of recent) sum += s.v;

  return sum / recent.length;
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
        "User-Agent": "pwa-geolocation/1.0"
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
// POSITION HANDLING
// ------------------------------------------------------------
function handlePosition(pos) {
  lastGoodPos = pos;
  lastGoodTime = Date.now();

  const { latitude, longitude, altitude, accuracy, speed } = pos.coords;

  tsEl.textContent = new Date(pos.timestamp).toISOString();
  latEl.textContent = latitude;
  lonEl.textContent = longitude;
  altEl.textContent = altitude ?? "N/A";
  accEl.textContent = accuracy;
  rawEl.textContent = JSON.stringify(pos, null, 2);

  // Add to history
  addPoint(pos);

  // If GNSS provides speed, use it directly
  let v;
  let useNativeSpeed = false;

  if (speed !== null && !isNaN(speed) && speed > 0) {
    v = speed; // m/s
    useNativeSpeed = true;
  } else {
    // Otherwise use statistical model
    const start = computeStartPoint(pos);
    const current = { lat: latitude, lon: longitude, t: pos.timestamp };
    v = computeSpeedSample(start, current);
  }

  // Add speed sample
  speedSamples.push({ t: Date.now(), v });

  // Compute display speed
  let displaySpeed;

  if (useNativeSpeed) {
    // If GNSS speed exists, ALWAYS display it directly
    displaySpeed = v;
  } else {
    // Otherwise display statistical average
    displaySpeed = computeDisplaySpeed();
  }

  const kmh = displaySpeed * 3.6;
  const mph = displaySpeed * 2.23694;

  // Multi-line output, no toFixed
  speedEl.innerHTML =
    "m/s:<br>" + displaySpeed + "<br>km/h:<br>" +
    kmh + "<br>mph:<br>" +
    mph;


  // Reverse geocode occasionally
  const now = Date.now();
  if (now - lastReverseGeocodeTime > REVERSE_GEOCODE_INTERVAL) {
    lastReverseGeocodeTime = now;
    reverseGeocode(latitude, longitude).then(name => {
      placeEl.textContent = name;
    });
  }
}

function handleError(err) {
  const now = Date.now();
  if (!lastGoodTime || now - lastGoodTime > 10 * 60 * 1000) {
    speedEl.textContent = "N/A";
  }
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
