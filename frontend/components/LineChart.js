import { Chart as ChartJS, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Title } from "chart.js";
import zoomPlugin from 'chartjs-plugin-zoom';
import { Line } from "react-chartjs-2";
import { useState } from "react";
import Fab from '@mui/material/Fab';
import TimelineIcon from '@mui/icons-material/Timeline';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { formatTimestamp, abbreviateValue } from "./Utils";

ChartJS.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Title, zoomPlugin);

function abbreviateDensity(density) {
  return density;
}

function title(selectedSquaresNum) {
  if(selectedSquaresNum > 1) {
    return `Values for ${selectedSquaresNum} cells`;
  } else if(selectedSquaresNum === 1) {
    return "Values for 1 cell";
  } else {
    return "Values for all cells";
  }
}

// 0 points -> radius = 3
// 100+ points -> radius = 1
function pointRadius(numberOfPoints) {
  const points = Math.min(numberOfPoints, 100);
  return points * -0.02 + 3;
}

function LineChart({hasDensity, timestamps, cumValues, cumDensityValues, cumHueValues, cumHueDensityValues, measurementName, hueMeasurementName, chartPointColor, selectedSquaresNum}) {
  const [visible, setVisible] = useState(true);
  const [visualization, setVisualization] = useState("absolute");

  const options = {
    scales: {x: {display: false}, y: {ticks: {callback: visualization === "absolute" ? abbreviateValue : abbreviateDensity}, position: "left"}},
    interaction: {mode: "index", intersect: false},
    plugins: {
      title: {display: true, text: title(selectedSquaresNum)},
      zoom: {pan: {enabled: true, mode: "x"}, zoom: {wheel: {enabled: true}, mode: "x"}},
      tooltip: {callbacks: {label: context => new Intl.NumberFormat().format(Math.round(context.raw))}}
    }
  };

  const data = {
    labels: timestamps ? timestamps.map(formatTimestamp) : [],
    datasets: [{data: visualization === "absolute" ? cumValues : cumDensityValues, pointBackgroundColor: chartPointColor, pointRadius: pointRadius(timestamps ? timestamps.length : 0), yAxisID: "y"}]
  };

  if(cumHueValues) {
    options.scales.yright = {ticks: {callback: visualization === "absolute" ? abbreviateValue : abbreviateDensity}, position: "right"}
    data.datasets[0].label = measurementName;
    data.datasets.push({data: visualization === "absolute" ? cumHueValues : cumHueDensityValues, pointBackgroundColor: "#cc6600", pointRadius: pointRadius(timestamps ? timestamps.length : 0), yAxisID: "yright", label: hueMeasurementName})
  }

  return (
    visible ?
      <div style={{position: "absolute", bottom: "0px", left: "0px", height: "240px", width: "30%", zIndex: 100, backgroundColor: "rgba(224, 224, 224, 1.0)"}}>
        <div style={{display: "flex", justifyContent: "space-between"}}>
          {hasDensity &&
            <span>
              <Typography component="span">Absolute</Typography>
              <Switch size="small" checked={visualization === "density"} onChange={e => setVisualization(e.target.checked ? "density" : "absolute")} />
              <Typography component="span">Density</Typography>
            </span>}
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
