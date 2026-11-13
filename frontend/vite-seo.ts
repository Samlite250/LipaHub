import type { Plugin } from 'vite'

type SeoRoute = { path: string; priority: string; changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly' }

const routes: SeoRoute[] = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/about', priority: '0.8', changefreq: 'monthly' },
  { path: '/east-africa', priority: '0.8', changefreq: 'monthly' },
  { path: '/online-work', priority: '0.8', changefreq: 'monthly' },
  { path: '/business', priority: '0.7', changefreq: 'monthly' },
  { path: '/install', priority: '0.5', changefreq: 'monthly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
]

function normalizeSiteUrl(value: string) {
  return value.trim().replace(/\/+$/, '')
}

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function sitemap(siteUrl: string) {
  const lastmod = new Date().toISOString().slice(0, 10)
  const urls = routes.map(route => {
    const loc = route.path === '/' ? `${siteUrl}/` : `${siteUrl}${route.path}`
    return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${route.changefreq}</changefreq>\n    <priority>${route.priority}</priority>\n  </url>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

function robots(siteUrl: string) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin',
    'Disallow: /dashboard',
    'Disallow: /activate-account',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /reset-password',
    'Disallow: /forgot-password',
    'Disallow: /i/',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n')
}

export function seoPlugin(rawSiteUrl: string): Plugin {
  const siteUrl = normalizeSiteUrl(rawSiteUrl)
  const files: Record<string, { body: string; type: string }> = {
    '/robots.txt': { body: robots(siteUrl), type: 'text/plain; charset=utf-8' },
    '/sitemap.xml': { body: sitemap(siteUrl), type: 'application/xml; charset=utf-8' },
  }
  return {
    name: 'lipahub-seo',
    transformIndexHtml(html) {
      return html.replaceAll('%SITE_URL%', siteUrl)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] || ''
        const file = files[path]
        if (!file) { next(); return }
        res.statusCode = 200
        res.setHeader('Content-Type', file.type)
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
        res.end(file.body)
      })
    },
    generateBundle() {
      for (const [fileName, file] of Object.entries(files)) {
        this.emitFile({ type: 'asset', fileName: fileName.slice(1), source: file.body })
      }
    },
  }
}
