import { copyFile, mkdir } from 'node:fs/promises'
import { URL } from 'node:url'

await mkdir(new URL('../dist/config/', import.meta.url), { recursive: true })
await copyFile(new URL('../../shared/robot-catalog.json', import.meta.url), new URL('../dist/config/robot-catalog.json', import.meta.url))

await copyFile(new URL('../../shared/countries.json', import.meta.url), new URL('../dist/config/countries.json', import.meta.url))

await copyFile(new URL('../../shared/proof-limits.json', import.meta.url), new URL('../dist/config/proof-limits.json', import.meta.url))
