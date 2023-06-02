import Page from '@/components/Page'

const prismSizes = [
  {caption: "Small", size: 500},
  {caption: "Medium", size: 1000},
  {caption: "Large", size: 1500}
];

const defaultPrismSize = prismSizes[1];


export default function Home() {
  return (
    <Page 
      initialViewState={{longitude: -9.154608, latitude: 38.748996, zoom: 16, pitch: 30}}
      hasDensity={false}
      backendUrl="http://localhost:5001"
      measurements={[
          {name: "all", description: "all", unit: "devices", max: 1200},
          {name: "only_randoms", description: "only_randoms", unit: "devices", max: 800},
          {name: "no_randoms", description: "no_randoms", unit: "devices", max: 500}]}
      prismSizes={prismSizes}
      defaultPrismSize={defaultPrismSize}
      hasLive={true}
      columnRadius={5} />
  )
}
