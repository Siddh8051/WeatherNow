// ⚡ OpenWeatherMap API key
const API_KEY = "cb670952d54a518693dd1fe053fa765f";

// DOM Elements
const cityNameEl = document.getElementById("cityName");
const weatherDetailsEl = document.getElementById("weatherDetails");
const forecastEl = document.getElementById("forecast");
const dailyForecastEl = document.getElementById("dailyForecast");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const locBtn = document.getElementById("locBtn");
const timeSlider = document.getElementById("timeSlider");
const timeLabel = document.getElementById("timeLabel");

// 🌍 Initialize Map
const map = L.map("map").setView([28.6139, 77.2090], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
}).addTo(map);

// Weather overlays
const overlays = {};
L.control.layers(null, overlays).addTo(map);
function addOverlay(name, url) {
  overlays[name] = L.tileLayer(url, { opacity: 0.6 });
}
addOverlay("🌧 Precipitation", `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${API_KEY}`);
addOverlay("🌡 Temperature", `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${API_KEY}`);
addOverlay("☁ Clouds", `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${API_KEY}`);
addOverlay("💨 Wind", `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${API_KEY}`);

let marker;
let hourlyData = [];
let lastCoords = [28.6139, 77.2090]; // Default coords
const STORAGE_KEY = "lastLocation";

// 📌 Reverse Geocoding → Get City Name
async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`
    );
    const data = await res.json();
    if (data.length > 0) {
      return data[0].name;
    }
  } catch (e) {
    console.error("Reverse geocoding failed", e);
  }
  return `Lat:${lat.toFixed(2)}, Lon:${lon.toFixed(2)}`;
}

// 📌 Fetch Weather + Forecast
async function fetchWeather(lat, lon, city = "") {
  try {
    lastCoords = [lat, lon];

    // Current weather
    const curRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
    );
    const curData = await curRes.json();

    // Use API-provided city name (more precise)
    city = curData.name || city || `Lat:${lat.toFixed(2)}, Lon:${lon.toFixed(2)}`;

    cityNameEl.textContent = city;

    // Forecast fetch same as before...


    // Forecast (3-hourly for 5 days)
    const fcRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
    );
    const fcData = await fcRes.json();

    // Save hourly for timeline (first 8 → 24h)
    hourlyData = fcData.list.slice(0, 8);

    // If no city name provided, reverse geocode it
    if (!city) {
      city = await reverseGeocode(lat, lon);
    }

    // Current display
    cityNameEl.textContent = city || curData.name;
    weatherDetailsEl.innerHTML = `
      <p><strong>${curData.main.temp}°C</strong> (feels like ${curData.main.feels_like}°C)</p>
      <p>${curData.weather[0].description}</p>
      <p>💧 Humidity: ${curData.main.humidity}%</p>
      <p>🌬 Wind: ${curData.wind.speed} m/s</p>
      <p>☁ Clouds: ${curData.clouds.all}%</p>
      <p>📊 Pressure: ${curData.main.pressure} hPa</p>
      <p>🌅 Sunrise: ${new Date(curData.sys.sunrise * 1000).toLocaleTimeString()}</p>
      <p>🌇 Sunset: ${new Date(curData.sys.sunset * 1000).toLocaleTimeString()}</p>
    `;

    if (marker) map.removeLayer(marker);
    marker = L.marker(lastCoords)
      .addTo(map)
      .bindPopup(`${city}: ${curData.main.temp}°C`)
      .openPopup();

    // 24h Forecast
    forecastEl.innerHTML = "";
    hourlyData.forEach((f) => {
      const time = new Date(f.dt * 1000).toLocaleTimeString([], { hour: "2-digit" });
      const item = document.createElement("div");
      item.className = "forecast-item";
      item.innerHTML = `
        <p>${time}</p>
        <img src="https://openweathermap.org/img/wn/${f.weather[0].icon}.png" alt="">
        <p>${f.main.temp}°C</p>
      `;
      forecastEl.appendChild(item);
    });

    // 5-Day Forecast (aggregate)
    const daily = aggregateForecast(fcData.list);
    dailyForecastEl.innerHTML = "";
    daily.forEach((d) => {
      const item = document.createElement("div");
      item.className = "daily-item";
      item.innerHTML = `
        <p>${d.day}</p>
        <img src="${d.icon}" alt="">
        <p>${d.tempMin}°C / ${d.tempMax}°C</p>
        <p>${d.desc}</p>
      `;
      dailyForecastEl.appendChild(item);
    });

    updateTimeline(0);
  } catch (err) {
    console.error("Weather fetch failed", err);
    weatherDetailsEl.textContent = "Failed to fetch weather data.";
  }
}

// 📌 Aggregate forecast into daily (min/max)
function aggregateForecast(list) {
  const groups = {};
  list.forEach((item) => {
    const d = new Date(item.dt * 1000);
    const key = d.toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  return Object.keys(groups)
    .slice(0, 5)
    .map((date) => {
      const arr = groups[date];
      let tempMin = Infinity, tempMax = -Infinity;
      arr.forEach((it) => {
        tempMin = Math.min(tempMin, it.main.temp_min);
        tempMax = Math.max(tempMax, it.main.temp_max);
      });
      const midday = arr[Math.floor(arr.length / 2)];
      return {
        day: new Date(date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
        tempMin: Math.round(tempMin),
        tempMax: Math.round(tempMax),
        icon: `https://openweathermap.org/img/wn/${midday.weather[0].icon}.png`,
        desc: midday.weather[0].description,
      };
    });
}

