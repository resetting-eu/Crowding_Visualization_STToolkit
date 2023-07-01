import { readFile } from 'node:fs/promises';

// This endpoint is meant for the frontend to fetch the json parish file in /data
export default async function handler(req, res) {
  const {file} = req.query;
  const parishesString = await readFile("data/" + file, "utf8");
  res.setHeader("Content-Type", "application/json");
  res.status(200).send(parishesString);
}
