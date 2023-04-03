import { Chart as ChartJS, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";
import { formatTimestamp, abbreviateValue } from "./Utils";

ChartJS.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip);

function abbreviateDensity(density) {
  return density.toFixed(2);
}

function LineChart({timestamps, cumValues, visualization, chartPointColor}) {
  const tickCallback = visualization === "absolute" ? abbreviateValue : abbreviateDensity;
  
  return (
    <div style={{position: "absolute", bottom: "0px", left: "0px", height: "30%", width: "30%", zIndex: 100, backgroundColor: "rgba(224, 224, 224, 1.0)"}}>
      <Line
        data={{labels: timestamps ? timestamps.map(formatTimestamp) : [], datasets: [{data: cumValues, borderColor: 'rgb(60, 60, 60)', pointBackgroundColor: chartPointColor}]}}
        options={{scales: {x: {display: false}, y: {ticks: {callback: tickCallback}, position: visualization === "absolute" ? "left" : "right"}}}} />
    </div>
  );
}

export default LineChart;
