import dayjs from "dayjs";
export {dayjs};
import localizedFormat from "dayjs/plugin/localizedFormat";
import timezonePlugin from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import {center} from '@turf/turf';
import Delaunator from 'delaunator';
import {det, cross, norm} from 'mathjs';

dayjs.extend(localizedFormat);
dayjs.extend(timezonePlugin);
dayjs.extend(utc);

let dayjsLocaleSet = false;
let timezone;
// function to be called by module that imports Utils
export function dayjsSetLocaleAndTimezone(locale, tz) {
  import(`dayjs/locale/${locale}.js`).then(() => dayjs.locale(locale));
  timezone = tz;
  dayjsLocaleSet = true; // now we can use the dayjs object (using function below)
}

// make sure to use this getter in internal code of this module, instead of dayjs directly
function dayjsObj() {
  console.assert(dayjsLocaleSet);
  return dayjs;
}

const utmObj = require('utm-latlng');
const utm = new utmObj();

export function concatDataIndexes(old_length, new_length, max_buffer_size) {
    const total_length = old_length + new_length;
    let first_old = 0;
    let first_new = 0;
    if(total_length > max_buffer_size) {
        if(new_length >= max_buffer_size) {
            first_new = new_length - max_buffer_size;
            first_old = old_length;
        } else if(old_length >= max_buffer_size) {
            first_old = old_length - (max_buffer_size - new_length);
            first_new = Math.max(0, new_length - max_buffer_size);
        } else {
            first_old = old_length + new_length - max_buffer_size;
            first_new = 0;
        }
    }
    return {first_old, first_new};
}

function abbreviateValue(value) {
  if(value >= 1000000)
    return value / 1000000 + "M";
  else if(value >= 10000)
    return value / 1000 + "K";
  else
    return value;
}

export function formatValue(floatNumber) {
  const integralPart = Math.floor(floatNumber);
  const integralDigits = Math.abs(integralPart).toString().length;
  let decimalDigits = 0;

  if (integralDigits >= 5) {
    return abbreviateValue(integralPart);
  } else if (integralDigits === 3) {
    decimalDigits = 1;
  } else if (integralDigits === 2) {
    decimalDigits = 2;
  } else if (integralDigits === 1) {
    decimalDigits = 3;
  } else if (integralDigits === 0) {
    decimalDigits = 4;
  }
  
  return floatNumber.toFixed(decimalDigits);
}

// pre: dayjsSetLocaleAndTimezone has been invoked before
export function formatTimestamp(timestamp) {
  let dateObj = dayjsObj().utc(timestamp, "YYYY-MM-DDTHH:mm:ss");
  if(timezone) {
    dateObj = dateObj.tz(timezone);
  }
  return dateObj.format("L LT");
}

export function shrinkSquare(square) {
  const c = center(square).geometry.coordinates;
  const utmRes = utm.convertLatLngToUtm(c[0], c[1], 10);
  const cx = utmRes.Easting;
  const cy = utmRes.Northing;
  const sl = 25 / Math.sqrt(2); // side length
  const s = [[cx - sl, cy - sl], [cx + sl, cy - sl], [cx + sl, cy + sl], [cx - sl, cy + sl], [cx - sl, cy - sl]];
  const res = [s.map(([x, y]) => {
    const coords = utm.convertUtmToLatLng(x, y, utmRes.ZoneNumber, utmRes.ZoneLetter);
    return [coords.lat, coords.lng];
  })];
  return res;
}

export function maxFromArray(a) {
  let res = -Infinity;
  for(const x of a)
    if(x > res)
      res = x;
  return res;
}

export function minFromArray(a) {
  let res = Infinity;
  for(const x of a)
    if(x < res)
      res = x;
  return res;
}

export function nextLocalMaxIndex(a, prevMax) {
  for (let i = 0; i < a.length; i++) {
    if ((i === 0 || a[i] > a[i - 1]) && (i === a.length - 1 || a[i] > a[i + 1])) {
      if (prevMax === null || i > prevMax) {
	      return i;
      }
    }
  }
  
  return null;
}

export function prevLocalMaxIndex(a, nextMax) {
  for (let i = a.length - 1; i >= 0; i--) {
    if ((i === 0 || a[i] > a[i - 1]) && (i === a.length - 1 || a[i] > a[i + 1])) {
      if (nextMax === null || i < nextMax) {
	      return i;
      }
    }
  }
  
  return null;
}