// 📌 Timeline update
function updateTimeline(hourIndex) {
  const entry = hourlyData[hourIndex];
  if (!entry) return;
  const date = new Date(entry.dt * 1000);
  timeLabel.textContent = hourIndex === 0 ? "Now" : date.toLocaleTimeString([], { hour: "2-digit" });

  weatherDetailsEl.innerHTML = `
    <p><strong>${entry.main.temp}°C</strong></p>
    <p>${entry.weather[0].description}</p>
    <p>💧 Humidity: ${entry.main.humidity}%</p>
    <p>🌬 Wind: ${entry.wind.speed} m/s</p>
    <p>☁ Clouds: ${entry.clouds.all}%</p>
    <p>📊 Pressure: ${entry.main.pressure} hPa</p>
  `;

  if (marker) map.removeLayer(marker);
  marker = L.marker(lastCoords)
    .addTo(map)
    .bindPopup(`Forecast: ${entry.main.temp}°C at ${timeLabel.textContent}`)
    .openPopup();
}

// 📌 Search City
async function searchCity(city) {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${API_KEY}`
    );
    const data = await res.json();
    if (!data.length) return alert("City not found!");
    const { lat, lon, name } = data[0];
    map.setView([lat, lon], 8);
    fetchWeather(lat, lon, name);
  } catch (err) {
    console.error("City search failed", err);
  }
}

searchBtn.addEventListener("click", () => {
  const city = searchInput.value.trim();
  if (city) searchCity(city);
});

timeSlider.addEventListener("input", (e) => updateTimeline(parseInt(e.target.value)));

// 📌 Use My Location (with high accuracy)
locBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocation not supported by your browser.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 10);
      fetchWeather(latitude, longitude);
    },
    () => {
      alert("Location permission denied. Using New Delhi as default.");
      fetchWeather(28.6139, 77.2090, "New Delhi");
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
});

// 📌 Map Click → Fetch weather
map.on("click", (e) => {
  const { lat, lng } = e.latlng;
  fetchWeather(lat, lng);
});

(function init() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 10);
        fetchWeather(latitude, longitude);  // uses precise coords
      },
      () => {
        console.warn("Location denied → falling back to New Delhi");
        fetchWeather(28.6139, 77.2090, "New Delhi");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  } else {
    fetchWeather(28.6139, 77.2090, "New Delhi");
  }
})();

