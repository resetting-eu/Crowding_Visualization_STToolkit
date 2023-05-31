import Page from '@/components/Page'

const prismSizes = [
  {caption: "Small", size: 1000},
  {caption: "Medium", size: 2000},
  {caption: "Large", size: 3000}
];

const defaultPrismSize = prismSizes[1];

export default function Home() {
  return (
    <Page 
      initialViewState={{longitude: -9.22502725720, latitude: 38.69209409900, zoom: 15, pitch: 30}}
      hasDensity={true}
      backendUrl="http://localhost:5000"
      measurements={[
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
      ]}
      prismSizes={prismSizes}
      defaultPrismSize={defaultPrismSize}
      hasLive={false} />
  )
}
