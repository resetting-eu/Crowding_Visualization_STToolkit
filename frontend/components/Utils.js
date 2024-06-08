import dayjs from "dayjs";
export {dayjs};
import localizedFormat from "dayjs/plugin/localizedFormat";
import timezonePlugin from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import {center} from '@turf/turf';

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
function getHslForPercentage(pct, highlight) {
  const h = 120 - Math.min(120 * pct / 0.1, 120);
  const s = highlight ? 60 : 30;
  const l = 100;

  return [h, s, l];
}

export function getRgbForPercentage(pct, highlight) {
  const [h, s, l] = getHslForPercentage(pct, highlight);
  return hslToRgb(h / 360, l / 100, s / 100);
}

export function getRgbForPercentageSameHue(highlight) {
  const h = 240;
  const s = highlight ? 60 : 30;
  const l = 100;

  return hslToRgb(h / 360, l / 100, s / 100);  
}
