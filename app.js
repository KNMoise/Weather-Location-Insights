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

    // Add event listeners for popular searches
    document.querySelectorAll('.popular-searches .btn').forEach(button => {
        button.addEventListener('click', function() {
            searchInput.value = this.textContent.trim();
            searchLocation();
        });
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
                throw new Error(`Failed to geocode location: ${response.status}`);
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
async function fetchLocationData(latitude, longitude, geocodeResult = null) {
    try {
        // Retry logic for API calls
        const retryFetch = async (fetchFunction, retries = 3) => {
            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    return await fetchFunction();
                } catch (error) {
                    if (attempt === retries - 1) throw error;
                }
            }
        };

        // Fetch weather and location data in parallel
        const [weatherData, locationData] = await Promise.all([
            retryFetch(() => fetchWeatherData(latitude, longitude)),
            retryFetch(() => fetchLocationDetails(latitude, longitude, geocodeResult))
        ]);

        // Update the UI with the fetched data
        updateUI(weatherData, locationData);
        initMap(latitude, longitude, locationData.name);
        hideLoading();
        showContent();
    } catch (error) {
        console.error('Data fetch error:', error);

        // Show specific error messages based on the error type
        if (error.message.includes('Failed to fetch weather data')) {
            showError('Unable to fetch weather data. Please check your API key or try again later.');
        } else if (error.message.includes('Failed to fetch location details')) {
            showError('Unable to fetch location details. Please check your API key or try again later.');
        } else {
            showError('Unable to fetch data for this location. Please try again later.');
        }
    }
}

/**
 * Fetch weather data from OpenWeatherMap API
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Promise} Weather data promise
 */
function fetchWeatherData(latitude, longitude) {
    return fetch(`https://api.openweathermap.org/data/2.5/onecall?lat=${latitude}&lon=${longitude}&exclude=minutely&units=metric&appid=${CONFIG.OPENWEATHER_API_KEY}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch weather data: ${response.status}`);
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
                throw new Error(`Failed to fetch location details: ${response.status}`);
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
        population: 'Data not available' 
    };
}

/**
 * Update the UI with weather and location data
 * @param {object} weatherData - Weather data from API
 * @param {object} locationData - Location data from API
 */
function updateUI(weatherData, locationData) {
    updateWeatherSection(weatherData, locationData);
    updateLocationSection(locationData, weatherData);
    updateHourlyForecast(weatherData);
    createForecastChart(weatherData);
}

/**
 * Update the weather section of the UI
 * @param {object} weatherData - Weather data from API
 * @param {object} locationData - Location data from API
 */
function updateWeatherSection(weatherData, locationData) {
    const current = weatherData.current;
    const daily = weatherData.daily;

    // Update current weather
    document.getElementById('location-name').textContent = locationData.name;
    document.getElementById('date-time').textContent = formatDate(current.dt, weatherData.timezone);
    document.getElementById('current-temp').textContent = `${Math.round(current.temp)}°C`;
    document.getElementById('feels-like').textContent = `Feels like: ${Math.round(current.feels_like)}°C`;
    document.getElementById('weather-description').textContent = current.weather[0].description;
    document.getElementById('weather-icon').src = `https://openweathermap.org/img/wn/${current.weather[0].icon}@2x.png`;
    document.getElementById('wind').textContent = `${current.wind_speed} m/s`;
    document.getElementById('humidity').textContent = `${current.humidity}%`;
    document.getElementById('pressure').textContent = `${current.pressure} hPa`;
    document.getElementById('visibility').textContent = `${(current.visibility / 1000).toFixed(1)} km`;

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
    
    // Update sun progress bar
    updateSunProgressBar(current.dt, current.sunrise, current.sunset);
}

/**
 * Update the hourly forecast section
 * @param {object} weatherData - Weather data from API
 */
