const headingEl = document.getElementById("heading");
const spreadEl = document.getElementById("spread");
const cardinalEl = document.getElementById("cardinal");

// Convert heading degrees → cardinal direction
function cardinalFromHeading(deg) {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// Compute forward vector from quaternion
function forwardFromQuaternion(qx, qy, qz, qw) {
  const fx = 2 * (qx * qz + qw * qy);
  const fy = 2 * (qy * qz - qw * qx);
  const fz = 1 - 2 * (qx * qx + qy * qy);
  return { fx, fy, fz };
}

// Update UI from quaternion
function updateOrientation(q) {
  if (!q) {
    headingEl.textContent = "N/A";
    spreadEl.textContent = "N/A";
    cardinalEl.textContent = "N/A";
    return;
  }

  const [qx, qy, qz, qw] = q;

  // Forward vector
  const { fx, fy, fz } = forwardFromQuaternion(qx, qy, qz, qw);

  // Horizontal projection
  const hx = fx;
  const hz = fz;

  // Heading angle: 0° = North, 90° = East
  let heading = Math.atan2(hx, hz) * 180 / Math.PI;
  if (heading < 0) heading += 360;

  // Spread = sin^2(theta)
  const rad = heading * Math.PI / 180;
  const spread = Math.sin(rad) ** 2;

  const cardinal = cardinalFromHeading(heading);

  headingEl.textContent = heading;
  spreadEl.textContent = spread;
  cardinalEl.textContent = cardinal;
}

// Start sensor
function startOrientation() {
  if (!("AbsoluteOrientationSensor" in window)) {
    updateOrientation(null);
    return;
  }

  try {
    const sensor = new AbsoluteOrientationSensor({ frequency: 30 });

    sensor.addEventListener("reading", () => {
      updateOrientation(sensor.quaternion);
    });

    sensor.start();
  } catch (e) {
    console.warn("AbsoluteOrientationSensor failed:", e);
    updateOrientation(null);
  }
}

startOrientation();
