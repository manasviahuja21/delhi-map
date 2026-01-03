import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './PollutionMap.css'
// --- CSS STYLES ---
const styles = `
  /* 1. Reset & Background */
  body { margin: 0; background: #000; overflow: hidden; }

  /* 2. Visual Effects */
  .scanlines {
    background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1));
    background-size: 100% 4px;
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 10;
  }
  .vignette {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none;
    background: radial-gradient(circle, rgba(0,0,0,0) 60%, rgba(0,0,0,0.85) 100%);
    z-index: 9;
  }

  /* 3. Cyber Tooltip */
  .cyber-tooltip {
    background-color: rgba(0, 0, 0, 0.9);
    border: 1px solid #00ffff;
    border-left: 3px solid #00ffff;
    color: #fff;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    padding: 5px 10px;
    box-shadow: 0 0 10px rgba(0,255,255,0.4);
  }
  .leaflet-tooltip-top:before, .leaflet-tooltip-bottom:before, 
  .leaflet-tooltip-left:before, .leaflet-tooltip-right:before {
    display: none !important;
  }
`;

const DELHI_BOUNDS = [[28.20, 76.60], [29.10, 77.80]];
// [REPLACE YOUR EXISTING MOCK_DATA WITH THIS]
const MOCK_DATA = (id) => {
  const air = Math.floor(Math.random() * 400 + 50);    // 0-500 AQI
  const water = Math.floor(Math.random() * 100 + 10);  // 0-100 WQI
  const soil = Math.floor(Math.random() * 300 + 50);   // 0-350 Soil Index

  // COMPOSITE HEALTH FORMULA
  // This single number decides the color of the ward
  const toxicityScore = Math.floor((air * 0.5) + (water * 3) + (soil * 0.2)); 
  
  return { air, water, soil, toxicityScore };
};

