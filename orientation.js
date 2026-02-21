const spreadBlueEl  = document.getElementById("spreadBlue");
const spreadRedEl   = document.getElementById("spreadRed");
const spreadGreenEl = document.getElementById("spreadGreen");
const headingEl     = document.getElementById("heading");
const cardinalEl    = document.getElementById("cardinal");

let usingMag = false;

/* -------------------------------------------------------
   CARDINAL + ANGLE UTILITIES
------------------------------------------------------- */

// Convert heading degrees → emoji cardinal direction
function cardinalFromHeading(deg) {
  const dirs = ["⬆️","↗️","➡️","↘️","⬇️","↙️","⬅️","↖️"];
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

/* -------------------------------------------------------
   SPREAD ENGINE (PURE RATIONAL TRIG)
------------------------------------------------------- */

// Compute Blue, Red, Green spreads from vector (x, y)
function computeSpreads(x, y) {
  const Qx = x*x;
  const Qy = y*y;
  const Q  = Qx + Qy;

  // BLUE geometry spread (Euclidean)
  const spreadBlue = 1 - Qy / Q;

  // RED geometry spread (Minkowski)
  const Qred = Qx - Qy;
  const spreadRed = (Qred === 0)
    ? "N/A (null line)"
    : 1 + Qy / Qred;

  // GREEN geometry spread (multiplicative, reference ray = NE = (1, 1))
  const x2 = x, y2 = y;

  const numerator   = y2 - x2;              // x1*y2 - x2*y1
  const denominator = 4 * x2 * y2;      // 4*x1*x2*y1*y2

  const spreadGreen = (denominator === 0)
    ? "N/A (null line)"
    : 1 - (numerator * numerator) / denominator;

  return { spreadBlue, spreadRed, spreadGreen };
}

// Convert heading angle → spreads (fallback mode)
function spreadsFromHeading(headingDeg) {
  const rad = headingDeg * Math.PI / 180;

  // Unit direction vector from angle
  const x = Math.sin(rad);  // East component
  const y = Math.cos(rad);  // North component

  return computeSpreads(x, y);
}

// Update spreads UI
function updateSpreadUI({ spreadBlue, spreadRed, spreadGreen }) {
  spreadBlueEl.textContent  = spreadBlue;
  spreadRedEl.textContent   = spreadRed;
  spreadGreenEl.textContent = spreadGreen;
}

/* -------------------------------------------------------
   UI UPDATE
------------------------------------------------------- */

function updateUI(heading) {
  const cardinal = cardinalFromHeading(heading);
  headingEl.textContent = heading;
  cardinalEl.textContent = cardinal;
}

/* -------------------------------------------------------
   SENSOR LOGIC
------------------------------------------------------- */

// Try Magnetometer first
async function tryMagnetometer() {
  try {
    const perm = await navigator.permissions.query({ name: "magnetometer" });
    if (perm.state === "denied") return false;

    const mag = new Magnetometer({ frequency: 5 });

    mag.addEventListener("reading", () => {
      usingMag = true;
      const { x, y } = mag;

      // Compute spreads from magnetometer vector
      updateSpreadUI(computeSpreads(x, y));

      // Compute heading from magnetometer
      const heading = headingFromMag(x, y);
      updateUI(heading);
    });

    mag.start();
    return true;

  } catch (e) {
    return false;
  }
}

/* -------------------------------------------------------
   FALLBACKS
------------------------------------------------------- */

// DeviceOrientation absolute heading
function handleAbsoluteOrientation(e) {
  if (typeof e.webkitCompassHeading === "number") {
    const heading = e.webkitCompassHeading;
    updateUI(heading);
    updateSpreadUI(spreadsFromHeading(heading));
    return;
  }

  if (e.absolute && typeof e.alpha === "number") {
    const heading = normalize(360 - e.alpha);
    updateUI(heading);
    updateSpreadUI(spreadsFromHeading(heading));
  }
}

// DeviceOrientation alpha fallback
function handleAlphaFallback(e) {
  if (usingMag) return;
  if (typeof e.alpha === "number") {
    const heading = normalize(360 - e.alpha);
    updateUI(heading);
    updateSpreadUI(spreadsFromHeading(heading));
  }
}

/* -------------------------------------------------------
   STARTUP
------------------------------------------------------- */

async function startOrientation() {
  const magOK = await tryMagnetometer();
  if (magOK) return;

  // Magnetometer unavailable → try absolute orientation first
  let absoluteFired = false;

  function absoluteHandler(e) {
    absoluteFired = true;
    handleAbsoluteOrientation(e);
  }

  window.addEventListener("deviceorientationabsolute", absoluteHandler);

  // Wait 300ms to see if absolute orientation fires
  setTimeout(() => {
    if (!absoluteFired) {
      // Absolute orientation not supported → use alpha fallback
      window.removeEventListener("deviceorientationabsolute", absoluteHandler);
      window.addEventListener("deviceorientation", handleAlphaFallback);
    }
  }, 300);
}

startOrientation();
