import { Globe2 } from 'lucide-react'
import { normalizeCountry } from './domain/countries'

export function CountryFlag({ country: value }: { country: unknown }) {
  const country = normalizeCountry(value)
  if (!country || !['Rwanda', 'Burundi', 'Uganda', 'Kenya', 'South Africa'].includes(country)) {
    return <Globe2 width={22} height={18} role="img" aria-label={country || 'Country not selected'} />
  }

  return <svg className="country-flag" viewBox="0 0 30 20" width="22" height="15" role="img" aria-label={country}>
    {country === 'Rwanda' && <>
      <rect width="30" height="10" fill="#00a1de" />
      <path d="M0 10h30v5H0z" fill="#fad201" /><path d="M0 15h30v5H0z" fill="#20603d" />
      <circle cx="24" cy="4.7" r="2" fill="#e5be01" />
      <path d="M24 1v7.4m-3.7-3.7h7.4m-6.3-2.6 5.2 5.2m0-5.2-5.2 5.2" stroke="#e5be01" strokeWidth=".5" />
    </>}
    {country === 'Burundi' && <>
      <path d="M0 0h30v20H0z" fill="#ce1126" />
      <path d="m0 0 15 10L0 20zm30 0L15 10l15 10z" fill="#1eb53a" />
      <path d="m0 0 30 20M0 20 30 0" stroke="#fff" strokeWidth="3" />
      <circle cx="15" cy="10" r="5.5" fill="#fff" />
      <g fill="#ce1126" stroke="#1eb53a" strokeWidth=".25">
        <path d="m15 6 .4.8h.9l-.5.8.5.8h-.9l-.4.8-.4-.8h-.9l.5-.8-.5-.8h.9z" />
        <path d="m12.6 10.1.4.8h.9l-.5.8.5.8H13l-.4.8-.4-.8h-.9l.5-.8-.5-.8h.9z" />
        <path d="m17.4 10.1.4.8h.9l-.5.8.5.8h-.9l-.4.8-.4-.8h-.9l.5-.8-.5-.8h.9z" />
      </g>
    </>}
    {country === 'Uganda' && <>
      <path d="M0 0h30v20H0z" fill="#000" />
      <path d="M0 3.333h30v3.334H0zM0 13.333h30v3.334H0z" fill="#fcdc04" />
      <path d="M0 6.667h30V10H0zM0 16.667h30V20H0z" fill="#d90000" />
      <circle cx="15" cy="10" r="3.5" fill="#fff" />
      <path d="m14.5 8 .1-1 1-.3.9.6-.9.2-.2 1.3 1 1.2 1.1.6-1.5.4-1.1-.4-.3 1.2.8.6h-2l.7-.6.1-1.4-1.1-.9.9-.7.8.1z" fill="#333" />
      <path d="m14.6 7 .2-.5.8-.1.5.5M16.4 10.2l.9.4-.8.3" stroke="#d90000" strokeWidth=".4" />
    </>}
    {country === 'Kenya' && <>
      <path d="M0 0h30v20H0z" fill="#fff" />
      <path d="M0 0h30v6H0z" fill="#000" /><path d="M0 7h30v6H0z" fill="#bb0000" /><path d="M0 14h30v6H0z" fill="#006600" />
      <path d="m11.5 3 7 14m0-14-7 14" stroke="#fff" strokeWidth=".6" />
      <path d="M15 2.5c-5 3-5 12 0 15 5-3 5-12 0-15" fill="#bb0000" stroke="#fff" strokeWidth=".4" />
      <path d="M12 6c-1 2-1 6 0 8l1-4zm6 0c1 2 1 6 0 8l-1-4z" fill="#000" />
      <path d="M15 3v14" stroke="#fff" strokeWidth=".5" /><ellipse cx="15" cy="10" rx=".8" ry="2" fill="#fff" />
    </>}
    {country === 'South Africa' && <>
      <path d="M0 0h30v10H0z" fill="#e03c31" /><path d="M0 10h30v10H0z" fill="#001489" />
      <path d="m0 0 12 8h18v4H12L0 20" fill="none" stroke="#fff" strokeWidth="4" />
      <path d="m0 0 12 8h18v4H12L0 20z" fill="#007749" />
      <path d="m0 2 12 8L0 18z" fill="#ffb81c" /><path d="m0 4 9 6-9 6z" fill="#000" />
    </>}
  </svg>
}
