import Typography from '@mui/material/Typography';

import { useEffect, useRef, useState } from 'react';

function StatusPane({status}) {
  const [statusToDisplay, setStatusToDisplay] = useState(null);
  const timeoutID = useRef(null);

  useEffect(() => {
    setStatusToDisplay(status);
    if(timeoutID.current)
      clearInterval(timeoutID.current);
    if(!status.loading) {
      timeoutID.current = setTimeout(() => {
        setStatusToDisplay(null);
      }, 5000);
    }
  }, [status]);

  return (
    statusToDisplay &&
    <div style={{position: "absolute", left: 0, top: "75px", width: "100%", textAlign: "center", zIndex: 100}}>
      <span style={{padding: "15px 20px",  borderRadius: "25px", backgroundColor: "rgba(224, 224, 224, 1.0)"}}>
        <Typography component="span">
          {statusToDisplay.caption}
        </Typography>
      </span>
    </div>
  );
}

export default StatusPane;
