import { useState } from 'react';
import Typography from '@mui/material/Typography';

let listenerAdded = false;

function CoordinatesPane({mapRef}) {
  const [cursorLatitude, setCursorLatitude] = useState("N/A");
  const [cursorLongitude, setCursorLongitude] = useState("N/A");

  if(!listenerAdded) {
    // interval periodically checks if mapRef has been assigned by maplibre
    let intervalID = setInterval(() => {
      if(mapRef.current) {
        mapRef.current.on("mousemove", (e) => {
          setCursorLongitude(e.lngLat.lng.toFixed(6));
          setCursorLatitude(e.lngLat.lat.toFixed(6));
        });
        listenerAdded = true;
        clearInterval(intervalID);  
      }
    }, 100);
  }

  return (
    <div style={{position: "absolute", bottom: "70px", right: "20px", zIndex: 200, padding: "5px 15px 5px 15px",  borderRadius: "25px", backgroundColor: "rgba(224, 224, 224, 1.0)"}}>
      <Typography>Longitude: {cursorLongitude}</Typography>
      <Typography>Latitude: {cursorLatitude}</Typography>
    </div>
  );
}

export default CoordinatesPane;
