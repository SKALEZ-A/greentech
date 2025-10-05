# Carbon Capture Network - Public Assets

This directory contains static assets served directly by the Next.js application.

## Files Overview

### Web App Manifest & Icons
- `manifest.json` - Progressive Web App configuration
- `favicon.ico` - Browser favicon (replace with actual .ico file)
- `browserconfig.xml` - Internet Explorer/Edge tile configuration

### SEO & Discovery
- `robots.txt` - Search engine crawling instructions
- `sitemap.xml` - XML sitemap for search engines
- `humans.txt` - Credits and information about the team

### Advertising & Security
- `ads.txt` - Authorized digital sellers for programmatic advertising
- `security.txt` - Security policy and contact information

## Development Notes

- All files in this directory are served at the root path (e.g., `/robots.txt`)
- Static assets should be optimized and compressed
- Icons should be generated in multiple sizes for different devices
- Update sitemap.xml when adding new pages

## Asset Optimization

For production deployment:
1. Generate favicons using tools like RealFaviconGenerator
2. Optimize images and compress assets
3. Update manifest.json with correct icon paths
4. Validate all files using appropriate linters