// https://stackoverflow.com/a/9493060
function hslToRgb(h, s, l){
  let r, g, b;

  if(s == 0) {
    r = g = b = l; // achromatic
  } else {
    let hue2rgb = function hue2rgb(p, q, t){
      if(t < 0) t += 1;
      if(t > 1) t -= 1;
      if(t < 1/6) return p + (q - p) * 6 * t;
      if(t < 1/2) return q;
      if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    }

    let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    let p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// 0 -> green (120deg hue)
// 0.1 -> red (0deg hue)
function getHslForPercentage(pct) {
  const h = 120 - Math.min(120 * pct / 0.1, 120);
  const s = 60;
  const l = 100;

  return [h, s, l];
}

export function getRgbForPercentage(pct) {
  const [h, s, l] = getHslForPercentage(pct);
  return hslToRgb(h / 360, l / 100, s / 100);
}

export function lngLatToUtm(lng, lat) {
  const utmRes = utm.convertLatLngToUtm(lat, lng, 10);
  const point = [utmRes.Easting, utmRes.Northing];
  return point;
}

export function utmToLngLat(x, y, zoneLetter, zoneNumber) {
  const coords = utm.convertUtmToLatLng(x, y, zoneNumber, zoneLetter);
  return [coords.lng, coords.lat];
}

function rectanglePointsToBoundaries(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y) {
  let xleft, ytop, xright, ybot;
  for(const x of [p1x, p2x, p3x, p4x]) {
    if(xleft === undefined && xright === undefined) {
      xleft = x;
      xright = x;
    } else if(x > xright) {
      xright = x;
    } else if(x < xleft) {
      xleft = x;
    }
  }
  for(const y of [p1y, p2y, p3y, p4y]) {
    if(ybot === undefined && ytop === undefined) {
      ybot = y;
      ytop = y;
    } else if(y > ytop) {
      ytop = y;
    } else if(y < ybot) {
      ybot = y;
    }
  }
  return {xleft, ytop, xright, ybot};
}

export function subdivideRectangle(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y) {
  const {xleft, ytop, xright, ybot} = rectanglePointsToBoundaries(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y);
  const xmid = (xleft + xright) / 2;
  const ymid = (ybot + ytop) / 2;
  return [
    xleft, ybot, xmid, ybot, xmid, ymid, xleft, ymid,
    xmid, ybot, xright, ybot, xright, ymid, xmid, ymid,
    xleft, ymid, xmid, ymid, xmid, ytop, xleft, ytop,
    xmid, ymid, xright, ymid, xright, ytop, xmid, ytop
  ];
}

export function rectangleToTriangles(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y) {
  const {xleft, ytop, xright, ybot} = rectanglePointsToBoundaries(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y);
  return [
    xleft, ybot, xright, ybot, xright, ytop,
    xright, ytop, xleft, ytop, xleft, ybot
  ];
}

// pre: feat.geometry.type === "Polygon" && feat.geometry.coordinates[0].length === 5
export function featureToPoints(feat) {
  console.assert(feat.geometry.type === "Polygon" && feat.geometry.coordinates[0].length === 5);

  const points = [];
  let ZoneNumber;
  let ZoneLetter;
  for(const coord of feat.geometry.coordinates[0].slice(0, -1)) {
    const utmRes = utm.convertLatLngToUtm(coord[1], coord[0], 10);
    points.push(utmRes.Easting);
    points.push(utmRes.Northing);
    if(ZoneNumber === undefined || ZoneLetter === undefined) {
      ZoneNumber = utmRes.ZoneNumber;
      ZoneLetter = utmRes.ZoneLetter;  
    } else if(ZoneNumber != utmRes.ZoneNumber || ZoneLetter != utmRes.ZoneLetter) {
      console.log("WARNING: Utils.featureToPoints: change in ZoneNumber or ZoneLetter!!!")
      // TODO think about what to do in this situation
    }
  }
  return {points, ZoneNumber, ZoneLetter};
}

export function pointsToFeature(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y, ZoneNumber, ZoneLetter) {
  const coordinates = [];
  for(const [x, y] of [[p1x, p1y], [p2x, p2y], [p3x, p3y], [p4x, p4y]]) {
    const coords = utm.convertUtmToLatLng(x, y, ZoneNumber, ZoneLetter);
    coordinates.push([coords.lng, coords.lat]);
  }
  coordinates.push(coordinates[0]);
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [coordinates]
    }
  };
}

export function gridToTriangulation(grid) {
  const points = [];
  const gridWithCenters = [];
  for(const feat of grid) {
    const c = center(feat).geometry.coordinates;
    const featWithCenter = {
      type: "Feature",
      properties: {id: feat.properties.id, center: c},
      geometry: feat.geometry
    }
    gridWithCenters.push(featWithCenter);
    const utmRes = utm.convertLatLngToUtm(c[0], c[1], 10);
    const point = [utmRes.Easting, utmRes.Northing];
    points.push(point);
  }
  const delaunay = Delaunator.from(points);
  const triangles = delaunay.triangles;
  const features = [];
  for(let i = 0; i < triangles.length; i += 3) {
    features.push({
      type: "Feature",
      properties: {
        ids: [
          gridWithCenters[triangles[i]].properties.id,
          gridWithCenters[triangles[i + 1]].properties.id,
          gridWithCenters[triangles[i + 2]].properties.id,
        ]},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            gridWithCenters[triangles[i]].properties.center,
            gridWithCenters[triangles[i + 1]].properties.center,
            gridWithCenters[triangles[i + 2]].properties.center,
            gridWithCenters[triangles[i]].properties.center
          ]
        ]
      }
    });
  }
  return features;
}

// TODO: acrescentar referência ao paper
export function interpolate(lng, lat, lng1, lat1, lng2, lat2, lng3, lat3, w1, w2, w3) {
  const [x, y] = lngLatToUtm(lng, lat);
  const [x1, y1] = lngLatToUtm(lng1, lat1);
  const [x2, y2] = lngLatToUtm(lng2, lat2);
  const [x3, y3] = lngLatToUtm(lng3, lat3);

  const m = [
    [1, x1, y1],
    [1, x2, y2],
    [1, x3, y3]
  ];
  const a = det(m) / 2;
  const n1 = ((x2*y3 - x3*y2) + x*(y2 - y3) + y*(x3 - x2)) / (2 * a);
  const n2 = ((x3*y1 - x1*y3) + x*(y3 - y1) + y*(x1 - x3)) / (2 * a);
  const n3 = ((x1*y2 - x2*y1) + x*(y1 - y2) + y*(x2 - x1)) / (2 * a);
  return n1*w1 + n2*w2 + n3*w3;
}

export function triangleNormal(p1x, p1y, p1z, p2x, p2y, p2z, p3x, p3y, p3z) {
  const ab = [p2x - p1x, p2y - p1y, p2z - p1z];
  const ac = [p3x - p1x, p3y - p1y, p3z - p1z];
  const n = cross(ab, ac);
  const n_normalized = n.map(x => x / norm(n));
  return n_normalized;
}
