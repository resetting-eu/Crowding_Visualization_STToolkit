import Map, {NavigationControl} from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import {GeoJsonLayer, ColumnLayer} from '@deck.gl/layers';

import React, { useState, useEffect } from 'react';

import {MapboxOverlay} from '@deck.gl/mapbox/typed';
import {useControl} from 'react-map-gl';

import Slider from '@mui/material/Slider'
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import { TextField } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

import { Chart as ChartJS, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";

import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

import { booleanContains, booleanIntersects, point, center } from '@turf/turf';

dayjs.extend(customParseFormat);

ChartJS.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip);

function DeckGLOverlay(props) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

function DrawControl({onFinish}) {
  const draw = new MapboxDraw({
    displayControlsDefault: false,
    controls: {
      polygon: false,
      trash: false
    },
    defaultMode: "draw_polygon"
  });
  const drawCreateCallback = ({features}) => {
    console.assert(features.length === 1);
    onFinish(features[0]);
  };
  useControl(
    () => draw,
    ({map}) => map.on("draw.create", drawCreateCallback),
    ({map}) => map.off("draw.create", drawCreateCallback),
    {});
  return null;
}

const style = {
  "version": 8,
      "sources": {
      "osm": {
              "type": "raster",
              "tiles": ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
              "tileSize": 256,
      "attribution": "&copy; OpenStreetMap Contributors",
      "maxzoom": 19
      }
  },
  "layers": [
      {
      "id": "osm",
      "type": "raster",
      "source": "osm", // This must match the source key above
      "paint": {
        "raster-contrast": -0.25
      }
      }
  ]
};

const emptyGeoJson = {type: "FeatureCollection", features: []};

function DateTimeWidget(props) {
  const [dateObj, setDateObj] = useState(dayjs(props.value, "YYYY-MM-DDTHH:mm:ss"));
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DateTimePicker
        renderInput={(props) => <TextField {...props} />}
        label={props.label}
        value={dateObj}
        onChange={(newDateObj) => {
          setDateObj(newDateObj);
          props.onChange(newDateObj.format("YYYY-MM-DDTHH:mm:ss[Z]"));
        }} />
  </LocalizationProvider>
  );
}

