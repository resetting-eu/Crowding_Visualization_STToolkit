import Page from '@/components/Page'

const prismSizes = [
  {caption: "Small", size: 400},
  {caption: "Medium", size: 800},
  {caption: "Large", size: 1200}
];

const defaultPrismSize = prismSizes[1];


export default function Home() {
  return (
    <Page 
      initialViewState={{longitude: -9.154608, latitude: 38.748996, zoom: 16, pitch: 30}}
      hasDensity={false}
      backendUrl="http://localhost:5001"
      measurements={[
          {name: "all", description: "all", unit: "devices", max: 748},
          {name: "only_randoms", description: "only_randoms", unit: "devices", max: 655},
          {name: "no_randoms", description: "no_randoms", unit: "devices", max: 101}]}
      prismSizes={prismSizes}
      defaultPrismSize={defaultPrismSize}
      hasLive={true}
      columnRadius={5} />
  )
}
