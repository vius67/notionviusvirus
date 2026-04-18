import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Productivity',
    short_name: 'Productivity',
    description: 'Your student productivity hub',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f0f0ff',
    theme_color: '#6366f1',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
    categories: ['education', 'productivity'],
  }
}
