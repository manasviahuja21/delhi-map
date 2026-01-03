import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import PollutionMap from './PollutionMap'
import 'mapbox-gl/dist/mapbox-gl.css';
function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <PollutionMap>
          
        </PollutionMap>
        </div>
    </>
  )
}

export default App