const PollutionMap = () => {
  const [activeMetric, setActiveMetric] = useState('air');
  const [mapData, setMapData] = useState(null);
  const [selectedWard, setSelectedWard] = useState(null);

// [REPLACE YOUR EXISTING useEffect WITH THIS]
useEffect(() => {
    fetch('/delhi_combined2.geojson')
      .then(res => res.json())
      .then(data => {
        const enriched = data.features.map((f, i) => {
          const props = f.properties;
          
          // 1. Identify Type
          const isWater = props.isRiver || props.natural === 'water';
          props.type = isWater ? 'water' : 'land';

          // 2. Identify ID (Robust Check)
          props.id = props.Ward_Name || props.name || props.NAME || props.Ward_No || `#`;

          // 3. Generate The Integrated Stats
          props.stats = MOCK_DATA(i);
          
          return f;
        });
        setMapData({ ...data, features: enriched });
      });
}, []);
  const onEachFeature = (feature, layer) => {
    
    // --- 1. THE NEW CHECK ---
    // If the ID is just a placeholder '#', stop here. No tooltip.
    if (feature.properties.id === '#') return; 


    // --- 2. EXISTING LOGIC (Runs only if ID is valid) ---
    const isWater = feature.properties.type === 'water';
    const labelTitle = isWater ? 'WATER BODY' : 'SECTOR';
    const labelColor = isWater ? '#00ffff' : '#00ff9d';

    const tooltipHTML = `
      <div style="text-align: center;">
        <span style="color: ${labelColor}; font-size: 10px; letter-spacing: 1px;">
          ${labelTitle}
        </span>
        <br/>
        <strong style="font-size:14px; text-transform: uppercase;">
          ${feature.properties.id} 
        </strong>
      </div>
    `;

    layer.bindTooltip(tooltipHTML, {
      sticky: true,
      className: 'cyber-tooltip',
      direction: 'top',
      opacity: 1
    });

    // ... click handlers ...
    layer.on({
      click: () => {
        if (!isWater) setSelectedWard(feature.properties);
      }
    });
  };

 // --- LAYER 1: GROUND (Vibrant Territories) ---
// Matches the colorful regions in your image (Purple, Green, Orange)
const getSoilStyle = (feature) => {
  if (feature.properties.type === 'water') return { weight: 0, opacity: 0, fillOpacity: 0 };
  
  const val = feature.properties.stats.soil;
  
  // Vibrant Palette from the image
  let color = '#00ff9d'; // Default: Cyber Green
  if (val > 250) color = '#9900ff';      // High Toxicity -> Deep Purple
  else if (val > 150) color = '#ffbb00'; // Warning -> Golden Yellow
  else if (val > 80) color = '#00ccff';  // Safe/Neutral -> Electric Blue

  return { 
    fillColor: color, 
    fillOpacity: 0.8, // High opacity to look solid/3D
    weight: 1,        // Thin border
    color: '#000',    // Black border separates regions nicely
    opacity: 0.5
  };
};

// --- LAYER 2: RIVERS (The Cyan Veins) ---
// These need to shine brightly on top
const getRiverStyle = (feature) => {
  if (feature.properties.type === 'land') return { weight: 0, opacity: 0, fillOpacity: 0 };
  
  return { 
    color: '#00ffff',     // Pure Cyan
    weight: 4,            // Thicker distinct lines
    opacity: 1,           // Maximum brightness
    lineCap: 'round',
    shadowBlur: 15,       // Glow effect
    shadowColor: '#00ffff'
  };
};

// --- LAYER 3: AIR (The Floating Smoke) ---
// White/Grey puffs that cast shadows
const getAirStyle = (feature) => {
  if (feature.properties.type === 'water') return { weight: 0, opacity: 0, fillOpacity: 0 };

  const val = feature.properties.stats.air;

  // 1. CLEAN AIR: Invisible
  if (val < 100) return { weight: 0, opacity: 0, fillOpacity: 0 }; 

  // 2. SMOKE: White/Grey Palette (Like the image clouds)
  let color = '#ffffff'; 
  let opacity = 0.3;

  if (val > 300) {
    color = '#dcdcdc'; // Thick Grey Smoke
    opacity = 0.8;
  } else if (val > 200) {
    color = '#f0f0f0'; // White Mist
    opacity = 0.5;
  }

  return { 
    fillColor: color, 
    fillOpacity: opacity, 
    weight: 25,           // Very thick stroke puffs it out
    color: color,         // Stroke matches fill
    opacity: opacity,     // Soft edges
    className: 'air-cloud' // <--- Triggers the 3D Shadow CSS
  };
};

// --- LAYER 4: INTERACTION (Invisible) ---
// Keeps the tooltips working
const getInteractionStyle = (feature) => {
  if (feature.properties.type === 'water') {
    return { color: 'transparent', weight: 20, opacity: 0 };
  }
  return { color: 'transparent', weight: 0, fillOpacity: 0 };
};

  return (
    <>
      {/* Inject Styles */}
      <style>{styles}</style>
      
      {/* Visual Overlays */}
      <div className="scanlines"></div>
      <div className="vignette"></div>

      {/* --- THE WALLPAPER MAP --- */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0 }}>
        <MapContainer 
  center={[28.65, 77.15]} 
  zoom={10} 
  minZoom={10} 
  maxBounds={DELHI_BOUNDS} 
  zoomControl={false} 
  style={{ height: "100%", width: "100%", background: '#050505' }}
>
  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_nodelabels/{z}/{x}/{y}{r}.png" />
  
  {mapData && (
    <>
      {/* 1. GROUND (Solid Colorful Base) */}
<GeoJSON data={mapData} style={getSoilStyle} interactive={false} />

{/* 2. RIVERS (Cyan Network - Sits on Ground) */}
<GeoJSON data={mapData} style={getRiverStyle} interactive={false} />

{/* 3. AIR (Floating Clouds - Sits on Top with Shadow) */}
<GeoJSON data={mapData} style={getAirStyle} interactive={false} />

{/* 4. INTERACTION (Invisible) */}
<GeoJSON data={mapData} style={getInteractionStyle} interactive={true} onEachFeature={onEachFeature} />
    </>
  )}
</MapContainer>
      </div>

      {/* --- UI LAYER --- */}
      
      {/* 1. Title HUD */}
      <div className="hud-panel" style={{ position: 'fixed', top: 30, left: 30, padding: '15px 25px' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', fontFamily: 'Impact', letterSpacing: '1px', color: '#fff' }}>
          DELHI <span style={{ color: '#00ffff' }}>VISION</span>
        </h1>
      </div>

      {/* 2. Controls HUD */}
      <div className="hud-panel" style={{ 
        position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', 
        display: 'flex', border: 'none', background: 'transparent'
      }}>
        {['air', 'water', 'soil'].map(m => (
          <button
            key={m}
            onClick={() => setActiveMetric(m)}
            style={{
              background: activeMetric === m ? '#00ffff' : 'rgba(0,0,0,0.8)',
              color: activeMetric === m ? '#000' : '#00ffff',
              border: '1px solid #00ffff',
              padding: '10px 30px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              cursor: 'pointer',
              textTransform: 'uppercase',
              margin: '0 5px'
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* 3. POPUP PANEL (Teammate Component) */}
      {selectedWard && (
        <div style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '400px', 
          padding: '20px', 
          background: 'rgba(0,0,0,0.95)',
          border: '2px solid #00ffff',
          zIndex: 2000,
          color: 'white',
          boxShadow: '0 0 50px rgba(0,255,255,0.3)'
        }}>
          <h2 style={{ marginTop: 0, color: '#00ffff' }}>{selectedWard.id}</h2>
          <p>Advanced Analytics Loading...</p>
          <button 
            onClick={() => setSelectedWard(null)}
            style={{ 
              background: '#00ffff', border: 'none', padding: '10px 20px', 
              fontWeight: 'bold', cursor: 'pointer', marginTop: '20px', width: '100%' 
            }}
          >
            CLOSE PANEL
          </button>
        </div>
      )}
    </>
  );
};

export default PollutionMap;