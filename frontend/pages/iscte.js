import Page from '@/components/Page'

export default function Home() {
  return (
    <Page 
      locale="pt"
      timezone="Europe/Lisbon"
      initialViewState={{longitude: -9.154608, latitude: 38.748996, zoom: 16, pitch: 30}}
      hasDensity={false}
      backendUrl="http://localhost:5001"
      measurements={[
          {name: "all", description: "all", unit: "devices", max: 748},
          {name: "only_randoms", description: "only_randoms", unit: "devices", max: 655},
          {name: "no_randoms", description: "no_randoms", unit: "devices", max: 101}]}
      hasLive={true}
      columnRadius={5} />
  )
}
