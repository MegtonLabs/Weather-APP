const apiKey = '485834f1002ad54b0b7b16f8ca08bbed'; // Your OpenWeather API key
        const searchButton = document.getElementById('search-button');
        const cityInput = document.getElementById('city-input');
        const currentLocationButton = document.getElementById('current-location-button');
        const weatherInfo = document.getElementById('weather-info');
        const themeToggle = document.getElementById('theme-toggle');

        // Theme Toggle
        let isDark = false;
        themeToggle.addEventListener('click', () => {
            isDark = !isDark;
            document.body.classList.toggle('dark', isDark);
            themeToggle.textContent = isDark ? '🌙' : '☀️';
        });

        // Search Event Listeners
        searchButton.addEventListener('click', searchWeather);
        cityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchWeather();
            }
        });

        // Debounce function to prevent rapid clicks
        function debounce(func, wait) {
            let timeout;
            return function (...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }

        // Handle current location with debounce
        const handleCurrentLocation = debounce(() => {
            if (navigator.geolocation) {
                displayLoading(); // Show loading spinner immediately
                navigator.geolocation.getCurrentPosition(
                    pos => {
                        const lat = pos.coords.latitude;
                        const lon = pos.coords.longitude;
                        if (lat !== undefined && lon !== undefined) {
                            // Fetch weather first, then update with location name
                            fetchWeather(lat, lon, 'Current Location');
                            getLocationName(lat, lon)
                                .then(locationName => {
                                    if (locationName) {
                                        fetchWeather(lat, lon, locationName); // Update with actual name
                                    }
                                })
                                .catch(err => console.error('Location name fetch failed:', err));
                        } else {
                            displayError('Invalid location data received.');
                        }
                    },
                    err => {
                        console.log('Geolocation error:', err); // Debug log
                        let errorMessage = 'Unable to get location';
                        if (err.code === 1) {
                            errorMessage = 'Location permission denied. Please allow location access in your browser settings.';
                        } else if (err.code === 2) {
                            errorMessage = 'Location unavailable. Ensure location services are enabled and try again.';
                        } else if (err.code === 3) {
                            errorMessage = 'Location request timed out. Please try again.';
                        }
                        displayError(errorMessage);
                    },
                    { timeout: 10000, maximumAge: 0, enableHighAccuracy: false } // Adjusted timeout
                );
            } else {
                displayError('Geolocation not supported by your browser.');
                currentLocationButton.disabled = true;
            }
        }, 500); // 500ms debounce delay

        currentLocationButton.addEventListener('click', handleCurrentLocation);

        // Search Function
        function searchWeather() {
            const cityName = cityInput.value.trim();
            if (cityName) {
                getCoordinates(cityName)
                    .then(coords => coords ? fetchWeather(coords[1], coords[0], cityName) : displayError('City not found'))
                    .catch(err => displayError(`Error: ${err.message}`));
            } else {
                displayError('Please enter a city name');
            }
        }

        // Fetch Coordinates (using Nominatim)
        async function getCoordinates(cityName) {
            displayLoading();
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}`;
            try {
                const response = await fetch(url, { headers: { 'User-Agent': 'WeatherApp/1.0' } });
                if (!response.ok) throw new Error(`Failed to fetch coordinates: ${response.status}`);
                const data = await response.json();
                return data.length > 0 ? [data[0].lon, data[0].lat] : null;
            } catch (error) {
                throw error;
            }
        }

        // Reverse Geocode Coordinates to Location Name (using Nominatim)
        async function getLocationName(lat, lon) {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`;
            try {
                const response = await fetch(url, { headers: { 'User-Agent': 'WeatherApp/1.0' } });
                if (!response.ok) throw new Error(`Failed to fetch location name: ${response.status}`);
                const data = await response.json();
                return data.address.city || data.address.town || data.address.village || data.display_name.split(',')[0] || null;
            } catch (error) {
                console.error('Reverse Geocode Error:', error);
                return null; // Silent fallback, no error shown to user
            }
        }

        // Fetch Weather Data (using OpenWeather Current and Forecast APIs)
        async function fetchWeather(lat, lon, location) {
            displayLoading();
            const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;

            try {
                // Fetch current weather
                const currentResponse = await fetch(currentUrl);
                if (!currentResponse.ok) {
                    const errorText = await currentResponse.text();
                    throw new Error(`Failed to fetch current weather: ${response.status} - ${errorText}`);
                }
                const currentData = await currentResponse.json();

                // Fetch hourly forecast
                const forecastResponse = await fetch(forecastUrl);
                if (!forecastResponse.ok) {
                    const errorText = await forecastResponse.text();
                    throw new Error(`Failed to fetch forecast: ${forecastResponse.status} - ${errorText}`);
                }
                const forecastData = await forecastResponse.json();

                displayWeather(currentData, forecastData, location);
            } catch (error) {
                console.error('Weather Fetch Error:', error);
                displayError(`Error fetching weather: ${error.message}`);
            }
        }

        // Display Weather
        function displayWeather(currentData, forecastData, location) {
            const weatherIcon = `http://openweathermap.org/img/wn/${currentData.weather[0].icon}.png`;
            const currentHTML = `
                <div class="current-weather">
                    <h2>${location}</h2>
                    <div class="temp">${Math.round(currentData.main.temp)}°C</div>
                    <div class="condition"><img src="${weatherIcon}" alt="${currentData.weather[0].description}"> ${currentData.weather[0].description}</div>
                    <div class="details">Wind: ${Math.round(currentData.wind.speed * 3.6)} km/h</div>
                </div>
            `;

            let hourlyHTML = '<div class="hourly-forecast"><h3>Hourly Forecast</h3><ul>';
            for (let i = 0; i < 5; i++) {
                const time = new Date(forecastData.list[i].dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                hourlyHTML += `<li>${time}<br>${Math.round(forecastData.list[i].main.temp)}°C</li>`;
            }
            hourlyHTML += '</ul></div>';

            weatherInfo.innerHTML = currentHTML + hourlyHTML;
            weatherInfo.classList.remove('loading');
            weatherInfo.classList.add('visible');
        }

        // Loading and Error States
        function displayLoading() {
            weatherInfo.innerHTML = '';
            weatherInfo.classList.add('loading');
            weatherInfo.classList.remove('visible');
        }

        function displayError(message) {
            weatherInfo.innerHTML = `<p style="color: #d32f2f;">${message}</p>`;
            weatherInfo.classList.remove('loading');
            weatherInfo.classList.add('visible');
        }