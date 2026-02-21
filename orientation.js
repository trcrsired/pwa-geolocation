const headingEl = document.getElementById("heading");
const spreadEl = document.getElementById("spread");
const cardinalEl = document.getElementById("cardinal");

let usingMag = false;

// Convert heading degrees → cardinal direction
function cardinalFromHeading(deg) {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// Normalize angle to 0–360
function normalize(deg) {
  deg = deg % 360;
  return deg < 0 ? deg + 360 : deg;
}

// Compute heading from magnetometer (same as onlinecompass.app)
function headingFromMag(x, y) {
  let angle = Math.atan2(y, x) * 180 / Math.PI;
  angle = 90 - angle;
  return normalize(angle);
}

// Update UI
function updateUI(heading) {
  const rad = heading * Math.PI / 180;
  const spread = Math.sin(rad) ** 2;
  const cardinal = cardinalFromHeading(heading);

  headingEl.textContent = heading;
  spreadEl.textContent = spread;
  cardinalEl.textContent = cardinal;
}

// Try Magnetometer first
async function tryMagnetometer() {
  try {
    const perm = await navigator.permissions.query({ name: "magnetometer" });
    if (perm.state === "denied") return false;

    const mag = new Magnetometer({ frequency: 5 });

    mag.addEventListener("reading", () => {
      usingMag = true;
      const { x, y, z } = mag;
      const heading = headingFromMag(x, y);
      updateUI(heading);
    });

    mag.start();
    return true;

  } catch (e) {
    return false;
  }
}

// Fallback: DeviceOrientation absolute heading
function handleAbsoluteOrientation(e) {
  if (typeof e.webkitCompassHeading === "number") {
    updateUI(e.webkitCompassHeading);
    return;
  }

  if (e.absolute && typeof e.alpha === "number") {
    const heading = normalize(360 - e.alpha);
    updateUI(heading);
  }
}

// Fallback: DeviceOrientation alpha only
function handleAlphaFallback(e) {
  if (usingMag) return;
  if (typeof e.alpha === "number") {
    const heading = normalize(360 - e.alpha);
    updateUI(heading);
  }
}

async function startOrientation() {
  const magOK = await tryMagnetometer();

  if (!magOK) {
    // Try absolute orientation
    window.addEventListener("deviceorientationabsolute", handleAbsoluteOrientation);

    // Fallback alpha
    window.addEventListener("deviceorientation", handleAlphaFallback);
  }
}

startOrientation();
