// Auto year range: 2026–current year
const startYear = 2026;
const currentYear = new Date().getFullYear();
document.getElementById("year").textContent =
startYear === currentYear ? `${currentYear}` : `${startYear}–${currentYear}`;
