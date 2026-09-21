import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

const beaconToken = import.meta.env.VITE_CF_BEACON
if (beaconToken) {
  const beacon = document.createElement('script')
  beacon.defer = true
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js'
  beacon.dataset.cfBeacon = JSON.stringify({ token: beaconToken })
  document.head.appendChild(beacon)
}

export default app
