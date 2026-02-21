// ------------------------------------------------------------
// UI ELEMENTS
// ------------------------------------------------------------
const speedEl = document.getElementById("speed");
const latEl = document.getElementById("lat");
const lonEl = document.getElementById("lon");
const altEl = document.getElementById("alt");
const accEl = document.getElementById("acc");
const rawEl = document.getElementById("raw");

const unitRadios = document.querySelectorAll("input[name='unit']");
const highAccuracyCheckbox = document.getElementById("highAccuracy");

// ------------------------------------------------------------
// STATE (with defaults)
// ------------------------------------------------------------
let unit = localStorage.getItem("unit") || "metric";
let useHighAccuracy = localStorage.getItem("highAccuracy") === "false" ? false : true;

let watchId = null;

// Store last 5 points
let history = [];   // each entry: { lat, lon, timestamp }

// ------------------------------------------------------------
// RESTORE UI STATE
// ------------------------------------------------------------
unitRadios.forEach(radio => {
  radio.checked = radio.value === unit;
});

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
// HAVERSINE DISTANCE (meters)
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
// SPEED CALCULATION USING LAST 5 POINTS
// ------------------------------------------------------------
function computeSpeedFromHistory() {
  if (history.length < 2) return 0;

  let totalDist = 0;
  let totalTime = 0;

  for (let i = 1; i < history.length; i++) {
    const p1 = history[i - 1];
    const p2 = history[i];

    const dist = distanceMeters(p1.lat, p1.lon, p2.lat, p2.lon);
    const dt = (p2.timestamp - p1.timestamp) / 1000;

    if (dt > 0) {
      totalDist += dist;
      totalTime += dt;
    }
  }

  if (totalTime === 0) return 0;
  return totalDist / totalTime; // m/s
}

// ------------------------------------------------------------
// START WATCHING POSITION
// ------------------------------------------------------------
function startWatching() {
  watchId = navigator.geolocation.watchPosition(
    pos => {
      const { latitude, longitude, altitude, accuracy } = pos.coords;

      // Update UI
      latEl.textContent = latitude;
      lonEl.textContent = longitude;
      altEl.textContent = altitude ?? "N/A";
      accEl.textContent = accuracy;

      // Add to history
      history.push({
        lat: latitude,
        lon: longitude,
        timestamp: pos.timestamp
      });

      // Keep only last 5 points
      if (history.length > 5) history.shift();

      // Compute speed
      const s = computeSpeedFromHistory();
      const kmh = s * 3.6;
      const mph = s * 2.23694;

      if (unit === "metric") {
        speedEl.textContent = s + " m/s (" + kmh + " km/h)";
      } else {
        speedEl.textContent =
          s + " m/s (" + kmh + " km/h, " + mph + " mph)";
      }

      rawEl.textContent = JSON.stringify(pos, null, 2);
    },
    err => {
      speedEl.textContent = "Error: " + err.message;
    },
    {
      enableHighAccuracy: useHighAccuracy,
      maximumAge: 500,
      timeout: 5000
    }
  );
}

// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------
startWatching();
