// ***************************
// Change these constants to true in order to fetch local data from the backend
// ***************************
export const LOCAL_MONGODB = false;
export const LOCAL_INFLUXDB = false;
// ***************************

export const PRISM_SIZES = [
    {caption: "Small", size: 1000},
    {caption: "Medium", size: 2000},
    {caption: "Large", size: 3000}
];

export const DEFAULT_PRISM_SIZE = PRISM_SIZES[1];