function updateHourlyForecast(weatherData) {
    const hourlyContainer = document.getElementById('hourly-forecast-container');
    hourlyContainer.innerHTML = '';
    
    // Display the next 24 hours (24 data points)
    const hourlyData = weatherData.hourly.slice(0, 24);
    
    hourlyData.forEach((hour, index) => {
        if (index % 3 === 0) { // Show every 3 hours to avoid overcrowding
            const hourlyItem = document.createElement('div');
            hourlyItem.className = 'hourly-item';
            
            const hourTime = formatTime(hour.dt, weatherData.timezone, { hour: '2-digit' });
            
            hourlyItem.innerHTML = `
                <p>${hourTime}</p>
                <img src="https://openweathermap.org/img/wn/${hour.weather[0].icon}.png" alt="${hour.weather[0].description}">
                <p>${Math.round(hour.temp)}°</p>
            `;
            
            hourlyContainer.appendChild(hourlyItem);
        }
    });
}

/**
 * Create forecast chart using Chart.js
 * @param {object} weatherData - Weather data from API
 */
function createForecastChart(weatherData) {
    const ctx = document.getElementById('forecast-chart');
    
    // Destroy existing chart if it exists
    if (window.forecastChart) {
        window.forecastChart.destroy();
    }
    
    const daily = weatherData.daily.slice(0, 7);
    const labels = daily.map(day => formatDay(day.dt, weatherData.timezone));
    const maxTemps = daily.map(day => Math.round(day.temp.max));
    const minTemps = daily.map(day => Math.round(day.temp.min));
    
    window.forecastChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Max Temperature (°C)',
                    data: maxTemps,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.4
                },
                {
                    label: 'Min Temperature (°C)',
                    data: minTemps,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Temperature Forecast (7 Days)'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                }
            }
        }
    });
}

/**
 * Update sun progress bar based on current time
 * @param {number} currentTime - Current Unix timestamp
 * @param {number} sunriseTime - Sunrise Unix timestamp
 * @param {number} sunsetTime - Sunset Unix timestamp
 */
function updateSunProgressBar(currentTime, sunriseTime, sunsetTime) {
    const sunProgress = document.getElementById('sun-progress');
    const dayLength = sunsetTime - sunriseTime;
    const timeSinceSunrise = currentTime - sunriseTime;
    
    // Calculate progress percentage
    let progressPercent;
    if (currentTime < sunriseTime) {
        // Before sunrise
        progressPercent = 0;
    } else if (currentTime > sunsetTime) {
        // After sunset
        progressPercent = 100;
    } else {
        // During day
        progressPercent = (timeSinceSunrise / dayLength) * 100;
    }
    
    // Update progress bar
    sunProgress.style.width = `${progressPercent}%`;
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
    
    // Update language if element exists
    const languageElement = document.getElementById('language');
    if (languageElement) {
        languageElement.textContent = `Language: ${locationData.components?.language || 'Data not available'}`;
    }
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
    
    // Add map control buttons for different views
    document.querySelectorAll('.btn-group .btn-outline-primary').forEach(button => {
        button.addEventListener('click', function() {
            const view = this.textContent.trim().toLowerCase();
            
            // Remove active class from all buttons
            document.querySelectorAll('.btn-group .btn-outline-primary').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Change map tile layer based on view
            if (view === 'satellite') {
                map.eachLayer(layer => {
                    if (layer !== currentMarker) {
                        map.removeLayer(layer);
                    }
                });
                
                L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                }).addTo(map);
            } else {
                map.eachLayer(layer => {
                    if (layer !== currentMarker) {
                        map.removeLayer(layer);
                    }
                });
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(map);
            }
        });
    });
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
 * @param {object} options - Additional formatting options
 * @returns {string} Formatted time string
 */
function formatTime(timestamp, timezone, options = {}) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: timezone,
        ...options
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

// Event listener for the "More Insights" button
document.addEventListener('DOMContentLoaded', () => {
    const showMoreInsightsButton = document.getElementById('show-more-insights');
    if (showMoreInsightsButton) {
        showMoreInsightsButton.addEventListener('click', () => {
            // This would typically show a modal or expand the insights section
            // For now, just show an alert
            alert('More location insights functionality coming soon!');
        });
    }
});