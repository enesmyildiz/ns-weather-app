/* Weather App – Open‑Meteo (no API key) */
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const $ = (sel) => document.querySelector(sel);
const currentEl = $("#current");
const gridEl = $("#forecast-grid");
const inputEl = $("#city-input");
const btnEl = $("#search-btn");

btnEl.addEventListener("click", () => searchCity());
inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") searchCity(); });

function searchCity(){
  const q = inputEl.value.trim();
  if(!q){ return; }
  geocode(q).then(loc => {
    if(!loc){ 
      currentEl.innerHTML = `<div class="placeholder">City not found.</div>`;
      gridEl.innerHTML = "";
      return;
    }
    fetchForecast(loc);
  }).catch(() => {
    currentEl.innerHTML = `<div class="placeholder">Geocoding error.</div>`;
    gridEl.innerHTML = "";
  });
}

async function geocode(name){
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if(!res.ok) throw new Error("geocode failed");
  const data = await res.json();
  if(!data.results || data.results.length === 0) return null;
  const r = data.results[0];
  return {
    name: r.name,
    country: r.country_code || r.country || "",
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone || "auto"
  };
}

async function fetchForecast(loc){
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    current_weather: "true",
    hourly: "relative_humidity_2m",
    daily: "temperature_2m_max,temperature_2m_min,weathercode",
    timezone: "auto",
    wind_speed_unit: "ms",
    forecast_days: "4"
  });
  const url = `${FORECAST_URL}?${params.toString()}`;
  const res = await fetch(url);
  if(!res.ok){
    currentEl.innerHTML = `<div class="placeholder">Forecast not available.</div>`;
    gridEl.innerHTML = "";
    return;
  }
  const data = await res.json();
  renderCurrent(loc, data);
  renderForecast(data);
}

function renderCurrent(loc, d){
  const cw = d.current_weather || {};
  const temp = Math.round(cw.temperature);
  const wind = Math.round(cw.windspeed);
  const code = typeof cw.weathercode === "number" ? cw.weathercode : 3;
  const {label, icon} = codeToInfo(code);

  // humidity: find current hour index
  let humidity = "—";
  try{
    const tNow = cw.time; // ISO string aligned to timezone=auto
    const idx = (d.hourly.time || []).indexOf(tNow);
    if(idx !== -1 && d.hourly.relative_humidity_2m && d.hourly.relative_humidity_2m[idx] != null){
      humidity = `${d.hourly.relative_humidity_2m[idx]}%`;
    }
  }catch(_){}

  const city = `${loc.name}${loc.country ? ", " + loc.country : ""}`;

  currentEl.innerHTML = `
    <div class="row">
      <div class="left">
        <img src="${icon}" alt="${label}" width="56" height="56" />
        <div>
          <div class="temp">${isFinite(temp) ? temp : "—"}°C</div>
          <div class="city">${city}</div>
        </div>
      </div>
      <div class="right">
        <div class="badge">
          <img src="${icon}" alt="${label}" />
          <span>${label}</span>
        </div>
        <div class="badge">Humidity <strong>${humidity}</strong></div>
        <div class="badge">Wind <strong>${isFinite(wind) ? wind : "—"} m/s</strong></div>
      </div>
    </div>
  `;
}

function renderForecast(d){
  const daily = d.daily || {};
  if(!daily.time){ gridEl.innerHTML = ""; return; }

  // Skip index 0 (today), take next 3
  gridEl.innerHTML = "";
  for(let i=1; i<=3 && i<daily.time.length; i++){
    const dateISO = daily.time[i];
    const min = Math.round(daily.temperature_2m_min[i]);
    const max = Math.round(daily.temperature_2m_max[i]);
    const code = daily.weathercode[i];
    const {label, icon} = codeToInfo(code);
    const dayName = new Date(dateISO).toLocaleDateString(undefined,{weekday:"short", month:"short", day:"numeric"});

    const div = document.createElement("div");
    div.className = "day";
    div.innerHTML = `
      <div class="date">${dayName}</div>
      <img src="${icon}" alt="${label}" />
      <div class="t"><span class="min">${min}°</span> / <span class="max">${max}°</span></div>
      <div class="w">${label}</div>
    `;
    gridEl.appendChild(div);
  }
}

function codeToInfo(code){
  // Open‑Meteo weather codes mapping
  const groups = [
    {codes:[0], label:"Clear sky", icon:"icons/sun.svg"},
    {codes:[1,2,3], label:"Cloudy", icon:"icons/cloud.svg"},
    {codes:[45,48], label:"Fog", icon:"icons/mist.svg"},
    {codes:[51,53,55,56,57], label:"Drizzle", icon:"icons/drizzle.svg"},
    {codes:[61,63,65,66,67,80,81,82], label:"Rain", icon:"icons/rain.svg"},
    {codes:[71,73,75,77,85,86], label:"Snow", icon:"icons/snow.svg"},
    {codes:[95,96,99], label:"Thunderstorm", icon:"icons/thunder.svg"},
  ];
  for(const g of groups){
    if(g.codes.includes(Number(code))) return {label:g.label, icon:g.icon};
  }
  return {label:"Cloudy", icon:"icons/cloud.svg"};
}

// Optional: Prefill with a default city for demo
window.addEventListener("load", () => {
  if(!inputEl.value) inputEl.value = "Istanbul";
  searchCity();
});
