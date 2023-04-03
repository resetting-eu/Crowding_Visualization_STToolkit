import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import {center} from '@turf/turf';

dayjs.extend(localizedFormat);

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

export function abbreviateValue(value) {
  if(value >= 10000)
    return value / 1000 + "K";
  else
    return value;
}

export function formatTimestamp(timestamp) {
  const dateObj = dayjs(timestamp, "YYYY-MM-DDTHH:mm:ss");
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
