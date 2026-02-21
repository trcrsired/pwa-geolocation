const headingEl = document.getElementById("heading");
const spreadEl = document.getElementById("spread");
const cardinalEl = document.getElementById("cardinal");

// Convert heading degrees → cardinal direction
function cardinalFromHeading(deg) {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// Update UI with heading, cardinal, spread
function updateOrientation(headingDeg) {
  if (headingDeg == null || isNaN(headingDeg)) {
    headingEl.textContent = "N/A";
    spreadEl.textContent = "N/A";
    cardinalEl.textContent = "N/A";
    return;
  }

  // Normalize to 0–360
  let h = headingDeg % 360;
  if (h < 0) h += 360;

  // Spread from North = sin^2(theta)
  // (We accept trig here because DeviceOrientation gives angles, not vectors)
  const rad = h * Math.PI / 180;
  const s = Math.sin(rad);
  const spread = s * s;

  const cardinal = cardinalFromHeading(h);

  headingEl.textContent = h;
  spreadEl.textContent = spread;
  cardinalEl.textContent = cardinal;
}

// Handle orientation event
function handleOrientation(e) {
  // iOS Safari provides a real compass heading
  if (typeof e.webkitCompassHeading === "number") {
    updateOrientation(e.webkitCompassHeading);
    return;
  }

  // Most Android browsers: alpha = rotation around Z axis
  if (typeof e.alpha === "number") {
    // Convert alpha (0° = East on some devices) → heading (0° = North)
    // Standard correction: heading = 360 - alpha
    const heading = 360 - e.alpha;
    updateOrientation(heading);
    return;
  }

  updateOrientation(null);
}

// Start orientation tracking
function startOrientation() {
  if (!("DeviceOrientationEvent" in window)) {
    updateOrientation(null);
    return;
  }

  // iOS permission flow
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission()
      .then(state => {
        if (state === "granted") {
          window.addEventListener("deviceorientation", handleOrientation);
        } else {
          updateOrientation(null);
        }
      })
      .catch(() => updateOrientation(null));
  } else {
    // Android / desktop
    window.addEventListener("deviceorientation", handleOrientation);
  }
}

startOrientation();