function App() {
  const [grid, setGrid] = useState(emptyGeoJson);
  const [rawData, setRawData] = useState([]);
  const [values, setValues] = useState([]);
  const [cumValues, setCumValues] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/grid")
      .then(r => r.json())
      .then(data => {
        data.sort((a, b) => a.properties.id - b.properties.id);
        setGrid(data);
      });
    }, []);

  const [start, setStart] = useState("2022-08-01T00:00:00Z");
  const [end, setEnd] = useState("2022-08-02T00:00:00Z");
  const [every, setEvery] = useState("1h");

  const [selectedTimestamp, setSelectedTimestamp] = useState(0);

  const [visualization, setVisualization] = useState("absolute");

  useEffect(() => {
    setValues(transformValuesToList(rawData));
  }, [selectedTimestamp]);

  function change(setter) {
    return event => setter(event.target.value);
  }

  function load() {
    const url = "http://localhost:5000/data_range?start=" + start + "&end=" + end + "&every=" + every;
    fetch(url)
      .then(r => r.json())
      .then(data => setRawData(data))
    console.log(url);
  }

  useEffect(() => {
    setValues(transformValuesToList(rawData));
    setCumValues(transformCumValuesToList(rawData));
  }, [rawData]);

  useEffect(() => {
    setValues(transformValuesToList(rawData))
  }, [visualization])

  function transformValuesToList(data) {
    if(!data.measurements)
      return [];
    const measurements = data.measurements;
    const res = [];
    for(let i = 0; i < measurements.length; ++i) {
      const measurement = measurements[i];
      let value = measurement[selectedTimestamp];
      if(visualization == "density") {
        value = calcDensity(value, grid[i].properties.unusable_area);
      }
      res.push(value);
    }
    return res;
  }

  function gridDensity(grid_index) {
    if(!rawData.measurements)
      return 0;
    const measurement = rawData.measurements[grid_index];
    const value = measurement[selectedTimestamp];
    return calcDensity(value, grid[grid_index].properties.unusable_area);
  }

  function calcDensity(value, unusable_area) {
    const usable_area = 200 * 200 - unusable_area;
    const density = value / usable_area;
    return density.toFixed(3);
  }

  const percentColors = [
    { pct: 0.0, color: { r: 0x00, g: 0xff, b: 0 } },
    { pct: 0.05, color: { r: 0xff, g: 0xff, b: 0 } },
    { pct: 0.1, color: { r: 0xff, g: 0x00, b: 0 } } ];

  // https://stackoverflow.com/questions/7128675/from-green-to-red-color-depend-on-percentage
  function getColorForPercentage(pct) {
    for (var i = 1; i < percentColors.length - 1; i++) {
        if (pct < percentColors[i].pct) {
            break;
        }
    }
    var lower = percentColors[i - 1];
    var upper = percentColors[i];
    var range = upper.pct - lower.pct;
    var rangePct = (pct - lower.pct) / range;
    var pctLower = 1 - rangePct;
    var pctUpper = rangePct;
    var color = {
        r: Math.floor(lower.color.r * pctLower + upper.color.r * pctUpper),
        g: Math.floor(lower.color.g * pctLower + upper.color.g * pctUpper),
        b: Math.floor(lower.color.b * pctLower + upper.color.b * pctUpper)
    };
    return [color.r, color.g, color.b, 100];
  };

  function transformCumValuesToList(data) {
    if(!data.measurements)
      return;

    let squares = selectedSquares;
    if(selectedSquares.length === 0) {
      squares = [];
      for(let i = 0; i < data.measurements.length; ++i)
        squares.push(i);
    }

    const selectedSquaresCumValues = [];
    for(let i = 0; i < data.timestamps.length; ++i) {
      selectedSquaresCumValues.push(0);
    }
    for(const square of squares) {
      const squareMeasurements = data.measurements[square];
      for(let i = 0; i < squareMeasurements.length; ++i) {
        selectedSquaresCumValues[i] += squareMeasurements[i];
      }
    }
    return selectedSquaresCumValues;
  }

  function sliderChange(e, value) {
    setSelectedTimestamp(value);
  }

  function tooltip(index) {
    let html = "";
    if(visualization == "absolute") {
      html = `<span><b>${values[index]}</b> devices</span>`
    } else if(visualization == "density") {
      html = `<span><b>${gridDensity(index)}</b> devices/m<sup>2</sup></span>`
    } else {
      html = `<span><b>${values[index]}</b> devices<br /><b>${gridDensity(index)}</b> devices/m<sup>2</sup></span>`
    }
    return {html};
  }

  function formatTimestamp(timestamp) {
    const dateObj = dayjs(timestamp, "YYYY-MM-DDTHH:mm:ss");
    return dateObj.format("DD/MM/YYYY hh:mm A"); // TODO - the format should be determined by the user's locale
  }

  const [drawing, setDrawing] = useState(false);
  const [drawControlOn, setDrawControlOn] = useState(false);

  useEffect(() => setDrawControlOn(drawing), [drawing]);

  function drawingFinished(polygon) {
    let squares = []; // squares that intersect the polygon
    for(let i = 0; i < grid.length; ++i) {
      const s = grid[i];
      if(booleanIntersects(polygon, s)) {
        squares.push(i);
      }
    }
    const selectedSquaresWithDups = [...selectedSquares, ...squares];
    const selectedSquaresSet = new Set(selectedSquaresWithDups);
    setSelectedSquares([...selectedSquaresSet]);

    setDrawing(false);
  }

  const [selectedSquares, setSelectedSquares] = useState([]);
  const [dontPick, setDontPick] = useState(false);

  // dontPick é hack para não selecionar quadrícula quando o utilizador faz o último click do desenho
  useEffect(() => drawing && setDontPick(true), [drawing]);
  
  function toggleSquare({lng, lat}) {
    if(dontPick) {
      setDontPick(false);
      return;
    }
    const p = point([lng, lat], {});
    let square = null;
    for(let i = 0; i < grid.length; ++i) {
      if(booleanContains(grid[i], p)) {
        square = i;
        break;
      }
    }
    if(square !== null) {
      if(selectedSquares.includes(square)) {
        setSelectedSquares(selectedSquares.filter(s => s !== square));
      } else {
        setSelectedSquares([...selectedSquares, square]);
      }
    }
  }

  const [clearSelectedSquaresDisabled, setClearSelectedSquaresDisabled] = useState(true);
  useEffect(() => setClearSelectedSquaresDisabled(selectedSquares.length === 0), [selectedSquares]);
  useEffect(() => setCumValues(transformCumValuesToList(rawData)), [selectedSquares]);

  return (
    <div>
      <div style={{position: "absolute", top: "10px", left: "10%", width: "80%", margin: "auto"}}>
        <div style={{float: "left", textAlign: "left", margin: "auto", verticalAlign: "middle"}}>
          <DateTimeWidget label="Start" value={start} onChange={setStart} />
          <DateTimeWidget label="End" value={end} onChange={setEnd} />
          <TextField label="Interval" value={every} onChange={e => setEvery(e.target.value)} sx={{width: 100}} />
          <span style={{position: "relative", top:"10px"}}><Button variant="outlined" onClick={load}>Load</Button></span>
        </div>
        <div style={{float: "right", textAlign: "right", margin: "auto"}}>
          <span style={{position: "relative", top:"10px"}}>
            <Button variant="outlined" onClick={() => setDrawing(true)} disabled={drawing}>Draw</Button>
            <Button variant="outlined" onClick={() => setSelectedSquares([])} disabled={clearSelectedSquaresDisabled}>Clear</Button>
          </span>
          <TextField select value={visualization} label="Visualization" onChange={change(setVisualization)}>
            <MenuItem value="absolute" key="absolute">Number of devices</MenuItem>
            <MenuItem value="density" key="density">Density of devices</MenuItem>
            <MenuItem value="both" key="both">Number + density of devices</MenuItem>
          </TextField>
        </div>
      </div>
      <div style={{position: "absolute", top: "65px", left: "10%", width: "80%"}}>
        <Slider step={1} min={0} max={rawData.timestamps ? rawData.timestamps.length - 1 : 0} value={selectedTimestamp} valueLabelDisplay="auto" onChange={sliderChange} valueLabelFormat={i => rawData.timestamps ? formatTimestamp(rawData.timestamps[i]) : "N/A"}/>
      </div>
      <div style={{position: "absolute", top: "100px", bottom: "0px", width: "100%"}}>
        <Map mapLib={maplibregl} mapStyle={style} initialViewState={{longitude: -9.22502725720, latitude: 38.69209409900, zoom: 15, pitch: 30}}
          onClick={(e) => !drawing && toggleSquare(e.lngLat)}
          onDblClick={(e) => e.preventDefault()}>
          <DeckGLOverlay layers={
            [new GeoJsonLayer({
              id: "quadricula",
              data: grid,
              filled: true,
              getLineWidth: 5,
              getLineColor: [120, 120, 120, 255],
              getFillColor: (_, info) => selectedSquares.includes(info.index) ? [138, 138, 0, 100] : [0, 0, 0, 0],
              updateTriggers: {
                getFillColor: [selectedSquares]
              }
            }),
            new ColumnLayer({
              id: "barras",
              data: values,
              radius: 25,
              pickable: true,
              getElevation: value => visualization == "density" ? value * 15000 : value,
              getPosition: (_, info) => center(grid[info.index]).geometry.coordinates,
              getFillColor: (_, info) => visualization == "both" ? getColorForPercentage(gridDensity(info.index)) : [0, 0, 139, 100]
            })]}
            getTooltip={(o) => o.picked && tooltip(o.index)} />
          <NavigationControl />
          {drawControlOn && 
            <DrawControl onFinish={drawingFinished} />}
        </Map>
      </div>
      {visualization == "absolute" &&
        <div style={{position: "absolute", bottom: "0px", left: "0px", height: "30%", width: "30%", zIndex: 100, backgroundColor: "rgba(255, 255, 255, 1.0)"}}>
          <Line
            data={{labels: rawData.timestamps ? rawData.timestamps : [], datasets: [{data: cumValues, borderColor: 'rgb(60, 60, 60)', pointBackgroundColor: (ctx) => ctx.dataIndex == selectedTimestamp ? "rgb(52, 213, 255)" : "rgb(60, 60, 60)"}]}}
            options={{scales: {x: {display: false}}}} />
        </div>}
    </div>
  );
}

export default App;
