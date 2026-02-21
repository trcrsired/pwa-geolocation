const speedEl = document.getElementById("speed");
const latEl = document.getElementById("lat");
const lonEl = document.getElementById("lon");
const accEl = document.getElementById("acc");

let lastPos = null;
let lastTime = null;
let unit = "metric";

document.querySelectorAll("input[name='unit']").forEach(radio => {
  radio.addEventListener("change", e => {
    unit = e.target.value;
  });
});

// Haversine distance (meters)
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

function computeSpeed(pos) {
  const { latitude, longitude, accuracy, speed } = pos.coords;
  const now = pos.timestamp;

  // Raw floating‑point output
  latEl.textContent = latitude;
  lonEl.textContent = longitude;
  accEl.textContent = accuracy;

  // If device provides speed, use it
  if (speed !== null && !isNaN(speed)) {
    return speed; // m/s
  }

  // Otherwise compute manually
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

navigator.geolocation.watchPosition(
  pos => {
    const s = computeSpeed(pos);

    lastPos = pos.coords;
    lastTime = pos.timestamp;

    let display = "";

    if (unit === "metric") {
    const kmh = s * 3.6;
    display = s + " m/s (" + kmh + " km/h)";
    } else {
    const kmh = s * 3.6;
    const mph = s * 2.23694;
    display = s + " m/s (" + kmh + " km/h, " + mph + " mph)";
    }

    speedEl.textContent = display;
    document.getElementById("raw").textContent = JSON.stringify(pos, null, 2);
  },
  err => {
    speedEl.textContent = "Error: " + err.message;
  },
  {
    enableHighAccuracy: true,
    maximumAge: 500,
    timeout: 5000
  }
);
