import { LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Title } from "chart.js";
import zoomPlugin from 'chartjs-plugin-zoom';

import { useEffect } from "react";

function ChartJsRegister({setter}) {
  useEffect(() =>
    setter([LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Title, zoomPlugin]),
    []);
  return null;
}

export default ChartJsRegister;
