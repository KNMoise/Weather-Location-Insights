# Weather & Location Insights

A comprehensive web application that provides weather forecasts, air quality data, and points of interest for any location. This application combines multiple APIs to deliver a rich and meaningful user experience.

## Features

- **Weather Forecast**: 5-day forecast with detailed current weather conditions
- **Air Quality Data**: Air quality metrics from nearby monitoring stations
- **Points of Interest**: Discover interesting places around the searched location
- **Responsive Design**: Works on desktop and mobile devices
- **Error Handling**: Graceful error handling with user-friendly messages

## APIs Used

This application leverages the following APIs:

1. [OpenWeatherMap API](https://openweathermap.org/api) - For weather data and geocoding
2. [OpenAQ API](https://docs.openaq.org/) - For air quality data
3. [OpenTripMap API](https://opentripmap.io/docs) - For points of interest

## Local Setup

### Prerequisites

- A modern web browser
- API keys for OpenWeatherMap and OpenTripMap (both offer free tiers)

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/weather-location-insights.git
   cd weather-location-insights
   ```

2. Create a `config.js` file in the root directory with your API keys:
   ```javascript
   const CONFIG = {
     OPENWEATHER_API_KEY: 'your_openweather_api_key',
     OPENTRIPMAP_API_KEY: 'your_opentripmap_api_key'
   };
   ```

3. Open `index.html` in your web browser or use a local server:
   ```bash
   # Using Python to create a simple HTTP server
   python -m http.server 8000
   ```

4. Access the application at `http://localhost:8000`

## Server Deployment

This application has been deployed to two web servers with a load balancer for high availability.

### Web Server Setup (Web01 and Web02)

1. Install Nginx:
   ```bash
   sudo apt update
   sudo apt install nginx
   ```

2. Create a directory for the application:
   ```bash
   sudo mkdir -p /var/www/weather-app
   ```

3. Copy application files:
   ```bash
   sudo cp -r /path/to/your/local/app/* /var/www/weather-app/
   ```

4. Set proper permissions:
   ```bash
   sudo chown -R www-data:www-data /var/www/weather-app
   ```

5. Configure Nginx:
   ```bash
   sudo nano /etc/nginx/sites-available/weather-app
   ```
   
   Add the following configuration:
   ```
   server {
       listen 80;
       server_name your_server_ip;

       root /var/www/weather-app;
       index index.html;

       location / {
           try_files $uri $uri/ =404;
       }
   }
   ```

6. Enable the site and restart Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/weather-app /etc/nginx/sites-enabled/
   sudo systemctl restart nginx
   ```

### Load Balancer Setup (Lb01)

1. Install HAProxy:
   ```bash
   sudo apt update
   sudo apt install haproxy
   ```

2. Configure HAProxy:
   ```bash
   sudo nano /etc/haproxy/haproxy.cfg
   ```
   
   Add the following configuration:
   ```
   frontend http_front
       bind *:80
       stats uri /haproxy?stats
       default_backend http_back

   backend http_back
       balance roundrobin
       option httpchk GET /
       server web01 web01_ip:80 check
       server web02 web02_ip:80 check
   ```

3. Restart HAProxy:
   ```bash
   sudo systemctl restart haproxy
   ```

4. Access the application through the load balancer IP address.

## Testing Load Balancing

To verify that load balancing is working correctly:

1. Add a small identifier to each server's index.html to distinguish which server is serving the request:
   ```html
   <!-- On Web01 -->
   <footer class="text-center mt-4">
     <small>Served by Web01</small>
   </footer>

   <!-- On Web02 -->
   <footer class="text-center mt-4">
     <small>Served by Web02</small>
   </footer>
   ```

2. Access the application through the load balancer multiple times. You should see requests alternating between Web01 and Web02.

3. You can also check the HAProxy statistics page at `http://load_balancer_ip/haproxy?stats`

## Security Considerations

1. **API Keys**: All API keys are stored in a separate `config.js` file that is not included in the repository. This file is listed in `.gitignore` to prevent accidental commits.

2. **HTTPS**: For production deployment, configure HTTPS on both web servers and the load balancer to encrypt data transmission.

3. **Content Security Policy**: The application includes appropriate Content Security Policy headers to prevent XSS attacks.

## Development Challenges and Solutions

### Challenge 1: API Rate Limiting

**Problem**: OpenWeatherMap and OpenTripMap have rate limits on their free tiers.

**Solution**: Implemented caching for API responses to reduce the number of requests. For OpenTripMap, limited the number of POI details fetched to stay within limits.

### Challenge 2: Asynchronous API Calls

**Problem**: Multiple API calls needed to be coordinated efficiently.

**Solution**: Used Promise.all() to make parallel API requests, significantly improving load times.

### Challenge 3: Responsive Design

**Problem**: The application needed to work well on both desktop and mobile devices.

**Solution**: Used Bootstrap's responsive grid system and added custom media queries to ensure a good user experience across all device sizes.

## Future Enhancements

1. User authentication to save favorite locations
2. Historical weather data visualization
3. Public transportation information
4. Localization support for multiple languages
5. PWA (Progressive Web App) implementation for offline access

## Credits

- Weather data: [OpenWeatherMap](https://openweathermap.org/)
- Air quality data: [OpenAQ](https://openaq.org/)
- Points of interest: [OpenTripMap](https://opentripmap.io/)
- Icons: [Bootstrap Icons](https://icons.getbootstrap.com/)
- UI Framework: [Bootstrap](https://getbootstrap.com/)

## License

This project is licensed under the MIT License - see the LICENSE file for details.