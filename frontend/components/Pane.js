import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

import Draggable from 'react-draggable';

function Pane({onClose, title, closeable, children}) {
  return (
    <Draggable>
      <div style={{position: "absolute", top: "65px", left: "450px", zIndex: 200, padding: "5px 15px 15px 15px",  borderRadius: "25px", backgroundColor: "rgba(224, 224, 224, 1.0)"}}>
        <Stack direction="row" sx={{cursor: "grab", paddingBottom: "10px"}}>
          <IconButton onClick={onClose} disabled={!closeable}>
            <CloseIcon />
          </IconButton>
          <Typography sx={{paddingTop: "8px", paddingLeft: "5px"}}>
            {title}
          </Typography>
        </Stack>
        {children}
      </div>
    </Draggable>
  );
}

export default Pane;
