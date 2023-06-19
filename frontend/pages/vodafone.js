import Page from '@/components/Page'

export default function Home() {
  return (
    <Page 
      initialViewState={{longitude: -9.22502725720, latitude: 38.69209409900, zoom: 15, pitch: 30}}
      hasDensity={true}
      backendUrl="http://localhost:5000"
      measurements={[
        {name: "C1", description: "Number of distinct devices", shortDescription: "all devices", unit: "devices", max: 2454},
        {name: "C2", description: "Number of distinct roaming devices", shortDescription: "roaming", unit: "devices", max: 539},
        {name: "C3", description: "Number of distinct devices that stayed in cell", shortDescription: "staying devices", unit: "devices", max: 2232},
        {name: "C4", description: "Number of distinct roaming devices that stayed in cell", shortDescription: "staying roaming devices", unit: "devices", max: 481.9},
        {name: "C5", description: "Number of distinct devices entering the cell", shortDescription: "entering devices", unit: "devices", max: 801.1},
        {name: "C6", description: "Number of distinct devices exiting the cell", shortDescription: "exiting devices", unit: "devices", max: 812.4},
        {name: "C7", description: "Number of distinct roaming devices entering the cell", shortDescription: "entering roaming devices", unit: "devices", max: 244.3},
        {name: "C8", description: "Number of distinct roaming devices exiting the cell", shortDescription: "exiting roaming devices", unit: "devices", max: 224.5},
        {name: "C9", description: "Number of distinct devices with active data connection", shortDescription: "devices with active data connection", unit: "devices", max: 2380},
        {name: "C10", description: "Number of distinct roaming devices with active data connection", shortDescription: "roaming devices with active data connection", unit: "devices", max: 535.1},
        {name: "C11", description: "Number of voice calls originating from cell", shortDescription: "originating calls", unit: "calls", max: 75.64},
        {name: "E1", description: "Number of voice calls terminating in cell", shortDescription: "terminating calls", unit: "calls", max: 12.47},
        {name: "E2", description: "Average rate of downstream", shortDescription: "average downstream", unit: "rate", max: 412900},
        {name: "E3", description: "Average rate of upstream", shortDescription: "average upstream", unit: "rate", max: 34180},
        {name: "E4", description: "Peak rate of downstream", shortDescription: "peak downstream", unit: "rate", max: 68650000},
        {name: "E5", description: "Peak rate of upstream", shortDescription: "peak upstream", unit: "rate", max: 17800000},
        {name: "E7", description: "Minimum permanence duration", shortDescription: "minimum permanence", unit: "minutes", max: 10},
        {name: "E8", description: "Average permanence duration", shortDescription: "average permanence", unit: "minutes", max: 182.1},
        {name: "E9", description: "Maximum permanence duration", shortDescription: "maximum permanence", unit: "minutes", max: 300},
        {name: "E10", description: "Number of devices that share connection", shortDescription: "devices that share connection", unit: "devices", max: 10},
        {name: "National", description: "Number of distinct devices, not in roaming", shortDescription: "devices not in roaming", unit: "devices", max: 1915}
      ]}
      hasLive={false}
      columnRadius={12} />
  )
}
