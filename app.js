/**
 * Weather & Location Insights Application
 * 
 * This application provides weather forecasts and location information
 * using free public APIs.
 */

// Global variables
let map;
let currentMarker;

// DOM elements
const mainContent = document.getElementById('main-content');
const loadingContainer = document.getElementById('loading-container');
const errorContainer = document.getElementById('error-container');
const errorMessage = document.getElementById('error-message');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const currentLocationButton = document.getElementById('current-location-button');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Set up event listeners
    searchButton.addEventListener('click', searchLocation);
    currentLocationButton.addEventListener('click', getCurrentLocation);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchLocation();
        }
    });

    // Try to get user's location on page load
    getCurrentLocation();
});

/**
 * Get the user's current location
 */
function getCurrentLocation() {
    if (navigator.geolocation) {
        showLoading();
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                fetchLocationData(latitude, longitude);
            },
            error => {
                console.error('Geolocation error:', error);
                showError('Unable to get your location. Please try searching for a location instead.');
                // Default to a popular location if geolocation fails
                fetchLocationData(40.7128, -74.0060); // New York City
            }
        );
    } else {
        showError('Geolocation is not supported by your browser. Please try searching for a location instead.');
        // Default to a popular location if geolocation is not supported
        fetchLocationData(40.7128, -74.0060); // New York City
    }
}

/**
 * Search for a location based on user input
 */
function searchLocation() {
    const query = searchInput.value.trim();
    if (!query) {
        showError('Please enter a location to search');
        return;
    }

    showLoading();
    // Use OpenCage Geocoding API to convert location name to coordinates
    fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${CONFIG.OPENCAGE_API_KEY}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to geocode location');
            }
            return response.json();
        })
        .then(data => {
            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                const { lat, lng } = result.geometry;
                fetchLocationData(lat, lng, result);
            } else {
                throw new Error('Location not found');
            }
        })
        .catch(error => {
            console.error('Search error:', error);
            showError('Unable to find the location. Please try a different search term.');
        });
}

/**
 * Fetch location data including weather and location details
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @param {object} geocodeResult - Optional geocode result with location details
 */
function fetchLocationData(latitude, longitude, geocodeResult = null) {
    Promise.all([
        fetchWeatherData(latitude, longitude),
        fetchLocationDetails(latitude, longitude, geocodeResult)
    ])
        .then(([weatherData, locationData]) => {
            updateUI(weatherData, locationData);
            initMap(latitude, longitude, locationData.name);
            hideLoading();
            showContent();
        })
        .catch(error => {
            console.error('Data fetch error:', error);
            showError('Unable to fetch data for this location. Please try again later.');
        });
}

/**
 * Fetch weather data from OpenWeatherMap API
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Promise} Weather data promise
 */
function fetchWeatherData(latitude, longitude) {
    return fetch(`https://api.openweathermap.org/data/2.5/onecall?lat=${latitude}&lon=${longitude}&exclude=minutely,hourly&units=metric&appid=${CONFIG.OPENWEATHER_API_KEY}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch weather data');
            }
            return response.json();
        });
}

/**
 * Fetch location details using reverse geocoding
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @param {object} geocodeResult - Optional geocode result with location details
 * @returns {Promise} Location data promise
 */
function fetchLocationDetails(latitude, longitude, geocodeResult = null) {
    if (geocodeResult) {
        return Promise.resolve(processLocationData(geocodeResult));
    }

    return fetch(`https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${CONFIG.OPENCAGE_API_KEY}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch location details');
            }
            return response.json();
        })
        .then(data => {
            if (data.results && data.results.length > 0) {
                return processLocationData(data.results[0]);
            } else {
                throw new Error('Location details not found');
            }
        });
}

/**
 * Process location data from geocoding result
 * @param {object} geocodeData - Geocoding result
 * @returns {object} Processed location data
 */
function processLocationData(geocodeData) {
    const components = geocodeData.components;
    const annotations = geocodeData.annotations || {};
    
    return {
        name: components.city || components.town || components.village || components.county || 'Unknown',
        country: components.country || 'Unknown',
        region: components.state || components.province || components.region || 'Unknown',
        coordinates: {
            latitude: geocodeData.geometry.lat.toFixed(4),
            longitude: geocodeData.geometry.lng.toFixed(4)
        },
        timezone: annotations.timezone?.name || 'Unknown',
        timezoneOffset: annotations.timezone?.offset_string || 'Unknown',
        currency: annotations.currency?.name || 'Unknown',
        currencySymbol: annotations.currency?.symbol || '',
        flag: annotations.flag || '',
        callingCode: annotations.callingcode || '',
        population: 'Data not available' // OpenCage doesn't provide population directly
    };
}

/**
 * Update the UI with weather and location data
 * @param {object} weatherData - Weather data from API
 * @param {object} locationData - Location data from API
 */
function updateUI(weatherData, locationData) {
    updateWeatherSection(weatherData);
    updateLocationSection(locationData, weatherData);
}

/**
 * Update the weather section of the UI
 * @param {object} weatherData - Weather data from API
 */
