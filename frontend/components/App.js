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
import StopIcon from '@mui/icons-material/Stop';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import MapIcon from '@mui/icons-material/Map';
import TextField from '@mui/material/TextField';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import SettingsIcon from '@mui/icons-material/Settings';
import ManageHistoryIcon from '@mui/icons-material/ManageHistory';
import TroubleshootIcon from '@mui/icons-material/Troubleshoot';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';

import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import MapboxDrawStyles from './MapboxDrawStyles';

import { booleanContains, booleanIntersects, point, center } from '@turf/turf';

import { concatDataIndexes, formatTimestamp, maxFromArray, minFromArray, nextLocalMaxIndex, prevLocalMaxIndex, getRgbForPercentage } from './Utils';
import Toolbar from './Toolbar';
import StatusPane from './StatusPane';
import LineChart from './LineChart';
import CustomSlider from './CustomSlider';
import { LOCAL_INFLUXDB, GRID_URL, HISTORY_URL, LIVE_URL, PRISM_SIZES, DEFAULT_PRISM_SIZE, PARISHES_URL } from './Config';
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
  {name: "C1", description: "Number of distinct devices", unit: "devices", max: 2454},
  {name: "C2", description: "Number of distinct roaming devices", unit: "devices", max: 539},
  {name: "C3", description: "Number of distinct devices that stayed in cell", unit: "devices", max: 2232},
  {name: "C4", description: "Number of distinct roaming devices that stayed in cell", unit: "devices", max: 481.9},
  {name: "C5", description: "Number of distinct devices entering the cell", unit: "devices", max: 801.1},
  {name: "C6", description: "Number of distinct devices exiting the cell", unit: "devices", max: 812.4},
  {name: "C7", description: "Number of distinct roaming devices entering the cell", unit: "devices", max: 244.3},
  {name: "C8", description: "Number of distinct roaming devices exiting the cell", unit: "devices", max: 224.5},
  {name: "C9", description: "Number of distinct devices with active data connection", unit: "devices", max: 2380},
  {name: "C10", description: "Number of distinct roaming devices with active data connection", unit: "devices", max: 535.1},
  {name: "C11", description: "Number of voice calls originating from cell", unit: "calls", max: 75.64},
  {name: "E1", description: "Number of voice calls terminating in cell", unit: "calls", max: 12.47},
  {name: "E2", description: "Average rate of downstream", unit: "rate", max: 412900},
  {name: "E3", description: "Average rate of upstream", unit: "rate", max: 34180},
  {name: "E4", description: "Peak rate of downstream", unit: "rate", max: 68650000},
  {name: "E5", description: "Peak rate of upstream", unit: "rate", max: 17800000},
  {name: "E7", description: "Minimum permanence duration", unit: "minutes", max: 10},
  {name: "E8", description: "Average permanence duration", unit: "minutes", max: 182.1},
  {name: "E9", description: "Maximum permanence duration", unit: "minutes", max: 300},
  {name: "E10", description: "Number of devices that share connection", unit: "devices", max: 10}
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


const statuses = {
  loadingHistory: {caption: "Loading historical data...", loading: true},
  viewingHistory: {caption: "Viewing historical data"},
  loadingLive: {caption: "Loading live data...", loading: true},
  viewingLive: {caption: "Viewing live data"},
  viewingLiveNotTracking: {caption: "Not automatically tracking latest moment"},
  viewingLivePaused: {caption: "Live update paused (buffer limit reached)"},
  animating: {},
  noData: {caption: "No data loaded"}
}

