import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, ZoomControl, useMap } from 'react-leaflet'; 
import 'leaflet/dist/leaflet.css';

// --- CSS ---
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
  body { margin: 0; background: #f4f6f8; overflow: hidden; font-family: 'Manrope', sans-serif; }

  /* TEXTURE & PREVIOUS STYLES */
  .texture-overlay {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 10;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E");
  }
  .air-cloud { filter: blur(25px); mix-blend-mode: normal; pointer-events: none; transition: all 0.5s ease; }
  
  /* CUSTOM SLIDER STYLING */
  .sim-range {
    -webkit-appearance: none; width: 100%; height: 4px; background: #cbd5e0; border-radius: 2px; outline: none; margin-top: 8px;
  }
  .sim-range::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; 
    background: #4a5568; cursor: pointer; transition: transform .1s; box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  .sim-range::-webkit-slider-thumb:hover { transform: scale(1.2); background: #2d3748; }

  /* TOOLTIPS & LEGEND */
  .modern-tooltip {
    background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(8px); border: none; border-left: 4px solid #006064; 
    color: #374151; font-family: 'Manrope', sans-serif; font-size: 12px; font-weight: 600; padding: 12px 16px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.12); border-radius: 8px; z-index: 1000;
  }
  .grad-soil { background: linear-gradient(to right, #d87a2c, #9c3c19, #3E2723); }
  .grad-air { background: linear-gradient(to right, #b3e5fc, #fbc02d, #5d4037); }
  .grad-water { background: linear-gradient(to right, #29b6f6, #20B2AA, #d84315); }
`;

const DELHI_BOUNDS = [[28.20, 76.60], [29.10, 77.80]];

// 1. BASELINE DATA GENERATION
const GENERATE_BASELINE_DATA = (id) => {
  const air = Math.floor(Math.random() * 450 + 50); 
  const water = Math.floor(Math.random() * 100 + 10);  
  const soil = Math.floor(Math.random() * 300 + 50);   
  return { air, water, soil };
};

// 2. CAUSES CONFIGURATION
// This defines your sliders and how much "weight" they have on the final calculation
const POLLUTION_CAUSES = {
  air: [
    { id: 'stubble', label: 'Stubble Burning', weight: 0.5 }, // High impact
    { id: 'vehicle', label: 'Vehicular Emissions', weight: 0.3 },
    { id: 'dust', label: 'Construction Dust', weight: 0.2 }
  ],
  water: [
    { id: 'industrial', label: 'Industrial Effluents', weight: 0.6 },
    { id: 'sewage', label: 'Untreated Sewage', weight: 0.4 }
  ],
  soil: [
    { id: 'pesticide', label: 'Pesticide Overuse', weight: 0.7 },
    { id: 'dumping', label: 'Illegal Dumping', weight: 0.3 }
  ]
};

const MapLayerManager = () => {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('soilPane')) { map.createPane('soilPane'); map.getPane('soilPane').style.zIndex = 400; }
    if (!map.getPane('airPane')) { map.createPane('airPane'); map.getPane('airPane').style.zIndex = 410; map.getPane('airPane').style.pointerEvents = 'none'; }
    if (!map.getPane('borderPane')) { map.createPane('borderPane'); map.getPane('borderPane').style.zIndex = 420; map.getPane('borderPane').style.pointerEvents = 'none'; }
    if (!map.getPane('waterPane')) { map.createPane('waterPane'); map.getPane('waterPane').style.zIndex = 430; }
  }, [map]);
  return null;
};

const PollutionMap = () => {
  const [visibleLayers, setVisibleLayers] = useState({ air: true, water: true, soil: true });
  
  // New State: Store values for EVERY specific cause independently
  const [causeValues, setCauseValues] = useState({
    stubble: 1.0, vehicle: 1.0, dust: 1.0,
    industrial: 1.0, sewage: 1.0,
    pesticide: 1.0, dumping: 1.0
  });

  const [mapData, setMapData] = useState(null);
  const [selectedWard, setSelectedWard] = useState(null);

  // --- AGGREGATION LOGIC ---
  // Calculates the total multiplier for a category (e.g. Air) based on its specific causes
  const getAggregateFactor = (category) => {
    const causes = POLLUTION_CAUSES[category];
    let weightedSum = 0;
    let totalWeight = 0;

    causes.forEach(cause => {
      weightedSum += (causeValues[cause.id] * cause.weight);
      totalWeight += cause.weight;
    });

    return weightedSum / totalWeight; // Returns a weighted average factor
  };

  // Get current factors (Computed dynamically)
  const currentFactors = {
    air: getAggregateFactor('air'),
    water: getAggregateFactor('water'),
    soil: getAggregateFactor('soil')
  };

  useEffect(() => {
    fetch('/delhi_combined2.geojson')
      .then(res => res.json())
      .then(data => {
        const enriched = data.features.map((f, i) => {
          const props = f.properties;
          const isWater = props.isRiver || props.natural === 'water';
          props.type = isWater ? 'water' : 'land';
          props.id = props.Ward_Name || props.name || `#`;
          props.baseStats = GENERATE_BASELINE_DATA(i); 
          return f;
        });
        setMapData({ ...data, features: enriched });
      });
  }, []);

  const toggleLayer = (layerKey) => {
    setVisibleLayers(prev => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  const updateCause = (id, value) => {
    setCauseValues(prev => ({ ...prev, [id]: parseFloat(value) }));
  };

  // --- DYNAMIC STYLING ---
  const getSimulatedValue = (base, factor) => Math.floor(base * factor);

  const getSoilFillStyle = (feature) => {
    if (feature.properties.type === 'water') return { weight: 0, opacity: 0, fillOpacity: 0 };
    const val = getSimulatedValue(feature.properties.baseStats.soil, currentFactors.soil);
    let color = '#d87a2c'; 
    if (val > 280) color = '#3E2723';      
    else if (val > 200) color = '#9c3c19'; 
    else if (val > 120) color = '#5D4037'; 
    return { fillColor: color, fillOpacity: 0.6, weight: 0, opacity: 0 };
  };

  const getRiverStyle = (feature) => {
    if (feature.properties.type === 'land') return { weight: 0, opacity: 0, fillOpacity: 0 };
    const val = getSimulatedValue(feature.properties.baseStats.water, currentFactors.water);
    let color = '#29b6f6'; 
    if (val > 150) color = '#bf360c'; 
    else if (val > 80) color = '#d84315';   
    else if (val > 50) color = '#20B2AA'; 
    else if (val > 30) color = '#008080'; 
    return { color: color, weight: 4, opacity: 0.5, fillColor: color, fillOpacity: 0.8 };
  };

  const getAirStyle = (feature) => {
    if (feature.properties.type === 'water') return { weight: 0, opacity: 0, fillOpacity: 0 };
    const val = getSimulatedValue(feature.properties.baseStats.air, currentFactors.air);
    if (val < 100) return { opacity: 0, fillOpacity: 0 }; 
    let color = '#b3e5fc'; let opacity = 0.3;
    if (val > 600) { color = '#3e2723'; opacity = 0.7; } 
    else if (val > 400) { color = '#5d4037'; opacity = 0.55; } 
    else if (val > 300) { color = '#e65100'; opacity = 0.5; } 
    else if (val > 200) { color = '#fbc02d'; opacity = 0.45; } 
    return { fillColor: color, fillOpacity: opacity, weight: 20, color: color, className: 'air-cloud' };
  };

  const getBorderStyle = (feature) => {
    if (feature.properties.type === 'water') return { weight: 0, opacity: 0, fillOpacity: 0 };
    return { fillColor: 'transparent', fillOpacity: 0, color: '#000', weight: 1, opacity: 0.8 };
  };

  const onEachFeature = (feature, layer) => {
    if (feature.properties.id === '#') return;
    const isWater = feature.properties.type === 'water';
    
    // Calculate current values for Tooltip
    const currentSoil = getSimulatedValue(feature.properties.baseStats.soil, currentFactors.soil);
    const currentAir = getSimulatedValue(feature.properties.baseStats.air, currentFactors.air);
    const currentWater = getSimulatedValue(feature.properties.baseStats.water, currentFactors.water);

    const title = isWater ? 'HYDROLOGY' : 'WARD SECTOR';
    
    const tooltipHTML = `
      <div style="min-width: 140px;">
        <div style="text-transform: uppercase; font-size: 10px; color: #888; letter-spacing: 1px; margin-bottom: 4px; font-weight: 700;">${title}</div>
        <div style="font-size: 14px; font-weight: 800; color: #111; margin-bottom: 8px;">${feature.properties.id}</div>
        ${!isWater ? `
          <div style="display:flex; gap: 8px; font-size: 11px; font-weight: 600;">
            <span style="background: #e8f5e9; color: #2e7d32; padding: 2px 6px; border-radius: 4px;">Soil: ${currentSoil}</span>
            <span style="background: #f5f5f5; color: #616161; padding: 2px 6px; border-radius: 4px;">Air: ${currentAir}</span>
          </div>
        ` : `
          <div style="display:flex; gap: 8px; font-size: 11px; font-weight: 600;">
            <span style="background: #e1f5fe; color: #0277bd; padding: 2px 6px; border-radius: 4px;">Water Index: ${currentWater}</span>
          </div>
        `}
      </div>
    `;
    layer.bindTooltip(tooltipHTML, { sticky: true, className: 'modern-tooltip', direction: 'top', opacity: 1 });
    layer.on({ 
      click: () => !isWater && setSelectedWard({
        ...feature.properties,
        stats: { air: currentAir, soil: currentSoil, water: currentWater }
      }) 
    });
  };

  return (
    <>
      <style>{styles}</style>
      <div className="texture-overlay"></div>

      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#f4f6f8' }}>
        <MapContainer 
        scrollWheelZoom={false}   // Disables "two finger scroll" or mouse wheel zoom
  doubleClickZoom={false}   // Disables "double click to zoom"
  touchZoom={false}
          center={[28.65, 77.15]} zoom={10} zoomControl={false} minZoom={10} maxBounds={DELHI_BOUNDS} 
          style={{ height: "100%", width: "100%", background: '#f4f6f8' }}
        >
          <MapLayerManager />
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
          <ZoomControl position="bottomright" />

          {mapData && (
            <>
              {visibleLayers.soil && (
                <GeoJSON key={`soil-${currentFactors.soil}`} data={mapData} style={getSoilFillStyle} interactive={false} pane="soilPane" />
              )}
              {visibleLayers.air && (
                <GeoJSON key={`air-${currentFactors.air}`} data={mapData} style={getAirStyle} interactive={false} pane="airPane" />
              )}
              <GeoJSON key="borders" data={mapData} style={getBorderStyle} interactive={false} pane="borderPane" />
              {visibleLayers.water && (
                <GeoJSON key={`water-${currentFactors.water}`} data={mapData} style={getRiverStyle} interactive={false} pane="waterPane" />
              )}
              <GeoJSON key={`interact-${currentFactors.air}-${currentFactors.water}`} data={mapData} style={() => ({ opacity: 0, fillOpacity: 0 })} interactive={true} onEachFeature={onEachFeature} />
            </>
          )}
        </MapContainer>
      </div>

      {/* HEADER */}
      <div style={{ 
        position: 'fixed', top: 30, left: 30, zIndex: 500,
        background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(16px)',
        padding: '24px 30px', borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid rgba(255,255,255,0.6)'
      }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#1a202c', letterSpacing: '-0.5px' }}>
          DELHI VISION
        </h1>
        <div style={{ fontSize: '11px', color: '#718096', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '700' }}>
          Environmental Policy Dashboard
        </div>
      </div>

      {/* NEW: EXPANDED SIMULATION SIDEBAR */}
      <div style={{ 
        position: 'fixed', top: 30, right: 30, zIndex: 500, width: '280px', maxHeight: '80vh', overflowY: 'auto',
        background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(16px)',
        padding: '24px', borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid rgba(255,255,255,0.6)'
      }}>
        <div style={{ fontSize: '12px', fontWeight: '800', color: '#2d3748', marginBottom: '20px', textTransform:'uppercase', letterSpacing:'1px', borderBottom:'1px solid #edf2f7', paddingBottom:'10px' }}>
           ⚡ Causative Agents
        </div>

        {/* Dynamic Sliders Grouped by Category */}
        {Object.entries(POLLUTION_CAUSES).map(([category, causes]) => {
            if (!visibleLayers[category]) return null;

            return (
                <div key={category} style={{ marginBottom: '24px' }}>
                    <div style={{ 
                        fontSize:'10px', fontWeight:'700', textTransform:'uppercase', color:'#a0aec0', marginBottom:'12px', letterSpacing:'0.5px',
                        display: 'flex', alignItems: 'center', gap: '6px'
                    }}>
                        <span style={{width:'6px', height:'6px', borderRadius:'50%', background: category==='air'?'#f6ad55': category==='water'?'#4299e1':'#ed8936'}}></span>
                        {category} Factors
                    </div>
                    
                    {causes.map(cause => (
                        <div key={cause.id} style={{ marginBottom: '16px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', fontWeight:'600', color:'#4a5568' }}>
                                <span>{cause.label}</span>
                                <span style={{color: causeValues[cause.id] > 1.5 ? '#e53e3e' : '#38a169', fontFamily:'monospace'}}>
                                    {(causeValues[cause.id]).toFixed(1)}x
                                </span>
                            </div>
                            <input 
                                type="range" min="0.5" max="3.0" step="0.1" 
                                value={causeValues[cause.id]} 
                                onChange={(e) => updateCause(cause.id, e.target.value)}
                                className="sim-range"
                            />
                        </div>
                    ))}
                </div>
            )
        })}

        {/* EMPTY STATE */}
        {!visibleLayers.air && !visibleLayers.water && !visibleLayers.soil && (
          <div style={{fontSize:'12px', color:'#a0aec0', fontStyle:'italic', textAlign:'center', padding:'20px 0'}}>
            Enable a layer below to access its simulation controls.
          </div>
        )}
      </div>

      {/* LEGEND */}
      <div style={{ 
        position: 'fixed', bottom: 100, left: 30, zIndex: 500,
        background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(16px)',
        padding: '20px', borderRadius: '16px', width: '200px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid rgba(255,255,255,0.6)'
      }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#4a5568', marginBottom: '15px', textTransform:'uppercase', letterSpacing:'1px' }}>Index Guide</div>
        <div style={{marginBottom: '12px'}}>
           <div style={{display:'flex', justifyContent:'space-between', fontSize:'10px', fontWeight:'600', color:'#718096', marginBottom:'4px'}}>
             <span>Soil</span> <span>Safe → Toxic</span>
           </div>
           <div style={{ height: '6px', borderRadius: '3px', width: '100%' }} className="grad-soil"></div>
        </div>
        <div style={{marginBottom: '12px'}}>
           <div style={{display:'flex', justifyContent:'space-between', fontSize:'10px', fontWeight:'600', color:'#718096', marginBottom:'4px'}}>
             <span>Air (AQI)</span> <span>Clean → Haz</span>
           </div>
           <div style={{ height: '6px', borderRadius: '3px', width: '100%' }} className="grad-air"></div>
        </div>
        <div>
           <div style={{display:'flex', justifyContent:'space-between', fontSize:'10px', fontWeight:'600', color:'#718096', marginBottom:'4px'}}>
             <span>Water</span> <span>Clear → Polluted</span>
           </div>
           <div style={{ height: '6px', borderRadius: '3px', width: '100%' }} className="grad-water"></div>
        </div>
      </div>

      {/* CONTROLS */}
      <div style={{ 
        position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 500,
        background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(20px)', borderRadius: '16px',
        padding: '12px 20px', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', 
        display: 'flex', gap: '16px', border: '1px solid rgba(255,255,255,0.8)'
      }}>
        {['air', 'water', 'soil'].map((layer) => (
          <button
            key={layer}
            onClick={() => toggleLayer(layer)}
            style={{
              background: visibleLayers[layer] ? '#2d3748' : '#edf2f7',
              color: visibleLayers[layer] ? '#fff' : '#718096',
              border: '1px solid', borderColor: visibleLayers[layer] ? '#2d3748' : 'transparent',
              padding: '10px 28px', fontFamily: 'Manrope, sans-serif', fontSize: '13px',
              fontWeight: '700', cursor: 'pointer', textTransform: 'capitalize', borderRadius: '12px',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', 
              boxShadow: visibleLayers[layer] ? '0 4px 12px rgba(45, 55, 72, 0.3)' : 'none'
            }}
          >
            {layer}
          </button>
        ))}
      </div>
      
      {/* WARD DETAIL SIDEBAR (Adjusted Position) */}
      {selectedWard && (
        <div style={{
          position: 'fixed', top: '50%', right: '350px', 
          transform: 'translateY(-50%)',
          width: '280px', padding: '24px', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)',
          borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', zIndex: 2000, border: '1px solid rgba(255,255,255,0.8)'
        }}>
          <h2 style={{ marginTop: 0, color: '#1a202c', fontSize: '20px', fontWeight: '800', marginBottom: '4px' }}>{selectedWard.id}</h2>
          <div style={{ fontSize: '11px', color: '#718096', marginBottom: '24px', letterSpacing: '0.5px', fontWeight:'600' }}>WARD ANALYTICS REPORT</div>
          <div style={{ display: 'grid', gap: '12px' }}>
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: '#f7fafc', borderRadius: '12px', border: '1px solid #edf2f7' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#4a5568' }}>Soil Quality</span>
                <span style={{ fontSize: '15px', fontWeight: '800', color: selectedWard.stats.soil > 280 ? '#ef4444' : '#10b981' }}>{selectedWard.stats.soil}</span>
             </div>
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: '#f7fafc', borderRadius: '12px', border: '1px solid #edf2f7' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#4a5568' }}>Air Quality (AQI)</span>
                <span style={{ fontSize: '15px', fontWeight: '800', color: selectedWard.stats.air > 300 ? '#1f2937' : '#f59e0b' }}>{selectedWard.stats.air}</span>
             </div>
          </div>
          <button 
            onClick={() => setSelectedWard(null)}
            style={{ 
              background: '#edf2f7', border: 'none', padding: '14px', color:'#4a5568', fontWeight: '700',
              cursor: 'pointer', marginTop: '24px', width: '100%', fontSize:'12px', borderRadius:'12px', transition: 'background 0.2s'
            }}
            onMouseOver={(e) => { e.target.style.background = '#e2e8f0'; e.target.style.color = '#1a202c'; }}
            onMouseOut={(e) => { e.target.style.background = '#edf2f7'; e.target.style.color = '#4a5568'; }}
          >
            CLOSE REPORT
          </button>
        </div>
      )}
    </>
  );
};

export default PollutionMap;