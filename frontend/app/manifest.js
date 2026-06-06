export default function manifest() {
  return {
    name: 'Human OS',
    short_name: 'Human OS',
    description: 'The Operating System For Understanding Yourself.',
    start_url: '/',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#050505',
    icons: [
      {
        src: '/app-icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any maskable'
      }
    ]
  };
}
