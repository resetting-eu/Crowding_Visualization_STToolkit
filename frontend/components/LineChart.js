import { Chart as ChartJS, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Title } from "chart.js";
import { Line } from "react-chartjs-2";
import { formatTimestamp, abbreviateValue } from "./Utils";

ChartJS.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

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
  const showAbsolute = cumValues.length > 0;
  const showDensity = cumDensityValues.length > 0;

  const options = {
    scales: {x: {display: false}, y: {display: false}},
    interaction: {mode: "index", intersect: false},
    plugins: {
      title: {display: true, text: title(selectedSquaresNum)},
      legend: {display: showAbsolute && showDensity}
    }
  };
  if(showAbsolute) {
    options.scales.yleft =
    {
      ticks: {callback: abbreviateValue},
      position: "left"
    };
  }
  if(showDensity) {
    options.scales.yright = 
    {
      ticks: {callback: abbreviateDensity},
      position: "right"
    };
  }

  const data = {
    labels: timestamps ? timestamps.map(formatTimestamp) : [],
    datasets: []
  };
  if(showAbsolute) {
    data.datasets.push({data: cumValues, borderColor: "#cc3399", pointBackgroundColor: chartPointColor("#cc3399"), yAxisID: "yleft", label: "Absolute"});
  }
  if(showDensity) {
    data.datasets.push({data: cumDensityValues, borderColor: "#cc6600", pointBackgroundColor: chartPointColor("#cc6600"), yAxisID: "yright", label: "Density"})
  }

  const divHeight = showAbsolute && showDensity ? "225px" : "200px";
  
  return (
    <div style={{position: "absolute", bottom: "0px", left: "0px", height: divHeight, width: "30%", zIndex: 100, backgroundColor: "rgba(224, 224, 224, 1.0)"}}>
      <Line
        data={data}
        options={options} />
    </div>
  );
}

export default LineChart;
