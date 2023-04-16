import Map, {NavigationControl, useControl} from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import { GeoJsonLayer } from '@deck.gl/layers';

import React, { useState, useEffect, createElement, useRef } from 'react';

import {MapboxOverlay} from '@deck.gl/mapbox/typed';

import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { Tooltip as MUITooltip } from '@mui/material';
import HelpIcon from '@mui/icons-material/Help';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import SettingsIcon from '@mui/icons-material/Settings';
import ManageHistoryIcon from '@mui/icons-material/ManageHistory';
import TroubleshootIcon from '@mui/icons-material/Troubleshoot';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import MapboxDrawStyles from './MapboxDrawStyles';

import { booleanContains, booleanIntersects, point, center } from '@turf/turf';

import { concatDataIndexes, formatTimestamp, maxFromArray, minFromArray } from './Utils';
import Toolbar from './Toolbar';
import StatusPane from './StatusPane';
import LineChart from './LineChart';
import CustomSlider from './CustomSlider';
import { LOCAL_INFLUXDB, LOCAL_MONGODB } from './Config';
import { CUBE_MESH } from './CubeMesh';
import CustomMeshLayer from './CustomMeshLayer';

dayjs.extend(customParseFormat);

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
    defaultMode: "draw_polygon",
    styles: MapboxDrawStyles
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

const emptyGeoJson = [];

const measurements = [
  {name: "C1", description: "Number of distinct devices", unit: "devices"},
  {name: "C2", description: "Number of distinct roaming devices", unit: "devices"},
  {name: "C3", description: "Number of distinct devices that stayed in cell", unit: "devices"},
  {name: "C4", description: "Number of distinct roaming devices that stayed in cell", unit: "devices"},
  {name: "C5", description: "Number of distinct devices entering the cell", unit: "devices"},
  {name: "C6", description: "Number of distinct devices exiting the cell", unit: "devices"},
  {name: "C7", description: "Number of distinct roaming devices entering the cell", unit: "devices"},
  {name: "C8", description: "Number of distinct roaming devices exiting the cell", unit: "devices"},
  {name: "C9", description: "Number of distinct devices with active data connection", unit: "devices"},
  {name: "C10", description: "Number of distinct roaming devices with active data connection", unit: "devices"},
  {name: "C11", description: "Number of voice calls originating from cell", unit: "calls"},
  {name: "E1", description: "Number of voice calls terminating in cell", unit: "calls"},
  {name: "E2", description: "Average rate of downstream", unit: "rate"},
  {name: "E3", description: "Average rate of upstream", unit: "rate"},
  {name: "E4", description: "Peak rate of downstream", unit: "rate"},
  {name: "E5", description: "Peak rate of upstream", unit: "rate"},
  {name: "E7", description: "Minimum permanence duration", unit: "minutes"},
  {name: "E8", description: "Average permanence duration", unit: "minutes"},
  {name: "E9", description: "Maximum permanence duration", unit: "minutes"},
  {name: "E10", description: "Number of devices that share connection", unit: "devices"}
];