function App() {
  const [grid, setGrid] = useState(emptyGeoJson);
  const [parishes, setParishes] = useState([]);
  const [selectedParishes, setSelectedParishes] = useState([]);
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
      });
    fetch(PARISHES_URL)
      .then(r => r.json())
      .then(ps => setParishes(ps));
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
      + "&every=" + everyNumber + everyUnit + "&parishes=" + selectedParishes.join(",");
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
    changeCumValues(measurement);
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

  function calcFirstNewTimestamp(oldTimestamps, newTimestamps) {
    for(let i = 0; i < newTimestamps.length; ++i) {
      if(!oldTimestamps.includes(newTimestamps[i])) {
        return i;
      }
    }
    return null;
  }

  function calcNewDataOnly(oldData, newData) {
    const firstNewTimestamp = calcFirstNewTimestamp(oldData.timestamps, newData.timestamps);
    if(firstNewTimestamp === 0)
      return newData;
    if(firstNewTimestamp === null)
      return {timestamps: [], measurements: {}};
    
    const timestamps = newData.timestamps.slice(firstNewTimestamp);
    
    const measurements = {};
    for(const measurement in newData.measurements) {
      measurements[measurement] = [];
      for(let i = 0; i < newData.measurements[measurement].length; ++i) {
        measurements[measurement].push(newData.measurements[measurement][i].slice(firstNewTimestamp));
      }
    }

    return {timestamps, measurements};
  }

  function concatData(oldData, newData) {
    newData = calcNewDataOnly(oldData, newData);

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

  function changeCumValues(measurement) {
    if(rawData.measurements) {
      setCumValues(transformCumValuesToList(rawData, "absolute", measurement));
      setCumDensityValues(transformCumValuesToList(rawData, "density", measurement));
    }
  }

  useEffect(() => changeCumValues(measurement), [selectedSquares]);

  const arrForColors = visualization === "density" ? cumDensityValues : cumValues;
  const maxCumValue = maxFromArray(arrForColors);
  const minCumValue = minFromArray(arrForColors);
  const sliderColors = [];
  for(const v of arrForColors) {
    // normalized value, between 0.0 and 0.1
    const nv = (v - minCumValue) / (maxCumValue - minCumValue) / 10;
    const ca = getRgbForPercentage(nv);
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
    if(currentStatusIs(statuses.viewingHistory) || currentStatusIs(statuses.noData)) {
      loadLive();
    } else if(currentStatusIs(statuses.viewingLiveNotTracking) || currentStatusIs(statuses.viewingLivePaused)) {
      changeStatus(statuses.viewingLive);
    }
  }

  function changeMeasurement(e) {
    const m = e.target.value;
    setMeasurement(m);
    setValues(transformValuesToList(rawData, selectedTimestamp, visualization, m));
    changeCumValues(m);
  }

  const [prismSize, setPrismSize] = useState(DEFAULT_PRISM_SIZE);

  function calcElevation(index) {
    const value = values[index];
    const measurement_max = measurement.max;
    const density_factor = visualization === "density" ? 15000 : 1;
    const elevation_max = prismSize.size;
    return value * density_factor * elevation_max / measurement_max;
  }

  function calcPrismColor(index) {
    if(visualization === "both")
      return getRgbForPercentage(gridDensity(index));
    else
      return [0, 0, 100];
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
    getElevation: (_, info) => Math.min(calcElevation(info.index), prismSize.size),
    getPosition: s => center(s).geometry.coordinates,
    getColor: (_, info) => calcPrismColor(info.index),
    getTopFaceColor: [255, 0, 0],
    getPaintTopFace: (_, info) => values[info.index] > measurement.max ? 1.0 : 0.0,
    updateTriggers: {
      getColor: [visualization, values, prismSize],
      getElevation: [visualization, values, prismSize],
      getPaintTopFace: [visualization, values]
    }
  });
  const layers = showData ? [geoJsonLayer, prismLayer] : [geoJsonLayer];

  function fastBackward() {
    const prevMax = prevLocalMaxIndex(cumValues, selectedTimestamp);
    if(prevMax !== null)
      sliderChange(null, prevMax);
  }

  function fastForward() {
    const nextMax = nextLocalMaxIndex(cumValues, selectedTimestamp);
    if(nextMax !== null)
      sliderChange(null, nextMax);
  }

  const selectedTimestampBeforeAnimation = useRef(null);
  const selectedTimestampAnimation = useRef(null);
  const animationInterval = useRef(null);

  function toggleAnimate() {
    if(currentStatusIs(statuses.noData) || statusRef.current.loading)
      return;

    if(!currentStatusIs(statuses.animating)) { // animate
      selectedTimestampBeforeAnimation.current = selectedTimestamp;
      changeSelectedTimestamp(0);
      selectedTimestampAnimation.current = 0;
      changeStatus(statuses.animating);
      animationInterval.current = setInterval(() => {
        selectedTimestampAnimation.current++;
        if(selectedTimestampAnimation.current < rawData.timestamps.length) {
          changeSelectedTimestamp(selectedTimestampAnimation.current);
        } else {
          clearInterval(animationInterval.current);
          changeSelectedTimestamp(selectedTimestampBeforeAnimation.current);
          changeStatus(previousStatusRef.current);
        }
      }, 500);  
    } else { // stop animation
      clearInterval(animationInterval.current);
      if(previousStatusIs(statuses.viewingLive) && selectedTimestampAnimation.current < rawData.timestamps.length - 1) {
        changeStatus(statuses.viewingLiveNotTracking);
      } else {
        changeStatus(previousStatusRef.current);
      }
    }
  }

  const [animateIconComponent, setAnimateIconComponent] = useState(PlayArrowIcon);
  const [fastForwardBackwardDisabled, setFastForwardBackwardDisabled] = useState(false);

  useEffect(() => {
    setAnimateIconComponent(currentStatusIs(statuses.animating) ? StopIcon : PlayArrowIcon);
    setFastForwardBackwardDisabled(currentStatusIs(statuses.animating));
  }, [status]);

  return (
    <div>
      {status.caption && <StatusPane status={status} />}
      <Toolbar freeze={freezeToolbar} panes={[
        {title: "Select parishes", icon: <MapIcon/>, content:
          <>
            <Autocomplete multiple options={parishes} value={selectedParishes} onChange={(_, p) => setSelectedParishes(p)} renderInput={(params) => (<TextField {...params}/>)} />
            <Typography>Only data from the selected parishes will be loaded</Typography>
          </>},
        {title: "Visualization options", icon: <SettingsIcon/>, content:
          <Stack direction="row" spacing={2}>
            <TextField select value={visualization} sx={{width: 300}} onChange={changeVisualization}>
              <MenuItem value="absolute" key="absolute">Absolute</MenuItem>
              <MenuItem value="density" key="density">Density</MenuItem>
              <MenuItem value="both" key="both">Absolute (height) + Density (color)</MenuItem>
            </TextField>
            <TextField select label="Size" value={prismSize} onChange={change(setPrismSize)}>
              {PRISM_SIZES.map(s => (
                <MenuItem value={s} key={s.caption}>{s.caption}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Measurement" sx={{width: 100}} value={measurement} onChange={changeMeasurement} SelectProps={{renderValue: (m) => m.name}} disabled={loadingHistory} >
              {measurements.map(m => (
                <MenuItem value={m} key={m.name}>{m.name + " - " + m.description}</MenuItem>
              ))}
            </TextField>
            <IconButtonWithTooltip tooltip="Play animation" onClick={toggleAnimate} iconComponent={animateIconComponent} />
            <IconButtonWithTooltip tooltip="Go to previous critical point" onClick={fastBackward} iconComponent={SkipPreviousIcon} disabled={fastForwardBackwardDisabled} />
            <IconButtonWithTooltip tooltip="Go to next critical point" onClick={fastForward} iconComponent={SkipNextIcon} disabled={fastForwardBackwardDisabled} />
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
