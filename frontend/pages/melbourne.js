import Page from '@/components/Page'

export default function Home() {
  return (
    <Page 
      locale="en-au"
      timezone="Australia/Melbourne"
      initialViewState={{longitude: 144.97169395, latitude: -37.81862929, zoom: 14, pitch: 30}}
      hasDensity={false}
      measurements={[
          {name: "total_of_directions", description: "Sum of 2 directions", unit: "pedestrians", max: 100, maxHistory: 1500},
          {name: "direction_1", description: "Direction 1", unit: "pedestrians", max: 50, maxHistory: 1000},
          {name: "direction_2", description: "Direction 2", unit: "pedestrians", max: 50, maxHistory: 1000}]}
      hasLive={true}
      columnRadius={8} />
  )
}
