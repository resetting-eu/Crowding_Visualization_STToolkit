// ***************************
// Change these constants to true in order to fetch local data from the backend
// ***************************
export const LOCAL_MONGODB = false;
export const LOCAL_INFLUXDB = false;
// ***************************

// Backend URLs
export const GRID_URL = LOCAL_MONGODB ? "http://localhost:5000/grid_local" : "http://localhost:5000/grid";
export const HISTORY_URL = LOCAL_INFLUXDB ? "http://localhost:5000/data_range_local" : "http://localhost:5000/data_range";
export const LIVE_URL = LOCAL_INFLUXDB ? "http://localhost:5000/mock_stream_local" : "http://localhost:5000/mock_stream";
export const PARISHES_URL = "http://localhost:5000/parishes";

// Main visualization
export const PRISM_SIZES = [
    {caption: "Small", size: 1000},
    {caption: "Medium", size: 2000},
    {caption: "Large", size: 3000}
];

export const DEFAULT_PRISM_SIZE = PRISM_SIZES[1];
