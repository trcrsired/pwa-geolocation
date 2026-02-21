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

let lastPos = null;
let lastTime = null;
let watchId = null;

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

  // Restart geolocation watcher
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
// SPEED CALCULATION
// ------------------------------------------------------------
function computeSpeed(pos) {
  const { latitude, longitude, altitude, accuracy, speed } = pos.coords;
  const now = pos.timestamp;

  latEl.textContent = latitude;
  lonEl.textContent = longitude;
  altEl.textContent = altitude ?? "N/A";
  accEl.textContent = accuracy;

  if (speed !== null && !isNaN(speed)) return speed;

  if (lastPos && lastTime) {
    const dt = (now - lastTime) / 1000;
    if (dt > 0) {
      const dist = distanceMeters(
        lastPos.latitude,
        lastPos.longitude,
        latitude,
        longitude
      );
      return dist / dt;
    }
  }

  return 0;
}

// ------------------------------------------------------------
// START WATCHING POSITION
// ------------------------------------------------------------
function startWatching() {
  watchId = navigator.geolocation.watchPosition(
    pos => {
      const s = computeSpeed(pos);

      lastPos = pos.coords;
      lastTime = pos.timestamp;

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
