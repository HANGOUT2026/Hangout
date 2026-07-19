import React, { useState, useEffect } from 'react';
import { CloudSun, Cloud, Sun, CloudRain, CloudLightning, Snowflake, AlertCircle, Loader2 } from 'lucide-react';

const getWeatherDetails = (code) => {
  if (code === 0) return { desc: 'Clear sky', Icon: Sun };
  if (code === 1 || code === 2 || code === 3) return { desc: 'Partly cloudy', Icon: CloudSun };
  if (code === 45 || code === 48) return { desc: 'Fog', Icon: Cloud };
  if (code >= 51 && code <= 67) return { desc: 'Rain', Icon: CloudRain };
  if (code >= 71 && code <= 77) return { desc: 'Snow', Icon: Snowflake };
  if (code >= 80 && code <= 82) return { desc: 'Rain showers', Icon: CloudRain };
  if (code >= 85 && code <= 86) return { desc: 'Snow showers', Icon: Snowflake };
  if (code >= 95 && code <= 99) return { desc: 'Thunderstorm', Icon: CloudLightning };
  return { desc: 'Unknown', Icon: CloudSun };
};

export default function WeatherCard() {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWeather = async (lat, lon) => {
      try {
        const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
        const geoData = await geoRes.json();
        const city = geoData.city || geoData.locality || geoData.principalSubdivision || 'UNKNOWN LOCATION';

        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
        const weatherJson = await weatherRes.json();

        const currentTemp = Math.round(weatherJson?.current?.temperature_2m);
        const minTemp = Math.round(weatherJson?.daily?.temperature_2m_min?.[0]);
        const maxTemp = Math.round(weatherJson?.daily?.temperature_2m_max?.[0]);
        const weatherCode = weatherJson?.current?.weather_code;

        setWeatherData({
          city: city.toUpperCase(),
          currentTemp,
          minTemp,
          maxTemp,
          ...getWeatherDetails(weatherCode)
        });
        setError(null);
        setLoading(false);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        setError('Failed to fetch weather');
        setLoading(false);
      }
    };

    const autoDetect = async () => {
      const fallbackLocation = () => {
        fetchWeather(22.5726, 88.3639); // Kolkata fallback
      };

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => fetchWeather(position.coords.latitude, position.coords.longitude),
          () => fallbackLocation()
        );
      } else {
        fallbackLocation();
      }
    };

    autoDetect();
    
    // Auto-refresh weather data every 15 minutes to keep it up to date at any moment
    const interval = setInterval(autoDetect, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="card neo-raised stat-card" style={{ minHeight: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>
    );
  }

  if (error || !weatherData) {
    return (
      <div className="card neo-raised stat-card" style={{ minHeight: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <AlertCircle className="w-8 h-8 mb-2" style={{ color: 'var(--danger-soft)' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Weather unavailable</p>
      </div>
    );
  }

  const { city, currentTemp, minTemp, maxTemp, desc, Icon } = weatherData;

  return (
    <div className="card neo-raised stat-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '250px' }}>
      <div className="eyebrow" style={{ color: '#7fb8e6', textAlign: 'center' }}>{city}</div>
      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>{desc}</div>
      <div className="weather-icon">
        <Icon style={{ width: '42px', height: '42px', color: '#7fb8e6' }} strokeWidth={1.5} />
      </div>
      <div className="temp">{currentTemp}°</div>
      <div className="minmax" style={{ marginTop: 'auto' }}>
        <div><div className="label">MIN</div><div className="val">{minTemp}°</div></div>
        <div><div className="label">MAX</div><div className="val">{maxTemp}°</div></div>
      </div>
    </div>
  );
}
