import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cendre — Survivre ensemble',
    short_name: 'Cendre',
    description: 'Jeu de survie sociale multijoueur autour de la même table.',
    start_url: '/',
    display: 'standalone',
    background_color: '#1b1815',
    theme_color: '#1b1815',
    orientation: 'portrait',
    lang: 'fr',
    icons: [{ src: '/og.png', sizes: '1733x907', type: 'image/png', purpose: 'any' }],
  };
}

