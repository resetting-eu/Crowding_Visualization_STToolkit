import { useState, useRef, useEffect } from 'react';

import Button from '@mui/material/Button';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';

import Pane from './Pane';

function Toolbar({panes, freeze}) {
  const [pane, setPane] = useState(null);
  const [open, setOpen] = useState(false);
  const [paneIsCloseable, setPaneIsCloseable] = useState(true);

  const closeAfterFreeze = useRef(false);

  const paneObj = panes.find(p => p.title === pane);

  useEffect(() => {
    if(!freeze && !paneIsCloseable)
      setPaneIsCloseable(true);

    if(freeze && pane) {
      if(paneObj.stayOnFreeze) {
        setPaneIsCloseable(false);
        closeAfterFreeze.current = true;
      } else {
        setPane(null);
      }
    } else if(!freeze && pane && closeAfterFreeze.current) {
      setPane(null);
      closeAfterFreeze.current = false;
    }
  }, [freeze]);

  const ToggleButtonWithLabel = ({ value, icon }) => {
    const selected = pane === value;
    return (
      <div style={{textAlign: "center", width: 75}}>
        <ToggleButton value={value} aria-label={value} onChange={(_,v) => setPane(selected ? null : value)} selected={selected}>
          {icon}
        </ToggleButton>
        <Typography variant="body2" sx={{wordWrap: "break-word"}}>{value}</Typography>
      </div>
    );
  };
  
  return (
    <>
      <Button variant="contained" onClick={() => setOpen(!open)} sx={{position: "absolute", top: 5, left: 2, zIndex: 100, padding: "0px 0px", minWidth: 55, minHeight: 50}}>MENU</Button>
      {open &&
        <div style={{position: "absolute", left: 2, top: 65, zIndex: 200, padding: "5px 15px 5px 15px",  borderRadius: "25px", backgroundColor: "rgba(224, 224, 224, 1.0)"}}>
          <ToggleButtonGroup>
            {panes.map(({title, icon}) => 
              <ToggleButtonWithLabel key={title} value={title} icon={icon} />)}
          </ToggleButtonGroup>
        </div>}
      {pane &&
        <Pane title={pane} onClose={() => setPane(null)} closeable={paneIsCloseable} description={paneObj.description}>
          {paneObj.content}
        </Pane>}
    </>
  );
}

export default Toolbar;
