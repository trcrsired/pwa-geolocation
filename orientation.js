const headingEl = document.getElementById("heading");
const spreadEl = document.getElementById("spread");
const cardinalEl = document.getElementById("cardinal");

function cardinalFromHeading(deg) {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  const index = Math.round(deg / 45) % 8;
  return dirs[index];
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

      // Forward vector from quaternion (no sin/cos)
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

      // Rational Trigonometry: spread from North
      const spread = x2 / Q;

      // Heading in degrees, 0–360, from North clockwise
      let heading = Math.atan2(fx, fz) * 180 / Math.PI;
      if (heading < 0) heading = heading + 360;

      const cardinal = cardinalFromHeading(heading);

      headingEl.textContent = heading;
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
