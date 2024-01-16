import Map, {ScaleControl, useControl} from 'react-map-gl';
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
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';

import customParseFormat from "dayjs/plugin/customParseFormat";

import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import MapboxDrawStyles from './MapboxDrawStyles';

import { booleanContains, booleanIntersects, point, center } from '@turf/turf';

import { dayjs, dayjsSetLocaleAndTimezone, concatDataIndexes, formatTimestamp, maxFromArray, minFromArray, nextLocalMaxIndex, prevLocalMaxIndex, getRgbForPercentage } from './Utils';
import Toolbar from './Toolbar';
import StatusPane from './StatusPane';
import CustomSlider from './CustomSlider';
import CustomColumnLayer from './CustomColumnLayer';
import CoordinatesPane from './CoordinatesPane';

import dynamic from 'next/dynamic';

import {AmbientLight, DirectionalLight, LightingEffect} from '@deck.gl/core';

import Config from '@/components/Config'
const backendUrl = Config.urlPrefix;

const ambientLight = new AmbientLight({
  color: [255, 255, 255],
  intensity: 2.0
});
const directionalLight = new DirectionalLight({
  color: [255, 255, 255],
  intensity: 1.0,
  direction: [0, 1, 0]
});
const lightingEffect = new LightingEffect({ambientLight, directionalLight});

