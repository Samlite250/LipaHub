import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const siteUrl = (import.meta.env.VITE_SITE_URL || 'https://lipahub1.vercel.app').replace(/\/+$/, '')
const defaultImage = `${siteUrl}/og-image.png`

type SeoEntry = {
  title: string
  description: string
  path: string
  noindex?: boolean
  jsonLd?: Record<string, unknown>
}

const pages: Record<string, SeoEntry> = {
  '/': {
    title: 'LipaHub | Online Work, Digital Skills & Earn Online Worldwide',
    description: 'LipaHub is a global learning and community hub for digital skills, online work, Akazikeza, earn-online education and trading simulations. Built in East Africa, open worldwide. No guaranteed earnings.',
    path: '/',
  },
  '/about': {
    title: 'About LipaHub | Global Learning Hub Built in East Africa',
    description: 'Learn what LipaHub is, how it works globally, and how it approaches digital skills, community, simulations and transparent online opportunities.',
    path: '/about',
    jsonLd: { '@context': 'https://schema.org', '@type': 'AboutPage', name: 'About LipaHub', url: `${siteUrl}/about`, description: 'LipaHub is a global learning and community hub built in East Africa.', isPartOf: { '@id': `${siteUrl}/#website` } },
  },
  '/global': {
    title: 'LipaHub Global | Online Work & Digital Skills Worldwide',
    description: 'LipaHub works globally. Explore learning, community, digital skills, online work and Akazikeza guidance from anywhere in the world. No guaranteed earnings.',
    path: '/global',
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'LipaHub Global', url: `${siteUrl}/global`, description: 'LipaHub is a global learning, community and digital-skills platform built in East Africa and open worldwide.', isPartOf: { '@id': `${siteUrl}/#website` }, about: { '@id': `${siteUrl}/#organization` }, audience: { '@type': 'Audience', audienceType: 'Global learners and online workers' } },
  },
  '/east-africa': {
    title: 'LipaHub East Africa | Rwanda, Uganda, Kenya & Burundi',
    description: 'Explore LipaHub across East Africa, including Rwanda, Uganda, Kenya and Burundi, with learning resources, community and global opportunity guidance.',
    path: '/east-africa',
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'LipaHub East Africa', url: `${siteUrl}/east-africa`, description: 'LipaHub learning and community across Rwanda, Uganda, Kenya and Burundi, connected to a global platform.', isPartOf: { '@id': `${siteUrl}/#website` }, about: { '@id': `${siteUrl}/#organization` } },
  },
  '/online-work': {
    title: 'Online Work Worldwide | Akazikeza & Digital Skills | LipaHub',
    description: 'A practical global guide to online work, digital skills, Akazikeza searches, remote jobs and earn-online opportunities, with clear warnings about income promises.',
    path: '/online-work',
    jsonLd: { '@context': 'https://schema.org', '@type': 'Article', headline: 'Online work and digital skills worldwide', description: 'Practical guidance for evaluating online work, Akazikeza searches and digital-skills opportunities worldwide.', url: `${siteUrl}/online-work`, author: { '@id': `${siteUrl}/#organization` }, publisher: { '@id': `${siteUrl}/#organization` }, inLanguage: 'en' },
  },
  '/business': {
    title: 'LipaHub Business | Global Learning & Community Partnerships',
    description: 'Learn about LipaHub Business, future partnership opportunities, learning content and community collaboration across East Africa and worldwide.',
    path: '/business',
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'LipaHub Business', url: `${siteUrl}/business`, description: 'Planned LipaHub learning, content and community partnerships across East Africa and worldwide.', isPartOf: { '@id': `${siteUrl}/#website` }, about: { '@id': `${siteUrl}/#organization` } },
  },
  '/install': {
    title: 'Install the LipaHub App | Learn and Connect on Mobile',
    description: 'Install LipaHub on your phone for faster access to learning resources, community, support and your member dashboard.',
    path: '/install',
  },
  '/terms': {
    title: 'LipaHub Terms of Use',
    description: 'Read the LipaHub terms of use for the development preview, educational simulations and member accounts.',
    path: '/terms',
  },
  '/privacy': {
    title: 'LipaHub Privacy Notice',
    description: 'Read how LipaHub handles account, demo, payment-proof and browser-storage data in the development preview.',
    path: '/privacy',
  },
  '/login': {
    title: 'Sign in to LipaHub',
    description: 'Sign in to your LipaHub member account.',
    path: '/login',
    noindex: true,
  },
  '/register': {
    title: 'Create a LipaHub Account',
    description: 'Create a LipaHub account to access learning resources, community and support.',
    path: '/register',
    noindex: true,
  },
  '/forgot-password': {
    title: 'Reset your LipaHub Password',
    description: 'Request a LipaHub password reset link.',
    path: '/forgot-password',
    noindex: true,
  },
  '/reset-password': {
    title: 'Choose a New LipaHub Password',
    description: 'Choose a new password for your LipaHub account.',
    path: '/reset-password',
    noindex: true,
  },
  '/activate-account': {
    title: 'Activate your LipaHub Account',
    description: 'Complete the required account activation steps.',
    path: '/activate-account',
    noindex: true,
  },
}

function entryFor(pathname: string): SeoEntry {
  const exact = pages[pathname]
  if (exact) return exact
  if (pathname.startsWith('/dashboard')) return {
    title: 'Member Dashboard | LipaHub',
    description: 'Your private LipaHub member dashboard.',
    path: pathname,
    noindex: true,
  }
  if (pathname.startsWith('/admin')) return {
    title: 'Admin Console | LipaHub',
    description: 'Private LipaHub administration.',
    path: pathname,
    noindex: true,
  }
  if (pathname.startsWith('/i/')) return {
    title: 'LipaHub Invitation',
    description: 'Open a LipaHub invitation.',
    path: pathname,
    noindex: true,
  }
  return {
    title: 'Page Not Found | LipaHub',
    description: 'The page you requested could not be found.',
    path: pathname,
    noindex: true,
  }
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.content = content
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!element) {
    element = document.createElement('link')
    element.rel = 'canonical'
    document.head.appendChild(element)
  }
  element.href = href
}

function setPageJsonLd(data?: Record<string, unknown>) {
  const existing = document.getElementById('lipahub-page-jsonld')
  if (!data) { existing?.remove(); return }
  const script = existing instanceof HTMLScriptElement ? existing : document.createElement('script')
  script.id = 'lipahub-page-jsonld'
  script.type = 'application/ld+json'
  script.textContent = JSON.stringify(data)
  if (!existing) document.head.appendChild(script)
}

export function SeoManager() {
  const { pathname } = useLocation()
  useEffect(() => {
    const entry = entryFor(pathname)
    const canonical = entry.path === '/' ? `${siteUrl}/` : `${siteUrl}${entry.path}`
    document.title = entry.title
    setMeta('name', 'description', entry.description)
    setMeta('name', 'robots', entry.noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1')
    setMeta('property', 'og:title', entry.title)
    setMeta('property', 'og:description', entry.description)
    setMeta('property', 'og:url', canonical)
    setMeta('property', 'og:image', defaultImage)
    setMeta('name', 'twitter:title', entry.title)
    setMeta('name', 'twitter:description', entry.description)
    setMeta('name', 'twitter:image', defaultImage)
    setCanonical(canonical)
    setPageJsonLd(entry.jsonLd)
  }, [pathname])
  return null
}