function DateTimeWidget(props) {
  const [dateObj, setDateObj] = useState(dayjs(props.value, "YYYY-MM-DDTHH:mm:ss"));
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DateTimePicker
        disabled={props.disabled}
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

function IconButtonWithTooltip(props) {
  const tooltip = props.tooltip;
  const iconComponent = props.iconComponent;

  const buttonProps = {...props};
  delete buttonProps.tooltip;
  delete buttonProps.iconComponent;

  return (
  <IconButton {...buttonProps}>
    <MUITooltip title={tooltip}>
      {createElement(iconComponent)}
    </MUITooltip>
  </IconButton>
  );
}

const GRID_URL = LOCAL_MONGODB ? "http://localhost:5000/grid_local" : "http://localhost:5000/grid";
const HISTORY_URL = LOCAL_INFLUXDB ? "http://localhost:5000/data_range_local" : "http://localhost:5000/data_range";
const LIVE_URL = LOCAL_INFLUXDB ? "http://localhost:5000/mock_stream_local" : "http://localhost:5000/mock_stream";

const statuses = {
  loadingHistory: {caption: "Loading historical data..."},
  viewingHistory: {caption: "Viewing historical data"},
  loadingLive: {caption: "Loading live data..."},
  viewingLive: {caption: "Viewing live data"},
  viewingLiveNotTracking: {caption: "Not automatically tracking latest moment"},
  viewingLivePaused: {caption: "Live update paused (buffer limit reached)"},
  noData: {caption: "No data loaded"}
}

function App() {
  const [grid, setGrid] = useState(emptyGeoJson);
  const [rawData, setRawData] = useState([]);
  const [values, setValues] = useState([]);
  const [cumValues, setCumValues] = useState([]);
  const [cumDensityValues, setCumDensityValues] = useState([]);

  useEffect(() => {
    fetch(GRID_URL)
      .then(r => r.json())
      .then(data => {
        data.sort((a, b) => a.properties.id - b.properties.id);
        setGrid(data);
        loadLive();
      });
  }, []);

  const [start, setStart] = useState("2022-08-01T00:00:00Z");
  const [end, setEnd] = useState("2022-08-02T00:00:00Z");
  const [everyNumber, setEveryNumber] = useState("1");
  const [everyUnit, setEveryUnit] = useState("h");

  const [selectedTimestamp, setSelectedTimestamp] = useState(0);

  const [visualization, setVisualization] = useState("absolute");

  function changeSelectedTimestamp(value) {
    setSelectedTimestamp(value);
    setValues(transformValuesToList(rawData, value, visualization, measurement));
  }

  function change(setter) {
    return event => setter(event.target.value);
  }

  const [status, setStatus] = useState(statuses.noData);
  const statusRef = useRef(statuses.noData);
  const previousStatusRef = useRef(statuses.noData);

  function changeStatus(s) {
    if(statusEquals(s, statusRef.current)) {
      console.log("changeStatus called with current status: " + s.current.caption);
      return;
    }

    previousStatusRef.current = statusRef.current;
    setStatus(s);
    statusRef.current = s;

    if(currentStatusIs(statuses.viewingLive)) {
      if(previousStatusIs(statuses.viewingLiveNotTracking)) {
        if(rawData.timestamps) {
          changeSelectedTimestamp(rawData.timestamps.length - 1);
        }
      } else {
        setNextTimeout();
      }
    }
  }

  function statusEquals(s1, s2) {
    return s1 === s2;
  }

  function currentStatusIs(s) {
    return statusEquals(s, statusRef.current);
  }

  function previousStatusIs(s) {
    return statusEquals(s, previousStatusRef.current);
  }

  const freezeToolbar = currentStatusIs(statuses.loadingHistory) || currentStatusIs(statuses.loadingLive);
  const loadingHistory = currentStatusIs(statuses.loadingHistory);

  function load() {
    changeStatus(statuses.loadingHistory);
    const url = HISTORY_URL + "?start=" + start + "&end=" + end
      + "&every=" + everyNumber + everyUnit;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const setData = () => {
          changeStatus(statuses.viewingHistory);
          setRawData(data);
        };
        if(LOCAL_INFLUXDB) {
          setTimeout(setData, 5000); // simulate delay
        } else {
          setData();
        }
      });
  }

  function loadLive() {
    changeStatus(statuses.loadingLive);
    fetch(LIVE_URL)
      .then(r => r.json())
      .then(data => {
        changeStatus(statuses.viewingLive);
        setRawData(data);
      });
  }

  const lastTimestamp = useRef(null);

  useEffect(() => {
    if(!rawData.measurements)
      return;

    setValues(transformValuesToList(rawData, selectedTimestamp, visualization, measurement));
    changeCumValues();
    lastTimestamp.current = rawData.timestamps[rawData.timestamps.length - 1];
    if(currentStatusIs(statuses.viewingLive))
      changeSelectedTimestamp(rawData.timestamps.length - 1);
    else if(currentStatusIs(statuses.viewingHistory))
      changeSelectedTimestamp(0);
  }, [rawData]);

  function changeVisualization(e) {
    setVisualization(e.target.value);
    setValues(transformValuesToList(rawData, selectedTimestamp, e.target.value, measurement));
  }

  const setNextTimeout = () => {
    if(currentStatusIs(statuses.viewingLive) || currentStatusIs(statuses.viewingLiveNotTracking))
      setTimeout(loadLiveNewData, 2500);
  }

  const [newData, setNewData] = useState(null);

  const loadLiveNewData = () => {
    const url = LIVE_URL + "?last_timestamp=" + lastTimestamp.current;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if(!data.timestamps || data.timestamps.length === 0) {
          setNextTimeout();
        } else {
          if(currentStatusIs(statuses.viewingLive) || currentStatusIs(statuses.viewingLiveNotTracking))
            setNewData(data);
        }
      });
  }

  const MAX_LIVE_BUFFER_SIZE = 20;

  function concatData(oldData, newData) {
    // Do not exceed max buffer size. Discard older data if necessary
    const old_length = oldData.timestamps.length;
    const new_length = newData.timestamps.length;
    if(old_length + new_length > MAX_LIVE_BUFFER_SIZE && currentStatusIs(statuses.viewingLiveNotTracking)) {
      changeStatus(statuses.viewingLivePaused);
      return;
    }
    const {first_old, first_new} = concatDataIndexes(old_length, new_length, MAX_LIVE_BUFFER_SIZE);

    const concatData = {timestamps: [], measurements: {}};
    for(let i = first_old; i < old_length; ++i) {
      concatData.timestamps.push(oldData.timestamps[i]);
    }
    for(let i = first_new; i < new_length; ++i) {
      concatData.timestamps.push(newData.timestamps[i]);
    }
    for(const measurement_name of Object.keys(oldData.measurements)) {
      for(let i = 0; i < oldData.measurements[measurement_name].length; ++i) {
        const ms = [];
        for(let j = first_old; j < old_length; ++j) {
          ms.push(oldData.measurements[measurement_name][i][j]);
        }
        for(let j = first_new; j < new_length; ++j) {
          ms.push(newData.measurements[measurement_name][i][j]);
        }
        if(!concatData.measurements[measurement_name]) {
          concatData.measurements[measurement_name] = [];
        }
        concatData.measurements[measurement_name].push(ms);
      }  
    }
    setRawData(concatData);
    setNewData(null);
    if(currentStatusIs(statuses.viewingLive)) {
      changeSelectedTimestamp(concatData.timestamps.length - 1);
    }
    setNextTimeout();
  }

  useEffect(() => {
    if(!newData)
      return;

    concatData(rawData, newData);
  }, [newData]);

  function transformValuesToList(data, selectedTimestamp, visualization, measurement) {
    const measurements = data.measurements[measurement.name];
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
    const m = rawData.measurements[measurement.name][grid_index];
    const value = m[selectedTimestamp];
    return formatDensity(calcDensity(value, grid[grid_index].properties.unusable_area));
  }

  function calcDensity(value, unusable_area) {
    const usable_area = 200 * 200 - unusable_area; // TODO actually calculate area of square
    const density = value / usable_area;
    return density;
  }

  function formatDensity(density) {
    return density.toFixed(3);
  }

  const percentColors = [
    { pct: 0.0, color: { r: 0x00, g: 0xff, b: 0 } },
    { pct: 0.05, color: { r: 0xff, g: 0xff, b: 0 } },
    { pct: 0.1, color: { r: 0xff, g: 0x00, b: 0 } } ];

  // https://stackoverflow.com/questions/7128675/from-green-to-red-color-depend-on-percentage
  function getColorForPercentage(pct) {
    let i;
    for (i = 1; i < percentColors.length - 1; i++) {
        if (pct < percentColors[i].pct) {
            break;
        }
    }
    let lower = percentColors[i - 1];
    let upper = percentColors[i];
    let range = upper.pct - lower.pct;
    let rangePct = (pct - lower.pct) / range;
    let pctLower = 1 - rangePct;
    let pctUpper = rangePct;
    let color = {
        r: Math.floor(lower.color.r * pctLower + upper.color.r * pctUpper),
        g: Math.floor(lower.color.g * pctLower + upper.color.g * pctUpper),
        b: Math.floor(lower.color.b * pctLower + upper.color.b * pctUpper)
    };
    return [color.r, color.g, color.b];
  };

  function transformCumValuesToList(data, visualization, measurement) {
    let squares = selectedSquares;
    if(selectedSquares.length === 0) {
      squares = [];
      for(let i = 0; i < data.measurements[measurement.name].length; ++i)
        squares.push(i);
    }

    const selectedSquaresCumValues = [];
    for(let i = 0; i < data.timestamps.length; ++i) {
      selectedSquaresCumValues.push(0);
    }
    let totalUsableArea = 0;
    for(const square of squares) {
      const squareMeasurements = data.measurements[measurement.name][square];
      totalUsableArea += 200 * 200 - grid[square].properties.unusable_area;
      for(let i = 0; i < squareMeasurements.length; ++i) {
        const squareMeasurement = squareMeasurements[i] ? squareMeasurements[i] : 0;
        selectedSquaresCumValues[i] += squareMeasurement;
      }
    }
    if(visualization === "density") {
      for(let i = 0; i < selectedSquaresCumValues.length; ++i) {
        selectedSquaresCumValues[i] = selectedSquaresCumValues[i] / totalUsableArea;
      }
    }
    return selectedSquaresCumValues;
  }

  function sliderChange(_, value) {
    changeSelectedTimestamp(value);
    if(currentStatusIs(statuses.viewingLive) && value !== rawData.timestamps.length - 1)
      changeStatus(statuses.viewingLiveNotTracking);
  }

  function tooltip(index) {
    let html = "";
    if(visualization == "absolute") {
      html = `<span><b>${values[index]}</b> ${measurement.unit}</span>`
    } else if(visualization == "density") {
      html = `<span><b>${gridDensity(index)}</b> ${measurement.unit}/m<sup>2</sup></span>`
    } else {
      html = `<span><b>${values[index]}</b> ${measurement.unit}<br /><b>${gridDensity(index)}</b> ${measurement.unit}/m<sup>2</sup></span>`
    }
    return {html};
  }

  const [drawing, setDrawing] = useState(false);
  const [drawControlOn, setDrawControlOn] = useState(false);

  useEffect(() => setDrawControlOn(drawing), [drawing]);

  function drawingFinished(polygon) {
    setTimeout(() => {
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
    }, 0);
  }

  const [selectedSquares, setSelectedSquares] = useState([]);
  
  function toggleSquare({lng, lat}) {
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

  function changeCumValues() {
    if(rawData.measurements) {
      setCumValues(transformCumValuesToList(rawData, "absolute", measurement));
      setCumDensityValues(transformCumValuesToList(rawData, "density", measurement));
    }
  }

  useEffect(() => changeCumValues(), [selectedSquares]);

  const arrForColors = visualization === "density" ? cumDensityValues : cumValues;
  const maxCumValue = maxFromArray(arrForColors);
  const minCumValue = minFromArray(arrForColors);
  const sliderColors = [];
  for(const v of arrForColors) {
    // normalized value, between 0.0 and 0.1
    const nv = (v - minCumValue) / (maxCumValue - minCumValue) / 10;
    const ca = getColorForPercentage(nv);
    const color = `rgba(${ca.join(",")})`;
    sliderColors.push(color);
  }

  const [measurement, setMeasurement] = useState(measurements[0]);

  function chartPointColor(ctx) {
    if(ctx.dataIndex === selectedTimestamp) {
      if(currentStatusIs(statuses.viewingLive)) {
        return "red";
      } else {
        return "rgb(52, 213, 255)";
      }
    } else {
      return "rgb(60, 60, 60)";
    }
  }

  function liveButtonOnClick() {
    if(currentStatusIs(statuses.viewingHistory)) {
      loadLive();
    } else if(currentStatusIs(statuses.viewingLiveNotTracking) || currentStatusIs(statuses.viewingLivePaused)) {
      changeStatus(statuses.viewingLive);
    }
  }

  function changeMeasurement(e) {
    const m = e.target.value;
    setMeasurement(m);
    setValues(transformValuesToList(rawData, selectedTimestamp, visualization, m));
    changeCumValues();
  }

  const [showData, setShowData] = useState(true);

  const geoJsonLayer = new GeoJsonLayer({
    id: "quadricula",
    data: grid,
    filled: true,
    getLineWidth: 5,
    getLineColor: [120, 120, 120, 255],
    getFillColor: (_, info) => selectedSquares.includes(info.index) ? [138, 138, 0, 100] : [0, 0, 0, 0],
    updateTriggers: {
      getFillColor: [selectedSquares]
    }
  });
  const prismLayer = new CustomMeshLayer({
    id: "meshes",
    data: grid,
    mesh: CUBE_MESH,
    pickable: true,
    getElevation: (_, info) => visualization === "density" ? values[info.index] * 15000 : values[info.index],
    getPosition: s => center(s).geometry.coordinates,
    getColor: (_, info) => visualization == "both" ? getColorForPercentage(gridDensity(info.index)) : [0, 0, 100],
    updateTriggers: {
      getColor: [visualization, values],
      getElevation: [visualization, values]
    }
  });
  const layers = showData ? [geoJsonLayer, prismLayer] : [geoJsonLayer];

  return (
    <div>
      <StatusPane status={status} />
      <Toolbar freeze={freezeToolbar} panes={[
        {title: "Visualization options", icon: <SettingsIcon/>, content:
          <Stack direction="row" spacing={2}>
            <TextField select value={visualization} sx={{width: 300}} onChange={changeVisualization}>
              <MenuItem value="absolute" key="absolute">Absolute</MenuItem>
              <MenuItem value="density" key="density">Density</MenuItem>
              <MenuItem value="both" key="both">Absolute (height) + Density (color)</MenuItem>
            </TextField>
            <TextField select label="Measurement" sx={{width: 100}} value={measurement} onChange={changeMeasurement} SelectProps={{renderValue: (m) => m.name}} disabled={loadingHistory} >
              {measurements.map(m => (
                <MenuItem value={m} key={m.name}>{m.name + " - " + m.description}</MenuItem>
              ))}
            </TextField>
            <IconButtonWithTooltip tooltip="Play animation" iconComponent={PlayArrowIcon} />
            <IconButtonWithTooltip tooltip="Go to previous critical point" iconComponent={SkipPreviousIcon} />
            <IconButtonWithTooltip tooltip="Go to next critical point" iconComponent={SkipNextIcon} />
            <IconButtonWithTooltip tooltip="Draw area of interest" onClick={() => setDrawing(true)} iconComponent={EditIcon} />
            <IconButtonWithTooltip tooltip="Clear selection" onClick={() => setSelectedSquares([])} iconComponent={DeleteIcon} />
          </Stack>},
        {title: "History", icon: <ManageHistoryIcon/>, stayOnFreeze: true, content:
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <DateTimeWidget label="Start" value={start} onChange={setStart} disabled={loadingHistory} />
              <DateTimeWidget label="End" value={end} onChange={setEnd} disabled={loadingHistory} />
            </Stack>
            <Stack direction="row" spacing={2} sx={{textAlign: "center"}} maxWidth={true} float="left">
              <TextField type="number" label="Interval" sx={{width: 75}} value={everyNumber} onChange={e => setEveryNumber(e.target.value)} disabled={loadingHistory} />
              <TextField select value={everyUnit} label="Unit" onChange={change(setEveryUnit)} sx={{width: 95}} disabled={loadingHistory} >
                <MenuItem value="m" key="m">Minute</MenuItem>
                <MenuItem value="h" key="h">Hour</MenuItem>
                <MenuItem value="d" key="d">Day</MenuItem>
                <MenuItem value="w" key="w">Week</MenuItem>
                <MenuItem value="mo" key="mo">Month</MenuItem>
              </TextField>
              <span style={{position: "relative", top:"15px"}}>
                <MUITooltip title="Interval defines the time window that will be used to aggregate and average the data">
                  <HelpIcon />
                </MUITooltip>
              </span>
            </Stack>
            <div style={{position: "relative", width: "100%", textAlign: "center"}}>
              {loadingHistory ? <Button variant="contained">Cancel</Button> : <Button variant="contained" onClick={load}>Load</Button>}
            </div>
          </Stack>},
        {title: "Points", icon: <TroubleshootIcon/>, content:
          <p>Not implemented yet</p>
        }]} />
      <div style={{position: "absolute", top: "0px", left: "60px", right: "0px", zIndex: 100, padding: "10px 25px 10px 25px", borderRadius: "25px", backgroundColor: "rgba(224, 224, 224, 1.0)"}}>
        <Stack direction="row" spacing={2}>
          <CustomSlider value={selectedTimestamp} valueLabelDisplay="auto" onChange={sliderChange} valueLabelFormat={i => rawData.timestamps ? formatTimestamp(rawData.timestamps[i]) : "No data loaded"}  colors={sliderColors} live={currentStatusIs(statuses.viewingLive)}/>
          <span style={{flexShrink: 0}}>
            <Typography component="span">Hide</Typography>
            <Switch checked={showData} onChange={e => setShowData(e.target.checked)}/>
            <Typography component="span">Show</Typography>
          </span>
          <Button variant="contained" onClick={liveButtonOnClick} disabled={currentStatusIs(statuses.viewingLive)}>Live</Button>
        </Stack>
      </div>
      <div style={{position: "absolute", top: "0px", bottom: "0px", width: "100%"}}>
        <Map mapLib={maplibregl} mapStyle={style} initialViewState={{longitude: -9.22502725720, latitude: 38.69209409900, zoom: 15, pitch: 30}}
          onClick={(e) => !drawing && toggleSquare(e.lngLat)}
          onDblClick={(e) => e.preventDefault()}>
          <DeckGLOverlay layers={layers}
            getTooltip={(o) => o.picked && tooltip(o.index)} />
          {/* <NavigationControl /> */}
          {drawControlOn && 
            <DrawControl onFinish={drawingFinished} />}
        </Map>
      </div>
      <LineChart timestamps={rawData.timestamps} cumValues={cumValues} cumDensityValues={cumDensityValues} chartPointColor={chartPointColor} selectedSquaresNum={selectedSquares.length} />
    </div>
  );
}

export default App;
