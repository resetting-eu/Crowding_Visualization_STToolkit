import { Chart as ChartJS, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Title, Filler } from "chart.js";
import zoomPlugin from 'chartjs-plugin-zoom';
import { Line } from "react-chartjs-2";
import { useState } from "react";
import Fab from '@mui/material/Fab';
import TimelineIcon from '@mui/icons-material/Timeline';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Draggable from 'react-draggable';
import { formatTimestamp, formatValue } from "./Utils";

ChartJS.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Title, zoomPlugin, Filler);

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

function LineChart({hasDensity, timestamps, cumValues, cumDensityValues, cumHueValues, cumHueDensityValues, chartPointColor, selectedSquaresNum, heightMeasurementDescription, hueMeasurementDescription, cumQ0Values, cumQ4Values}) {
  const [visible, setVisible] = useState(true);
  const [visualization, setVisualization] = useState("absolute");

  const options = {
    scales: {x: {display: false}, y: {ticks: {callback: formatValue}, position: "left"}},
    interaction: {mode: "index", intersect: false},
    plugins: {
      title: {display: true, text: title(selectedSquaresNum)},
      zoom: {pan: {enabled: true, mode: "x"}, zoom: {wheel: {enabled: true}, mode: "x"}},
      tooltip: {callbacks: {label: context => new Intl.NumberFormat().format(Math.round(context.raw))}}
    }
  };

  const data = {
    labels: timestamps ? timestamps.map(formatTimestamp) : [],
    datasets: [{data: visualization === "absolute" ? cumValues : cumDensityValues, pointBackgroundColor: chartPointColor, pointRadius: pointRadius(timestamps ? timestamps.length : 0), yAxisID: "y", tooltip: {callbacks: {afterLabel: () => heightMeasurementDescription}}}]
  };

  if(cumHueValues) {
    options.scales.yright = {ticks: {callback: formatValue}, position: "right"}
    data.datasets.push({data: visualization === "absolute" ? cumHueValues : cumHueDensityValues, pointBackgroundColor: "#cc6600", pointRadius: pointRadius(timestamps ? timestamps.length : 0), yAxisID: "yright", tooltip: {callbacks: {afterLabel: () => hueMeasurementDescription}}})
  }

  if(cumQ0Values && cumQ4Values) {
    data.datasets.push({data: cumQ0Values, fill: "+1", backgroundColor: "#ff000044", pointBackgroundColor: "#ff0000aa", pointRadius: pointRadius(timestamps ? timestamps.length : 0)}, {data: cumQ4Values, pointBackgroundColor: "#ff0000aa", pointRadius: pointRadius(timestamps ? timestamps.length : 0)});
  }

  return (
    visible ?
      <div style={{position: "absolute", bottom: "20px", left: "20px", height: "240px", width: "400px", zIndex: 100, backgroundColor: "rgba(224, 224, 224, 1.0)", padding: "5px 15px 15px 15px", borderRadius: "25px"}}>
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
      <Fab sx={{position: "fixed", left: 20, bottom: 20}} onClick={() => setVisible(!visible)}>
        <TimelineIcon/>
      </Fab>
  );
}

export default LineChart;
