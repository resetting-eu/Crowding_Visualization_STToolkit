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
      initialViewState={{longitude: 144.97169395, latitude: -37.81862929, zoom: 14, pitch: 30}}
      hasDensity={false}
      backendUrl="http://localhost:5002"
      measurements={[
          {name: "total_of_directions", description: "Sum of 2 directions", unit: "pedestrians", max: 100},
          {name: "direction_1", description: "Direction 1", unit: "pedestrians", max: 50},
          {name: "direction_2", description: "Direction 2", unit: "pedestrians", max: 50}]}
      prismSizes={prismSizes}
      defaultPrismSize={defaultPrismSize}
      hasLive={true}
      columnRadius={8} />
  )
}
