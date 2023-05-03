// This endpoint is a script that is meant to be run once.
// Its output should be saved to a file that will be used by the Flask backend.

import { GRID_URL } from '@/components/Config';

import { booleanIntersects } from '@turf/turf';

import { readFile } from 'node:fs/promises';


export default async function handler(req, res) {
  const gridRes = await fetch(GRID_URL);
  const grid = await gridRes.json();

  const parishesString = await readFile("data/lisbonParishes.json", "utf8");
  const parishes = JSON.parse(parishesString).features;

  const parishesCells = [];

  for(const parish of parishes) {
    const parishCells = {name: parish.properties.NOME, cells: []};
    for(const cell of grid) {
      if(booleanIntersects(parish, cell)) {
        parishCells.cells.push(cell.properties.id);
      }
    }
    parishesCells.push(parishCells);
  }

  res.status(200).json(parishesCells);
}
