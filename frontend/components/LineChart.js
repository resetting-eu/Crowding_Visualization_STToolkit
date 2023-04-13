import { Chart as ChartJS, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Title } from "chart.js";
import { Line } from "react-chartjs-2";
import { useState } from "react";
import Fab from '@mui/material/Fab';
import TimelineIcon from '@mui/icons-material/Timeline';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { formatTimestamp, abbreviateValue } from "./Utils";

ChartJS.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Title);

function abbreviateDensity(density) {
  return density.toFixed(2);
}

function title(selectedSquaresNum) {
  if(selectedSquaresNum > 1) {
    return `Cumulative values for ${selectedSquaresNum} squares`;
  } else if(selectedSquaresNum === 1) {
    return "Cumulative values for 1 square";
  } else {
    return "Cumulative values for all squares";
  }
}

function LineChart({timestamps, cumValues, cumDensityValues, chartPointColor, selectedSquaresNum}) {
  const [visible, setVisible] = useState(true);
  const [visualization, setVisualization] = useState("absolute");

  const options = {
    scales: {x: {display: false}, y: {ticks: {callback: visualization === "absolute" ? abbreviateValue : abbreviateDensity}}},
    interaction: {mode: "index", intersect: false},
    plugins: {
      title: {display: true, text: title(selectedSquaresNum)},
    }
  };

  const data = {
    labels: timestamps ? timestamps.map(formatTimestamp) : [],
    datasets: [{data: visualization === "absolute" ? cumValues : cumDensityValues, pointBackgroundColor: chartPointColor}]
  };

  return (
    visible ?
      <div style={{position: "absolute", bottom: "0px", left: "0px", height: "240px", width: "30%", zIndex: 100, backgroundColor: "rgba(224, 224, 224, 1.0)"}}>
        <div style={{display: "flex", justifyContent: "space-between"}}>
          <span>
            <Typography component="span">Absolute</Typography>
            <Switch size="small" checked={visualization === "density"} onChange={e => setVisualization(e.target.checked ? "density" : "absolute")} />
            <Typography component="span">Density</Typography>
          </span>
          <span>
            <IconButton onClick={() => setVisible(false)}>
              <CloseIcon />
            </IconButton>
          </span>
        </div>
        <Line
          data={data}
          options={options} />
      </div>
    :
      <Fab sx={{position: "fixed", left: 0, bottom: 0}} onClick={() => setVisible(!visible)}>
        <TimelineIcon/>
      </Fab>
  );
}

export default LineChart;