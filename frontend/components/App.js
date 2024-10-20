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
import FastForwardIcon from '@mui/icons-material/FastForward';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import TextField from '@mui/material/TextField';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ManageHistoryIcon from '@mui/icons-material/ManageHistory';
import TroubleshootIcon from '@mui/icons-material/Troubleshoot';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';

import customParseFormat from "dayjs/plugin/customParseFormat";

import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import MapboxDrawStyles from './MapboxDrawStyles';

import { booleanContains, point, center } from '@turf/turf';

import { dayjs, dayjsSetLocaleAndTimezone, timestampBetween, nearestTimestampIndexAbove, formatTimestamp, maxFromArray, minFromArray, nextLocalMaxIndex, prevLocalMaxIndex, getRgbForPercentage, getRgbForPercentageSameHue } from './Utils';
import Toolbar from './Toolbar';
import StatusPane from './StatusPane';
import CustomSlider from './CustomSlider';
import CustomColumnLayer from './custom_column_layer/column-layer';
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
  viewingLivePaused: {caption: "Live update paused"},
  loadingPrediction: {caption: "Loading predictive data...", loading: true},
  viewingPrediction: {caption: "Viewing predictive data"},
  animating: {},
  noData: {caption: "No data loaded"}
}

const quartiles = {
  Q0: 0,
  Q1: 1,
  Q2: 2,
  Q3: 3,
  Q4: 4
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


  function getDataValue(o, quartile) {
    if(typeof o === "object") {
      if(o === null) {
        return 0;
      } else if(quartile === undefined) {
        return o[quartiles.Q2];
      } else {
        return o[quartile];
      }
    } else {
      return o;
    }
  }

  function getValue(location, quartile) {
    const value = values[location];
    return getDataValue(value, quartile);
  }

  const [parishValue, setParishValue] = useState("");

  const [loadPane, setLoadPane] = useState("history");

  function changeLoadPane(_, v) {
    if(v && !status.loading) {
      setLoadPane(v);
    }
  }

  const [start, setStart] = useState("2022-06-01T00:00:00Z");
  const [end, setEnd] = useState("2022-06-01T03:00:00Z");
  const [everyNumber, setEveryNumber] = useState("1");
  const [everyUnit, setEveryUnit] = useState("h");
  const [loadSelectedSquaresOnly, setLoadSelectedSquaresOnly] = useState(false);

  const [selectedTimestamp, setSelectedTimestamp] = useState(0);
  // the next two refs are used for live mode only
  const selectedTimestampValue = useRef(null);
  const selectedTimestampIsLast = useRef(true);

  function changeSelectedTimestamp(value) {
    if(rawData.values) {
      setSelectedTimestamp(value);
      selectedTimestampValue.current = rawData.timestamps[value];
      selectedTimestampIsLast.current = value === rawData.timestamps.length - 1;
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
      setNextTimeout();
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
        const timestampIndex = data.timestamps.length - 1;
        setSelectedTimestamp(timestampIndex);
        selectedTimestampValue.current = data.timestamps[timestampIndex];
        selectedTimestampIsLast.current = true;
      });
  }

  const client_id = useRef(null);

  function getPredictionClientId() {
    return new Promise((resolve, reject) => {
      const intervalId = setInterval(() => {
        console.log("polling /prediction to get clientId");
        fetch(backendUrl + "/prediction", {credentials: "include"})
          .then(r => {gotoLoginIf401(r); return r.json()})
          .then(data => {
            if(data.client_id) {
              clearInterval(intervalId);
              resolve(data.client_id);
            }
          })
      }, 5000)
    }); 
  }

  function getPredictionValues() {
    return new Promise((resolve, reject) => {
      fetch(backendUrl + "/prediction?client_id=" + client_id.current, {credentials: "include"})
        .then(r => {gotoLoginIf401(r); return r.json()})
        .then(data => resolve(data));
    });
  }

  function loadPrediction() {
    changeStatus(statuses.loadingPrediction);
    getPredictionClientId()
      .then(v => {
        client_id.current = v;
        return getPredictionValues();
      })
      .then(data => {
        changeStatus(statuses.viewingPrediction);
        setRawData(data);
      })
      .catch(e => {
        console.error(`error while loading prediction: ${e}`);
      });
  }

  useEffect(() => {
    if(!rawData.values)
      return;

    setValues(valuesToVisualize(rawData, selectedTimestamp, measurement));
    changeCumValues(measurement, hueMeasurement);
    if(rawData.client_id)
      client_id.current = rawData.client_id;
    else if(currentStatusIs(statuses.viewingHistory))
      changeSelectedTimestamp(0);

    // TODO is this log useful? maybe place it somewhere after the rerendering caused by the state setters here
    console.log(`post-load time: ${(Date.now() - tC_start) / 1000}`)
  }, [rawData]);

  const setNextTimeout = () => {
    if(currentStatusIs(statuses.viewingLive))
      setTimeout(loadLiveNewData, 10 * 1000);
  }

  function loadLiveNewData() {
    const url = backendUrl + "/live";
    fetch(url, {credentials: "include"})
      .then(r => {gotoLoginIf401(r); return r.json()})
      .then(data => {
        if(!data.timestamps || data.timestamps.length === 0) {
          setNextTimeout();
        } else {
          if(currentStatusIs(statuses.viewingLive)) {
            if(data.timestamps.includes(selectedTimestampValue.current)) {
              setRawData(data);
              changeSelectedTimestamp(data.timestamps.indexOf(selectedTimestampValue.current));
              setNextTimeout();
            } else if(selectedTimestampIsLast.current && timestampBetween(selectedTimestampValue.current, data.timestamps[0], data.timestamps.at(-1))) {
              setRawData(data);
              changeSelectedTimestamp(nearestTimestampIndexAbove(selectedTimestampValue.current, data.timestamps));
              setNextTimeout();
            } else {
              changeStatus(statuses.viewingLivePaused);
            }
          }
        }
      });
  }


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
    const value = getDataValue(m[selectedTimestamp]);
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

  function transformCumValuesToList(data, visualization, measurement, quartile) {
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
        const v = getDataValue(squareMeasurements[i], quartile);
        const squareMeasurement = v ? v : 0;
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
  }

  const [drawing, setDrawing] = useState(false);
  const [drawControlOn, setDrawControlOn] = useState(false);

  useEffect(() => setDrawControlOn(drawing), [drawing]);

  function drawingFinished(polygon) {
    setTimeout(() => {
      if(polygon) {
        let squares = []; // squares that intersect the polygon
        for(const s of grid) {
          let position;
          if(s.properties.longitude !== undefined && s.properties.latitude !== undefined) {
            position = [s.properties.longitude, s.properties.latitude];
          } else {
            position = center(s).geometry.coordinates;
          }
          const p = point(position);
          if(booleanContains(polygon, p)) {
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
  const [hoveredSquare, setHoveredSquare] = useState(null);
  
  function toggleSquare(location) {
    const squares = new Set(selectedSquares);
    if(squares.has(location)) {
      squares.delete(location);
    } else {
      squares.add(location);
    }
    setSelectedSquares(Array.from(squares));
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
    const ca = getRgbForPercentage(nv, true);
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
    const mainValue = Math.round(getValue(location));
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
    if(currentStatusIs(statuses.viewingLivePaused)) {
      loadLive();
    }
  }

  function changeMeasurement(e) {
    const m = e.target.value;
    setMeasurement(m);
    if(m == hueMeasurement)
      setHueMeasurement(hueMeasurements[0]); // None
    if(rawData.values) {
      setValues(valuesToVisualize(rawData, selectedTimestamp, m));
      changeCumValues(m, hueMeasurement);
    }
    if(visualizeUncertainty && !m.hasQuartiles) {
      setVisualizeUncertainty(false);
    }
  }

  function changeHueMeasurement(m) {
    setHueMeasurement(m);
    if(rawData.values) {
      changeCumValues(measurement, m);
    }
  }

  const [visualizeUncertainty, setVisualizeUncertainty] = useState(false);

  const [cumQ0Values, setCumQ0Values] = useState(null);
  const [cumQ4Values, setCumQ4Values] = useState(null);

  function changeUncertaintySwitch(e) {
    if(e.target.checked) {
      if(hueMeasurement !== hueMeasurements[0]) {
        changeHueMeasurement(hueMeasurements[0]);
      }
      setVisualizeUncertainty(true);
    } else {
      setVisualizeUncertainty(false);
    }
  }

  useEffect(() => {
    if(visualizeUncertainty) {
      setCumQ0Values(transformCumValuesToList(rawData, "absolute", measurement, quartiles.Q0));
      setCumQ4Values(transformCumValuesToList(rawData, "absolute", measurement, quartiles.Q4));
    } else {
      setCumQ0Values(null);
      setCumQ4Values(null);
    }
  }, [visualizeUncertainty]);

  const [prismSize, setPrismSize] = useState(zoomToHeight(initialViewState.zoom));

  function measurementMax() {
    return (currentStatusIs(statuses.viewingHistory) && measurement.capHistory) ? measurement.capHistory : measurement.cap;
  }

  function calcElevation(id, quartile) {
    const value = getValue(id, quartile);
    const measurement_max = measurementMax();
    const elevation_max = prismSize;
    return value * elevation_max / measurement_max;
  }

  function valueForHueMeasurement(location) {
    if(rawData.values[hueMeasurement.name][location])
      return getDataValue(rawData.values[hueMeasurement.name][location][selectedTimestamp]);
  }

  function percentageForMeasurement(location) {
    const value = valueForHueMeasurement(location);
    const percentage = Math.min(0.1, value / hueMeasurement.cap / 10);
    return percentage;
  }

  function getRgbForPrismMappedToDensity(location, selected) {
    const magicFactor = 0.1; // TODO make this configurable
    const maxDensity = measurementMax() * magicFactor;
    const density = gridDensity(location); // units per hectare
    const pct = Math.min(0.1 * density / maxDensity, 0.1);
    return getRgbForPercentage(pct, selected);
  }

  function calcPrismColor(location) {
    if(!rawData.values[measurement.name][location])
      return null;
    const selected = selectedSquares.includes(location) || selectedSquares.length === 0;
    if(hueMeasurement.name == "Density")
      return getRgbForPrismMappedToDensity(location, selected);
    else if(hueMeasurement.name == "None")
      return getRgbForPercentageSameHue(selected);
    else
      return getRgbForPercentage(percentageForMeasurement(location), selected);
  }

  const [showData, setShowData] = useState("all"); // "all" | "selected" | "none"
  const [showAreas, setShowAreas] = useState("selected");

  function getPosition(square) {
    if(!square || getValue(square.properties.id) === undefined)
      return null;
    if(showData === "all" || (showData === "selected" && selectedSquares.includes(square.properties.id))) {
      if(square.geometry.type === "Point") {
        return square.geometry.coordinates;
      } else if(square.properties.longitude !== undefined && square.properties.latitude !== undefined) {
        return [square.properties.longitude, square.properties.latitude];
      } else {
        return center(square).geometry.coordinates;
      }
    } else {
      return null;
    }
  }

  function onHover(info) {
    if(info.index === -1) {
      setHoveredSquare(null);
    } else {
      setHoveredSquare(grid.find(s => s.properties.id === info.object.properties.id).properties.id);
    }
  }

  function onClick(info) {
    if(drawing) {
      return;
    }

    toggleSquare(info.object.properties.id);
  }

  function showArea(s) {
    return showAreas === "all" || (showAreas === "selected" && selectedSquares.includes(s.properties.id));
  }

  function gridFillColor(s) {
    if(selectedSquares.includes(s.properties.id)) {
      return [138, 138, 0, 100 * (showArea(s) ? 1 : 0)];
    } else {
      return [0, 0, 0, 0];
    }
  }

  function gridLineWidth(s) {
    if(hoveredSquare === s.properties.id) {
      return 10;
    } else if(showArea(s)) {
      return 5;
    } else {
      return 0;
    }
  }
  
  function gridLineColor(s) {
    if(hoveredSquare === s.properties.id) {
      return [230, 138, 0, 255];
    } else {
      return [120, 120, 120, 255];
    }
  }

  const geoJsonLayer = new GeoJsonLayer({
    id: "quadricula",
    data: grid,
    filled: true,
    getLineWidth: gridLineWidth,
    getLineColor: gridLineColor,
    getFillColor: gridFillColor,
    updateTriggers: {
      getFillColor: [selectedSquares, showAreas],
      getLineColor: [hoveredSquare, showAreas],
      getLineWidth: [hoveredSquare, showAreas, selectedSquares]
    }
  });
  const prismLayer = new CustomColumnLayer({
    id: "columns",
    data: grid,
    pickable: true,
    getQ0toQ3: s =>
      [
        Math.min(calcElevation(s.properties.id, quartiles.Q0), prismSize),
        Math.min(calcElevation(s.properties.id, quartiles.Q1), prismSize),
        Math.min(calcElevation(s.properties.id, quartiles.Q2), prismSize),
        Math.min(calcElevation(s.properties.id, quartiles.Q3), prismSize),
      ],
    getQ4: s => Math.min(calcElevation(s.properties.id, quartiles.Q4), prismSize),
    getPosition: getPosition,
    getFillColor1: s => calcPrismColor(s.properties.id),
    getFillColor2: s => {const c = calcPrismColor(s.properties.id); if(!c) return null; const [r,g,b] = c; return [r,g,b,100]},
    getQuartileColor: [255, 100, 0, 255],
    getTopFaceColor: [255, 0, 0],
    getPaintTopFace: s => getValue(s.properties.id) > measurementMax() ? 1.0 : 0.0,
    radius: columnRadius,
    radiusSmall: columnRadius / 2.0,
    onHover: onHover,
    onClick: onClick,
    getVisualizeUncertainty: s => visualizeUncertainty && typeof(values[s.properties.id]) === "object" ? 1.0 : 0.0,
    material: {
      "ambient": 0.35,
      "diffuse": 0.6,
      "shininess": 32,
      "specularColor": [255, 255, 255]
    },
    updateTriggers: {
      getFillColor1: [values, hueMeasurement, selectedSquares],
      getFillColor2: [values, hueMeasurement, selectedSquares],
      getQ0toQ3: [values, prismSize],
      getQ4: [values, prismSize],
      getPaintTopFace: [values],
      getPosition: [showData, selectedSquares, values],
      getVisualizeUncertainty: [visualizeUncertainty, values]
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
      const firstTimestamp = playDirection === "forwards" ? 0 : rawData.timestamps.length - 1
      changeSelectedTimestamp(firstTimestamp);
      selectedTimestampAnimation.current = firstTimestamp;
      changeStatus(statuses.animating);
      animationInterval.current = setInterval(() => {
        if(playDirection === "forwards") {
          selectedTimestampAnimation.current++;
        } else {
          selectedTimestampAnimation.current--;
        }
        if((playDirection === "forwards" && selectedTimestampAnimation.current >= rawData.timestamps.length)
          || (playDirection === "backwards" && selectedTimestampAnimation.current <= 0)) {
          clearInterval(animationInterval.current);
          changeSelectedTimestamp(selectedTimestampBeforeAnimation.current);
          changeStatus(previousStatusRef.current);
        } else {
          changeSelectedTimestamp(selectedTimestampAnimation.current);
        }
      }, playInterval);  
    } else { // stop animation
      clearInterval(animationInterval.current);
      if(previousStatusIs(statuses.viewingLive) && selectedTimestampAnimation.current < rawData.timestamps.length - 1) {
        changeStatus(statuses.viewingLiveNotTracking);
      } else {
        changeStatus(previousStatusRef.current);
      }
    }
  }

  const [playDirection, setPlayDirection] = useState("forwards");
  const [playInterval, setPlayInterval] = useState(500);
  const animating = currentStatusIs(statuses.animating);
  const playIcon = playDirection === "forwards" ? <PlayArrowIcon/> : <PlayArrowIcon sx={{transform: "scaleX(-1)"}}/>;
  const animateIcon = animating ? <StopIcon/> : playIcon;
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
      <Toolbar freeze={freezeToolbar} defaultPane="Load data" panes={[
        {title: "Load data", icon: <ManageHistoryIcon/>, stayOnFreeze: true,
         description: "Load data into the application",
         content:
          <Stack spacing={2}>
            <ToggleButtonGroup exclusive value={loadPane} onChange={changeLoadPane}>
              <ToggleButton value="history">History</ToggleButton>
              <ToggleButton value="live">Live</ToggleButton>
              <ToggleButton value="prediction">Prediction</ToggleButton>
            </ToggleButtonGroup>
            {loadPane == "history" &&
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
                {loadingHistory ? <CircularProgress /> : <Button variant="contained" onClick={load}>Load</Button>}
              </div>
            </Stack>}
            {loadPane == "live" &&
            (currentStatusIs(statuses.loadingLive) ? <CircularProgress /> : <Button variant="contained" onClick={loadLive}>Load</Button>)}
            {loadPane == "prediction" &&
            (currentStatusIs(statuses.loadingPrediction) ? <CircularProgress /> : <Button variant="contained" onClick={loadPrediction}>Load</Button>)}
          </Stack>},
        {title: "Visibility", icon: <VisibilityIcon/>,
        description: "Choose which cylinders and areas are shown on the map.",
        content:
          <Stack direction="row" spacing={2}>
            <TextField select value={showData} label="Cylinders" onChange={change(setShowData)}>
              <MenuItem value="all" key="all">Show all</MenuItem>
              <MenuItem value="selected" key="selected">Show selected</MenuItem>
              <MenuItem value="none" key="none">Don't show</MenuItem>
            </TextField>
            <TextField select value={showAreas} label="Areas" onChange={change(setShowAreas)}>
              <MenuItem value="all" key="all">Show all</MenuItem>
              <MenuItem value="selected" key="selected">Show selected</MenuItem>
              <MenuItem value="none" key="none">Don't show</MenuItem>
            </TextField>
          </Stack>},
        {title: "Selection", icon: <SelectAllIcon/>,
        description: "Select the area of interest that will be considered for the line chart and for the slider color gradient.",
        content:
          <Stack direction="row" spacing={2} sx={{verticalAlign: "middle"}}>
            <IconButtonWithTooltip tooltip="Draw area of interest" onClick={() => setDrawing(true)} iconComponent={EditIcon} />
            <IconButtonWithTooltip tooltip="Clear selection" onClick={() => setSelectedSquares([])} iconComponent={DeleteIcon} />
            <TextField select label="Parish" value={parishValue} onChange={change(setParishValue)} sx={{minWidth: 200}} >
              {Object.keys(parishesMapping).map(parishName => (
                <MenuItem value={parishName} key={parishName}>{parishName}</MenuItem>
              ))}
            </TextField>
            <Button variant="contained" onClick={() => selectParish(parishesMapping[parishValue])}>Select Parish</Button>
          </Stack>},
        {title: "Metrics", icon: <AssessmentIcon/>,
        description: "Select which metrics are mapped onto which properties of the cylinders. If 'Density' is selected for Hue, the locations' carrying capacities are considered.",
        content:
          <Stack direction="row" spacing={2}>
            <TextField select label="Height" sx={{width: 100}} value={measurement} onChange={changeMeasurement} SelectProps={{renderValue: (m) => m.name}} disabled={loadingHistory} >
              {measurements.map(m => (
                <MenuItem value={m} key={m.name}>{m.name + " - " + m.description}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Hue" sx={{width: 120}} value={hueMeasurement} onChange={e => changeHueMeasurement(e.target.value)} SelectProps={{renderValue: (m) => m.name}} disabled={loadingHistory} >
                {hueMeasurements.map(m => (
                  <MenuItem value={m} key={m.name}>{m.description ? m.name + " - " + m.description : m.name}</MenuItem>
                ))}
            </TextField>
            <FormControlLabel control={<Switch disabled={!measurement.hasQuartiles} checked={visualizeUncertainty} onChange={changeUncertaintySwitch} />} label="Visualize uncertainty" />
          </Stack>},
        {title: "Seek", icon: <FastForwardIcon/>,
        description: "Options for automatic navigation of the temporal dimension.",
        content:
          <Stack direction="row" spacing={2}>
            <IconButton onClick={toggleAnimate}>
              <MUITooltip title={animateToggleButtonTooltip}>
                {animateIcon}
              </MUITooltip>
            </IconButton>
            <TextField select value={playDirection} label="Direction" onChange={change(setPlayDirection)} disabled={animating} size="small">
              <MenuItem value="forwards" key="forwards">Forwards</MenuItem>
              <MenuItem value="backwards" key="backwards">Backwards</MenuItem>
            </TextField>
            <TextField select value={playInterval} label="Speed" onChange={change(setPlayInterval)} disabled={animating} size="small">
              <MenuItem value={1250} key="1250">0.25x</MenuItem>
              <MenuItem value={1000} key="1000">0.5x</MenuItem>
              <MenuItem value={500} key="500">1x</MenuItem>
              <MenuItem value={250} key="250">1.5x</MenuItem>
              <MenuItem value={125} key="125">2x</MenuItem>
            </TextField>
            <IconButtonWithTooltip tooltip="Go to previous critical point" onClick={fastBackward} iconComponent={SkipPreviousIcon} disabled={animating} />
            <IconButtonWithTooltip tooltip="Go to next critical point" onClick={fastForward} iconComponent={SkipNextIcon} disabled={animating} />
          </Stack>},
        // {title: "Points", icon: <TroubleshootIcon/>,
        // description: "Query the data source for interesting periods of data within a date range.",
        // content:
        //   <p>Not implemented yet</p>
        // },
        {title: "Account", icon: <ManageAccountsIcon />,
        description: "Account management options.",
        content:
          <Button variant="contained" onClick={() => window.location.replace("/account")}>Account page</Button>
        }]} />
      <div style={{position: "absolute", top: "0px", left: "60px", right: "0px", zIndex: 100, padding: "10px 25px 10px 25px", borderRadius: "25px", backgroundColor: "rgba(224, 224, 224, 1.0)"}}>
        <Stack direction="row" spacing={2}>
          <CustomSlider value={selectedTimestamp} valueLabelDisplay="auto" onChange={sliderChange} valueLabelFormat={i => rawData.timestamps ? formatTimestamp(rawData.timestamps[i]) : "No data loaded"}  colors={sliderColors} live={currentStatusIs(statuses.viewingLive)}/>
          <Button variant="contained" onClick={liveButtonOnClick} disabled={!hasLive || !currentStatusIs(statuses.viewingLivePaused)}>Live</Button>
        </Stack>
      </div>
      <div style={{position: "absolute", top: "0px", bottom: "0px", width: "100%"}}>
        <Map mapLib={maplibregl} mapStyle={style}
          ref={mapRef}
          initialViewState={initialViewState}
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
      <LineChart hasDensity={hasDensity} timestamps={rawData.timestamps} cumValues={cumValues} cumDensityValues={cumDensityValues} cumHueValues={cumHueValues} cumHueDensityValues={cumHueDensityValues} measurementName={measurement.name} hueMeasurementName={hueMeasurement.name} chartPointColor={chartPointColor} selectedSquaresNum={selectedSquares.length} heightMeasurementDescription={heightMeasurementDescription} hueMeasurementDescription={hueMeasurementDescription} cumQ0Values={cumQ0Values} cumQ4Values={cumQ4Values} />
    </div>
  );
}

export default App;
