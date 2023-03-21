import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

function StatusPane({status}) {
  return (
    <div style={{position: "absolute", left: 0, top: "100px", width: "100%", textAlign: "center", zIndex: 100}}>
      <span style={{padding: "15px 20px",  borderRadius: "25px", backgroundColor: "rgba(224, 224, 224, 1.0)"}}>
        <Typography component="span">
          {status.caption}
        </Typography>
        {status.buttonText &&
          <Button variant="outlined" onClick={status.buttonOnClick} sx={{marginLeft: "8px"}}>
            {status.buttonText}
          </Button>}
      </span>
    </div>
  );
}

export default StatusPane;
