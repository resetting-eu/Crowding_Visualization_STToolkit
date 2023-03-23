import { useState } from 'react';

import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import SpeedDialAction from '@mui/material/SpeedDialAction';

import Pane from './Pane';

function Toolbar({panes}) {
  const [pane, setPane] = useState(null);

  return (
    <>
      <SpeedDial ariaLabel="Toolbar" icon={<SpeedDialIcon/>} direction="down" sx={{position: "absolute", top: 0, left: 0, zIndex: 100}}>
        {panes.map(({title, icon}) => <SpeedDialAction icon={icon} key={title} tooltipTitle={title} onClick={() => setPane(title)}/>)}
      </SpeedDial>
      {pane &&
        <Pane title={pane} onClose={() => setPane(null)}>
          {panes.find(p => p.title === pane).content}
        </Pane>}
    </>
  );
}

export default Toolbar;