// One of the modules imported by LineChart gives an error if imported normally ("window is not defined")
// A workaround is to use next's dynamic import to force the component's code to be client side
const LineChart = dynamic(
  () => import('./LineChart'),
  { ssr: false }
);

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
  const drawDeleteCallback = () => {
    onFinish(null);
  }
  useControl(
    () => draw,
    ({map}) => {
      map.on("draw.create", drawCreateCallback);
      map.on("draw.modechange", drawDeleteCallback);
    },
    ({map}) => {
      map.off("draw.create", drawCreateCallback);
      map.off("draw.modechange", drawDeleteCallback);
    },
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


function DateTimeWidget(props) {
  const [dateObj, setDateObj] = useState(dayjs.utc(props.value, "YYYY-MM-DDTHH:mm:ss").tz(props.timezone));
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DateTimePicker
        disabled={props.disabled}
        renderInput={(props) => <TextField {...props} />}
        label={props.label}
        value={dateObj}
        onChange={(newDateObj) => {
          setDateObj(newDateObj);
          props.onChange(newDateObj.utc().format("YYYY-MM-DDTHH:mm:ss[Z]"));
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

function ZoomChangeListener({map, onChange}) {
  const prevDate = useRef(null);
  const intervalId = useRef(null);
  const callback = () => {
    const now = new Date();
    if(prevDate.current && now - prevDate.current > 500) {
      prevDate.current = null;
      clearInterval(intervalId.current);
      intervalId.current = null;
      onChange(map.getZoom());
    } else {
      prevDate.current = now;
      if(!intervalId.current) {
        intervalId.current = setInterval(callback, 500);
      }
    }
  }
  if(map) {
    map.on("zoom", callback);
  }
  return null;
}

function zoomToHeightFactory(zoom1, height1, zoom2, height2, minHeight, maxHeight) {
  const m = (height2 - height1) / (zoom2 - zoom1);
  const b = height1 - m * zoom1;
  const f = zoom => m * zoom + b;
  return zoom => Math.min(Math.max(f(zoom), minHeight), maxHeight);
}

const zoomToHeight = zoomToHeightFactory(15, 750, 16, 400, 200, 1500);

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

let dayjsLocaleSet = false;

function gotoLoginIf401(response) {
  if(response.status === 401)
    window.location.replace("/login");
}

let tC_start;

function App({grid, parishesMapping, initialViewState, hasDensity, hasLive, measurements, columnRadius, locale, timezone}) {
  if(!dayjsLocaleSet && locale) { // TODO limpar/simplificar código
    dayjsSetLocaleAndTimezone(locale, timezone);
    dayjsLocaleSet = true;
  }

  const [rawData, setRawData] = useState({});
  const [values, setValues] = useState([]);
  const [cumValues, setCumValues] = useState([]);
  const [cumDensityValues, setCumDensityValues] = useState(null);
  const [cumHueValues, setCumHueValues] = useState(null);
  const [cumHueDensityValues, setCumHueDensityValues] = useState(null);

  const [parishValue, setParishValue] = useState("");

  const [start, setStart] = useState("2022-06-01T00:00:00Z");
  const [end, setEnd] = useState("2022-06-01T03:00:00Z");
  const [everyNumber, setEveryNumber] = useState("1");
  const [everyUnit, setEveryUnit] = useState("h");
  const [loadSelectedSquaresOnly, setLoadSelectedSquaresOnly] = useState(false);

  const [selectedTimestamp, setSelectedTimestamp] = useState(0);

  function changeSelectedTimestamp(value) {
    if(rawData.values) {
      setSelectedTimestamp(value);
      setValues(valuesToVisualize(rawData, value, measurement));  
    }
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
    statusRef.current = s;
    setStatus(s);

    if(currentStatusIs(statuses.viewingLive)) {
      if(previousStatusIs(statuses.viewingLiveNotTracking)) {
        if(rawData.timestamps) {
          changeSelectedTimestamp(rawData.timestamps.length - 1);
        }
      } else if(previousStatusIs(statuses.viewingLivePaused)) {
        loadLive();
      } else {
        setNextTimeout();
      }
    }
    if(currentStatusIs(statuses.viewingLiveNotTracking)) {
      if(previousStatusIs(statuses.animating)) {
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

  function locationsParameter() {
    if(loadSelectedSquaresOnly) {
      return selectedSquares.join(",");
    } else {
      return "";
    }
  }

  function load() {
    changeStatus(statuses.loadingHistory);
    const locations = parishesMapping ? "&locations=" + locationsParameter() : "";
    const url = backendUrl + "/history" + "?start=" + start + "&end=" + end
      + "&every=" + everyNumber + everyUnit + locations;
    const start_date = Date.now();
    fetch(url, {credentials: "include"})
      .then(r => {
        gotoLoginIf401(r);
        const end_date = Date.now();
        console.log(`load time: ${(end_date - start_date) / 1000}`);
        tC_start = Date.now();
        return r.json()
      }).then(data => {
        const setData = () => {
          changeStatus(statuses.viewingHistory);
          setRawData(data);
        };
        // if(LOCAL_INFLUXDB) {
        //   setTimeout(setData, 5000); // simulate delay
        // } else {
          setData();
        // }
      });
  }

  function loadLive() {
    changeStatus(statuses.loadingLive);
    fetch(backendUrl + "/live", {credentials: "include"})
      .then(r => {gotoLoginIf401(r); return r.json()})
      .then(data => {
        changeStatus(statuses.viewingLive);
        setRawData(data);
      });
  }

  const client_id = useRef(null);

  useEffect(() => {
    if(!rawData.values)
      return;

    setValues(valuesToVisualize(rawData, selectedTimestamp, measurement));
    changeCumValues(measurement, hueMeasurement);
    if(rawData.client_id)
      client_id.current = rawData.client_id;
    if(currentStatusIs(statuses.viewingLive))
      changeSelectedTimestamp(rawData.timestamps.length - 1);
    else if(currentStatusIs(statuses.viewingHistory))
      changeSelectedTimestamp(0);

    // TODO is this log useful? maybe place it somewhere after the rerendering caused by the state setters here
    console.log(`post-load time: ${(Date.now() - tC_start) / 1000}`)
  }, [rawData]);

  const setNextTimeout = () => {
    if(currentStatusIs(statuses.viewingLive) || currentStatusIs(statuses.viewingLiveNotTracking))
      setTimeout(loadLiveNewData, 2500);
  }

  const [newData, setNewData] = useState(null);

  const loadLiveNewData = () => {
    const url = backendUrl + "/live" + "?client_id=" + client_id.current;
    fetch(url, {credentials: "include"})
      .then(r => {gotoLoginIf401(r); return r.json()})
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
      return {timestamps: [], values: {}};
    
    const timestamps = newData.timestamps.slice(firstNewTimestamp);
    
    const measurements = {};
    for(const measurement in newData.values) {
      measurements[measurement] = [];
      for(const loc in newData.values[measurement]) {
        measurements[measurement].push(newData.values[measurement][loc].slice(firstNewTimestamp));
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

    const concatData = {timestamps: [], values: {}};
    for(let i = first_old; i < old_length; ++i) {
      concatData.timestamps.push(oldData.timestamps[i]);
    }
    for(let i = first_new; i < new_length; ++i) {
      concatData.timestamps.push(newData.timestamps[i]);
    }
    for(const measurement_name of Object.keys(oldData.values)) {
      for(const loc in oldData.values[measurement_name]) {
        const ms = [];
        for(let j = first_old; j < old_length; ++j) {
          ms.push(oldData.values[measurement_name][loc][j]);
        }
        for(let j = first_new; j < new_length; ++j) {
          ms.push(newData.values[measurement_name][loc][j]);
        }
        if(!concatData.values[measurement_name]) {
          concatData.values[measurement_name] = [];
        }
        concatData.values[measurement_name][loc] = ms;
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

  function valuesToVisualize(data, selectedTimestamp, measurement) {
    const measurements = data.values[measurement.name];
    const res = {};
    for(const loc in measurements) {
      const measurement = measurements[loc];
      let value = measurement[selectedTimestamp];
      res[loc] = value;
    }
    return res;
  }

  function gridDensity(location) {
    if(!rawData.values[measurement.name][location])
      return null;
    const m = rawData.values[measurement.name][location];
    const value = m[selectedTimestamp];
    const cell = grid.find(c => c.properties.id === location);
    return formatDensity(calcDensity(value, cell));
  }

  function usableArea(cell) {
    if(cell.properties.usable_area !== undefined) {
      return cell.properties.usable_area;
    } else {
      return 200 * 200 - cell.properties.unusable_area; // TODO actually calculate area of square
    }
  }

  function calcDensity(value, cell) {
    const density = value / usableArea(cell) * 10000;
    return density;
  }

  function formatDensity(density) {
    return Math.round(density);
  }

  function transformCumValuesToList(data, visualization, measurement) {
    let squares = selectedSquares;
    if(selectedSquares.length === 0) {
      squares = [];
      for(const s of grid)
        squares.push(s.properties.id);
    }

    const selectedSquaresCumValues = [];
    for(let i = 0; i < data.timestamps.length; ++i) {
      selectedSquaresCumValues.push(0);
    }
    let totalUsableArea = 0;
    for(const square of squares) {
      if(!data.values[measurement.name][square])
        continue;
      const squareMeasurements = data.values[measurement.name][square];
      const squareFeature = grid.find(s => s.properties.id === square);
      totalUsableArea += usableArea(squareFeature);
      for(let i = 0; i < squareMeasurements.length; ++i) {
        const squareMeasurement = squareMeasurements[i] ? squareMeasurements[i] : 0;
        selectedSquaresCumValues[i] += squareMeasurement;
      }
    }
    totalUsableArea /= 10000;
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

  const [drawing, setDrawing] = useState(false);
  const [drawControlOn, setDrawControlOn] = useState(false);

  useEffect(() => setDrawControlOn(drawing), [drawing]);

  function drawingFinished(polygon) {
    setTimeout(() => {
      if(polygon) {
        let squares = []; // squares that intersect the polygon
        for(let i = 0; i < grid.length; ++i) {
          const s = grid[i];
          if(booleanIntersects(polygon, s)) {
            squares.push(s.properties.id);
          }
        }
        const selectedSquaresWithDups = [...selectedSquares, ...squares];
        const selectedSquaresSet = new Set(selectedSquaresWithDups);
        setSelectedSquares([...selectedSquaresSet]);
      }
      setDrawing(false);  
    }, 0);
  }

  const [selectedSquares, setSelectedSquares] = useState([]);
  
  function toggleSquare({lng, lat}) {
    const p = point([lng, lat], {});
    let square = null;
    for(let i = 0; i < grid.length; ++i) {
      if(booleanContains(grid[i], p)) {
        square = grid[i].properties.id;
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

  function changeCumValues(measurement, hueMeasurement) {
    if(rawData.values) {
      setCumValues(transformCumValuesToList(rawData, "absolute", measurement));
      if(hasDensity)
        setCumDensityValues(transformCumValuesToList(rawData, "density", measurement));
      if(hueMeasurement.name == "None" || hueMeasurement.name == "Density") { // no hue measurement selected
        setCumHueValues(null);
        if(hasDensity)
          setCumHueDensityValues(null);
      } else { // hue measurement selected
         setCumHueValues(transformCumValuesToList(rawData, "absolute", hueMeasurement));
         if(hasDensity)
           setCumHueDensityValues(transformCumValuesToList(rawData, "density", hueMeasurement));
      }
    }
  }

  useEffect(() => changeCumValues(measurement, hueMeasurement), [selectedSquares]);

  const arrForColors = cumValues;
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

  const hueMeasurements = [
    {name: "None"}
  ];
  if(hasDensity)
    hueMeasurements.push({name: "Density"});
  for(const m of measurements) {
    if(m !== measurement) {
      hueMeasurements.push(m);
    }
  }

  const [hueMeasurement, setHueMeasurement] = useState(hueMeasurements[0]);
  
  const heightMeasurementDescription = measurement && measurement.name + " - " + (measurement.shortDescription ? measurement.shortDescription : measurement.description);
  const hueMeasurementDescription = hueMeasurement && hueMeasurement.name + " - " + (hueMeasurement.shortDescription ? hueMeasurement.shortDescription : hueMeasurement.description);

  function tooltip(location) {
    let html = "";
    const mainValue = Math.round(values[location]);
    const mainDescription = "(" + heightMeasurementDescription + ")";
    const hueDescription = "(" + hueMeasurementDescription + ")";
    if(hueMeasurement.name === "None") {
      html = `<span><b>${mainValue}</b> ${measurement.unit} ${mainDescription}</span>`;
    } else if(hueMeasurement.name === "Density") {
      html = `<span>Height: <b>${mainValue}</b> ${measurement.unit} ${mainDescription}<br />Hue: <b>${gridDensity(location)}</b> ${measurement.unit}/ha</span>`;
    } else {
      html = `<span>Height: <b>${mainValue}</b> ${measurement.unit} ${mainDescription}<br />Hue: <b>${Math.round(valueForHueMeasurement(location))}</b> ${hueMeasurement.unit} ${hueDescription}</span>`;
    }
    return {html};
  }

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
    if(m == hueMeasurement)
      setHueMeasurement(hueMeasurements[0]); // None
    setValues(valuesToVisualize(rawData, selectedTimestamp, m));
    changeCumValues(m, hueMeasurement);
  }

  function changeHueMeasurement(e) {
    const m = e.target.value;
    setHueMeasurement(m);
    changeCumValues(measurement, m);
  }

  const [prismSize, setPrismSize] = useState(zoomToHeight(initialViewState.zoom));

  function measurementMax() {
    return currentStatusIs(statuses.viewingHistory) && measurement.capHistory ? measurement.capHistory : measurement.cap;
  }

  function calcElevation(id) {
    const value = values[id];
    const measurement_max = measurementMax();
    const elevation_max = prismSize;
    return value * elevation_max / measurement_max;
  }

  function valueForHueMeasurement(location) {
    if(rawData.values[hueMeasurement.name][location])
      return rawData.values[hueMeasurement.name][location][selectedTimestamp];
  }

  function percentageForMeasurement(location) {
    const value = valueForHueMeasurement(location);
    const percentage = Math.min(0.1, value / hueMeasurement.cap / 10);
    return percentage;
  }

  function calcPrismColor(location) {
    if(!rawData.values[measurement.name][location])
      return null;
    if(hueMeasurement.name == "Density")
      return getRgbForPercentage(gridDensity(location) / 10000);
    else if(hueMeasurement.name == "None")
      return [0, 0, 100];
    else
      return getRgbForPercentage(percentageForMeasurement(location));
  }

  const [showData, setShowData] = useState("all"); // "all" | "selected" | "none"

  function getPosition(square) {
    if(!square || values[square.properties.id] === undefined)
      return null;
    const show = showData === "all" || (showData === "selected" && selectedSquares.includes(square.properties.id));
    return show ? center(square).geometry.coordinates : null;
  }

  const geoJsonLayer = new GeoJsonLayer({
    id: "quadricula",
    data: grid,
    filled: true,
    getLineWidth: 5,
    getLineColor: [120, 120, 120, 255],
    getFillColor: s => selectedSquares.includes(s.properties.id) ? [138, 138, 0, 100] : [0, 0, 0, 0],
    updateTriggers: {
      getFillColor: [selectedSquares]
    }
  });
  const prismLayer = new CustomColumnLayer({
    id: "columns",
    data: grid,
    pickable: true,
    getElevation: s => Math.min(calcElevation(s.properties.id), prismSize),
    getPosition: getPosition,
    getFillColor: s => calcPrismColor(s.properties.id),
    getTopFaceColor: [255, 0, 0],
    getPaintTopFace: s => values[s.properties.id] > measurementMax() ? 1.0 : 0.0,
    radius: columnRadius,
    material: {
      "ambient": 0.35,
      "diffuse": 0.6,
      "shininess": 32,
      "specularColor": [255, 255, 255]
    },
    updateTriggers: {
      getFillColor: [values, hueMeasurement],
      getElevation: [values, prismSize],
      getPaintTopFace: [values],
      getPosition: [showData, selectedSquares, values]
    }
  });
  const layers = [geoJsonLayer, prismLayer];

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
        if(selectedTimestampAnimation.current >= rawData.timestamps.length) {
          clearInterval(animationInterval.current);
          changeSelectedTimestamp(selectedTimestampBeforeAnimation.current);
          changeStatus(previousStatusRef.current);
        } else {
          changeSelectedTimestamp(selectedTimestampAnimation.current);
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

  const animating = currentStatusIs(statuses.animating);
  const animateIconComponent = animating ? StopIcon : PlayArrowIcon;
  const animateToggleButtonTooltip = animating ? "Stop animation" : "Play animation";

  const mapRef = useRef(null);

  function onChangeZoom(zoom) {
    setPrismSize(zoomToHeight(zoom));
  }

  function selectParish(parishSquares) {
    if(parishSquares) {
      setSelectedSquares([...selectedSquares, ...parishSquares]);
      setParishValue("");  
    }
  }

  return (
    <div>
      <StatusPane status={status} />
      <Toolbar freeze={freezeToolbar} panes={[
        {title: "Parishes", icon: <MapIcon/>, content:
          <Stack direction="row" spacing={2} sx={{verticalAlign: "middle"}}>
            <TextField select label="Parish" value={parishValue} onChange={change(setParishValue)} sx={{minWidth: 200}} >
              {Object.keys(parishesMapping).map(parishName => (
                <MenuItem value={parishName} key={parishName}>{parishName}</MenuItem>
              ))}
            </TextField>
            <Button variant="contained" onClick={() => selectParish(parishesMapping[parishValue])}>Select</Button>
          </Stack>},
        {title: "Settings", icon: <SettingsIcon/>, content:
          <Stack direction="row" spacing={2}>
            <TextField select label="Height" sx={{width: 100}} value={measurement} onChange={changeMeasurement} SelectProps={{renderValue: (m) => m.name}} disabled={loadingHistory} >
              {measurements.map(m => (
                <MenuItem value={m} key={m.name}>{m.name + " - " + m.description}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Hue" sx={{width: 120}} value={hueMeasurement} onChange={changeHueMeasurement} SelectProps={{renderValue: (m) => m.name}} disabled={loadingHistory} >
                {hueMeasurements.map(m => (
                  <MenuItem value={m} key={m.name}>{m.description ? m.name + " - " + m.description : m.name}</MenuItem>
                ))}
            </TextField>
            <IconButtonWithTooltip tooltip={animateToggleButtonTooltip} onClick={toggleAnimate} iconComponent={animateIconComponent} />
            <IconButtonWithTooltip tooltip="Go to previous critical point" onClick={fastBackward} iconComponent={SkipPreviousIcon} disabled={animating} />
            <IconButtonWithTooltip tooltip="Go to next critical point" onClick={fastForward} iconComponent={SkipNextIcon} disabled={animating} />
            <IconButtonWithTooltip tooltip="Draw area of interest" onClick={() => setDrawing(true)} iconComponent={EditIcon} />
            <IconButtonWithTooltip tooltip="Clear selection" onClick={() => setSelectedSquares([])} iconComponent={DeleteIcon} />
          </Stack>},
          {title: "History", icon: <ManageHistoryIcon/>, stayOnFreeze: true, content:
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <DateTimeWidget label="Start" value={start} onChange={setStart} disabled={loadingHistory} timezone={timezone} />
              <DateTimeWidget label="End" value={end} onChange={setEnd} disabled={loadingHistory} timezone={timezone} />
            </Stack>
            <Stack direction="row" spacing={2} sx={{textAlign: "center"}} maxWidth={true} float="left">
              <TextField type="number" label="Interval" sx={{width: 75}} value={everyNumber} onChange={e => setEveryNumber(e.target.value)} disabled={loadingHistory} />
              <TextField select value={everyUnit} label="Unit" onChange={change(setEveryUnit)} sx={{width: 95}} disabled={loadingHistory} >
                <MenuItem value="m" key="m">Minute</MenuItem>
                <MenuItem value="h" key="h">Hour</MenuItem>
                <MenuItem value="d" key="d">Day</MenuItem>
                <MenuItem value="w" key="w">Week</MenuItem>
              </TextField>
              <span style={{position: "relative", top:"15px"}}>
                <MUITooltip title="Interval defines the time window that will be used to aggregate and average the data">
                  <HelpIcon />
                </MUITooltip>
              </span>
              <span style={{position: "relative", top: "10px", left: "65px"}}>
                <Switch checked={loadSelectedSquaresOnly} onChange={e => setLoadSelectedSquaresOnly(e.target.checked)} />
                <Typography component="span">Selected locations only</Typography>
              </span>
            </Stack>
            <div style={{position: "relative", width: "100%", textAlign: "center"}}>
              {loadingHistory ? <Button variant="contained">Cancel</Button> : <Button variant="contained" onClick={load}>Load</Button>}
            </div>
          </Stack>},
        {title: "Points", icon: <TroubleshootIcon/>, content:
          <p>Not implemented yet</p>
        },
        {title: "Account", icon: <ManageAccountsIcon />, content:
          <Button variant="contained" onClick={() => window.location.replace("/account")}>Account page</Button>
        }]} />
      <div style={{position: "absolute", top: "0px", left: "60px", right: "0px", zIndex: 100, padding: "10px 25px 10px 25px", borderRadius: "25px", backgroundColor: "rgba(224, 224, 224, 1.0)"}}>
        <Stack direction="row" spacing={2}>
          <CustomSlider value={selectedTimestamp} valueLabelDisplay="auto" onChange={sliderChange} valueLabelFormat={i => rawData.timestamps ? formatTimestamp(rawData.timestamps[i]) : "No data loaded"}  colors={sliderColors} live={currentStatusIs(statuses.viewingLive)}/>
          <TextField select value={showData} label="Show" onChange={change(setShowData)} size="small" sx={{width: 140}}>
            <MenuItem value="all" key="all">All</MenuItem>
            <MenuItem value="selected" key="selected">Selected</MenuItem>
            <MenuItem value="none" key="none">None</MenuItem>
          </TextField>
          {hasLive && 
            <Button variant="contained" onClick={liveButtonOnClick} disabled={currentStatusIs(statuses.viewingLive) || currentStatusIs(statuses.loadingLive)}>Live</Button>}
        </Stack>
      </div>
      <div style={{position: "absolute", top: "0px", bottom: "0px", width: "100%"}}>
        <Map mapLib={maplibregl} mapStyle={style}
          ref={mapRef}
          initialViewState={initialViewState}
          onClick={(e) => !drawing && toggleSquare(e.lngLat)}
          onDblClick={(e) => e.preventDefault()}>
          <DeckGLOverlay layers={layers} effects={[lightingEffect]}
            getTooltip={(o) => o.picked && tooltip(o.object.properties.id)} />
          {/* <NavigationControl /> */}
          {drawControlOn && 
            <DrawControl onFinish={drawingFinished} />}
          <ScaleControl position="bottom-right" />
        </Map>
        <ZoomChangeListener map={mapRef.current} onChange={onChangeZoom} />
      </div>
      <CoordinatesPane mapRef={mapRef} />
      <LineChart hasDensity={hasDensity} timestamps={rawData.timestamps} cumValues={cumValues} cumDensityValues={cumDensityValues} cumHueValues={cumHueValues} cumHueDensityValues={cumHueDensityValues} measurementName={measurement.name} hueMeasurementName={hueMeasurement.name} chartPointColor={chartPointColor} selectedSquaresNum={selectedSquares.length} heightMeasurementDescription={heightMeasurementDescription} hueMeasurementDescription={hueMeasurementDescription} />
    </div>
  );
}

export default App;
