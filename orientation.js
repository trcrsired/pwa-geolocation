const headingEl = document.getElementById("heading");
const spreadEl = document.getElementById("spread");
const cardinalEl = document.getElementById("cardinal");

function cardinalFromHeading(deg) {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
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

      // Extract yaw (horizontal plane)
      const siny = 2 * (qw * qz + qx * qy);
      const cosy = 1 - 2 * (qy * qy + qz * qz);

      // Heading in degrees
      let heading = Math.atan2(siny, cosy) * 180 / Math.PI;
      if (heading < 0) heading += 360;

      // Spread from North (pure rational trig)
      const x2 = siny * siny;
      const y2 = cosy * cosy;
      const spread = x2 / (x2 + y2);

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