function updateWeatherSection(weatherData) {
    const current = weatherData.current;
    const daily = weatherData.daily;

    // Update current weather
    document.getElementById('location-name').textContent = document.getElementById('search-input').value || 'Current Location';
    document.getElementById('date-time').textContent = formatDate(current.dt, weatherData.timezone);
    document.getElementById('current-temp').textContent = `${Math.round(current.temp)}°C`;
    document.getElementById('feels-like').textContent = `Feels like: ${Math.round(current.feels_like)}°C`;
    document.getElementById('weather-description').textContent = current.weather[0].description;
    document.getElementById('weather-icon').src = `https://openweathermap.org/img/wn/${current.weather[0].icon}@2x.png`;
    document.getElementById('wind').textContent = `${current.wind_speed} m/s`;
    document.getElementById('humidity').textContent = `${current.humidity}%`;
    document.getElementById('pressure').textContent = `${current.pressure} hPa`;

    // Update forecast
    const forecastContainer = document.getElementById('forecast-container');
    forecastContainer.innerHTML = '';

    // Only show next 5 days
    const forecastDays = daily.slice(1, 6);
    
    forecastDays.forEach(day => {
        const forecastItem = document.createElement('div');
        forecastItem.className = 'forecast-item';
        
        forecastItem.innerHTML = `
            <h4>${formatDay(day.dt, weatherData.timezone)}</h4>
            <img src="https://openweathermap.org/img/wn/${day.weather[0].icon}.png" alt="${day.weather[0].description}">
            <p>${Math.round(day.temp.max)}° / ${Math.round(day.temp.min)}°</p>
            <p>${day.weather[0].description}</p>
        `;
        
        forecastContainer.appendChild(forecastItem);
    });
}

/**
 * Update the location section of the UI
 * @param {object} locationData - Location data from API
 * @param {object} weatherData - Weather data from API
 */
function updateLocationSection(locationData, weatherData) {
    // Update geographic info
    document.getElementById('country').textContent = `Country: ${locationData.country}`;
    document.getElementById('region').textContent = `Region: ${locationData.region}`;
    document.getElementById('coordinates').textContent = `Coordinates: ${locationData.coordinates.latitude}, ${locationData.coordinates.longitude}`;
    
    // Update timezone info
    document.getElementById('timezone').textContent = `Timezone: ${locationData.timezone} (${locationData.timezoneOffset})`;
    document.getElementById('local-time').textContent = `Current Time: ${formatTime(Date.now() / 1000, weatherData.timezone)}`;
    
    // Update sun schedule
    document.getElementById('sunrise').textContent = `Sunrise: ${formatTime(weatherData.current.sunrise, weatherData.timezone)}`;
    document.getElementById('sunset').textContent = `Sunset: ${formatTime(weatherData.current.sunset, weatherData.timezone)}`;
    
    // Update additional info
    document.getElementById('currency').textContent = `Currency: ${locationData.currency} ${locationData.currencySymbol}`;
    document.getElementById('population').textContent = `Population: ${locationData.population}`;
}

/**
 * Initialize the map with the given coordinates
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @param {string} locationName - Name of the location
 */
function initMap(latitude, longitude, locationName) {
    const mapContainer = document.getElementById('map-container');
    
    // If map already exists, just update the marker
    if (map) {
        if (currentMarker) {
            map.removeLayer(currentMarker);
        }
        map.setView([latitude, longitude], 10);
        currentMarker = L.marker([latitude, longitude]).addTo(map);
        currentMarker.bindPopup(`<b>${locationName}</b>`).openPopup();
        return;
    }
    
    // Initialize the map
    map = L.map('map-container').setView([latitude, longitude], 10);
    
    // Add the tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Add a marker for the location
    currentMarker = L.marker([latitude, longitude]).addTo(map);
    currentMarker.bindPopup(`<b>${locationName}</b>`).openPopup();
}

/**
 * Format a Unix timestamp to a date string
 * @param {number} timestamp - Unix timestamp
 * @param {string} timezone - Timezone string
 * @returns {string} Formatted date string
 */
function formatDate(timestamp, timezone) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: timezone
    });
}

/**
 * Format a Unix timestamp to a day string
 * @param {number} timestamp - Unix timestamp
 * @param {string} timezone - Timezone string
 * @returns {string} Formatted day string
 */
function formatDay(timestamp, timezone) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', { 
        weekday: 'short',
        timeZone: timezone
    });
}

/**
 * Format a Unix timestamp to a time string
 * @param {number} timestamp - Unix timestamp
 * @param {string} timezone - Timezone string
 * @returns {string} Formatted time string
 */
function formatTime(timestamp, timezone) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: timezone
    });
}

/**
 * Show the loading container
 */
function showLoading() {
    loadingContainer.style.display = 'block';
    errorContainer.style.display = 'none';
    mainContent.classList.add('hidden');
}

/**
 * Hide the loading container
 */
function hideLoading() {
    loadingContainer.style.display = 'none';
}

/**
 * Show the main content
 */
function showContent() {
    mainContent.classList.remove('hidden');
}

/**
 * Show an error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    loadingContainer.style.display = 'none';
    errorContainer.style.display = 'block';
    mainContent.classList.add('hidden');
    errorMessage.textContent = message;
}