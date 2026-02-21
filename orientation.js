const headingEl = document.getElementById("heading");
const spreadEl = document.getElementById("spread");
const cardinalEl = document.getElementById("cardinal");

function forwardFromQuaternion(qx, qy, qz, qw) {
  const fx = 2 * (qx * qz + qw * qy);
  const fy = 2 * (qy * qz - qw * qx);
  const fz = 1 - 2 * (qx * qx + qy * qy);
  return { fx, fy, fz };
}

function horizontalFromForward(fx, fz) {
  return { hx: fx, hz: fz };
}

function spreadFromHorizontal(hx, hz) {
  const Qh = hx * hx + hz * hz;
  if (Qh === 0) return null;
  const dot = hz;
  return 1 - (dot * dot) / Qh;
}

function cardinalFromHorizontal(hx, hz) {
  const Qx = hx * hx;
  const Qz = hz * hz;

  if (Qx === 0 && Qz === 0) return "N/A";

  const xPos = hx >= 0;
  const zPos = hz >= 0;

  if (Qz > Qx) {
    if (Qx * 3 < Qz) return zPos ? "N" : "S";
    return zPos ? (xPos ? "NE" : "NW") : (xPos ? "SE" : "SW");
  } else {
    if (Qz * 3 < Qx) return xPos ? "E" : "W";
    return xPos ? (zPos ? "NE" : "SE") : (zPos ? "NW" : "SW");
  }
}

function updateOrientation(q) {
  if (!q) {
    headingEl.textContent = "N/A";
    spreadEl.textContent = "N/A";
    cardinalEl.textContent = "N/A";
    return;
  }

  const [qx, qy, qz, qw] = q;

  const { fx, fy, fz } = forwardFromQuaternion(qx, qy, qz, qw);
  const { hx, hz } = horizontalFromForward(fx, fz);

  const spread = spreadFromHorizontal(hx, hz);
  const cardinal = cardinalFromHorizontal(hx, hz);

  headingEl.textContent = `hx=${hx}, hz=${hz}`;
  spreadEl.textContent = spread;
  cardinalEl.textContent = cardinal;
}

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
