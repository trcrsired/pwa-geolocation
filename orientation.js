const headingEl = document.getElementById("heading");
const spreadEl = document.getElementById("spread");
const cardinalEl = document.getElementById("cardinal");

// Decide cardinal direction using only signs + spread
function cardinalFromVector(fx, fz) {
  const x2 = fx * fx;
  const z2 = fz * fz;
  const Q = x2 + z2;
  if (Q === 0) return "N/A";

  const sN = x2 / Q; // spread from North

  const northSouth = fz >= 0 ? "N" : "S";
  const eastWest = fx >= 0 ? "E" : "W";

  if (sN < 0.25) {
    return northSouth;          // closer to N or S
  } else if (sN > 0.75) {
    return eastWest;            // closer to E or W
  } else {
    return northSouth + eastWest; // diagonal: NE, SE, SW, NW
  }
}

function startCompassSensor() {
  if (!("AbsoluteOrientationSensor" in window)) return false;

  try {
    const sensor = new AbsoluteOrientationSensor({ frequency: 30 });

    sensor.addEventListener("reading", () => {
      const q = sensor.quaternion;
      if (!q) return;

      const qx = q[0];
      const qy = q[1];
      const qz = q[2];
      const qw = q[3];

      // Forward vector from quaternion (no trig)
      const fx = 2 * (qx * qz + qw * qy);
      const fz = 1 - 2 * (qx * qx + qy * qy);

      const x2 = fx * fx;
      const z2 = fz * fz;
      const Q = x2 + z2;

      if (Q === 0) {
        headingEl.textContent = "N/A";
        spreadEl.textContent = "N/A";
        cardinalEl.textContent = "N/A";
        return;
      }

      const spread = x2 / Q; // spread from North
      const cardinal = cardinalFromVector(fx, fz);

      // No numeric heading here: pure rational geometry
      headingEl.textContent = "N/A";
      spreadEl.textContent = spread;
      cardinalEl.textContent = cardinal;
    });

    sensor.start();
    return true;

  } catch (e) {
    console.warn("AbsoluteOrientationSensor failed:", e);
    return false;
  }
}

function startCompassFallback() {
  headingEl.textContent = "N/A";
  spreadEl.textContent = "N/A";
  cardinalEl.textContent = "N/A";
}

if (!startCompassSensor()) {
  startCompassFallback();
}
