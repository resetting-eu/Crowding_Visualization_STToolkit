import { useState } from 'react';

import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import Pane from './Pane';

function Toolbar({style, panes}) {
  const [pane, setPane] = useState(null);

  return (
    <>
      <div style={style}>
        <Accordion disableGutters sx={{backgroundColor: "rgba(224, 224, 224, 1.0)"}}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Toolbar</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ToggleButtonGroup exclusive orientation="vertical" value={pane} onChange={(_, selected) => setPane(selected)}>
              {panes.map(({title}) => <ToggleButton value={title}>{title}</ToggleButton>)}
            </ToggleButtonGroup>
          </AccordionDetails>
        </Accordion>
      </div>
      {pane &&
        <Pane title={pane} onClose={() => setPane(null)}>
          {panes.find(p => p.title === pane).content}
        </Pane>}
    </>
  );
}

export default Toolbar;
