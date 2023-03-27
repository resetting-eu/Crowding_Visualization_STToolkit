import { useState, useRef, useEffect } from 'react';

import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import SpeedDialAction from '@mui/material/SpeedDialAction';

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

  return (
    <>
      <SpeedDial ariaLabel="Toolbar" icon={<SpeedDialIcon/>} direction="down" sx={{position: "absolute", top: 0, left: 0, zIndex: 100}} onOpen={() => !freeze && setOpen(true)} onClose={() => setOpen(false)} open={open}>
        {panes.map(({title, icon}) => <SpeedDialAction icon={icon} key={title} tooltipTitle={title} onClick={() => setPane(title)}/>)}
      </SpeedDial>
      {pane &&
        <Pane title={pane} onClose={() => setPane(null)} closeable={paneIsCloseable}>
          {paneObj.content}
        </Pane>}
    </>
  );
}

export default Toolbar;
