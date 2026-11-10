import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'

const migrations = new URL('../migrations/', import.meta.url)
const names = (await readdir(migrations)).filter(name => /^\d+_.+\.sql$/.test(name)).sort()
const header = '-- LipaHub: NEW EMPTY PROJECT ONLY. Run once in the intended Supabase SQL editor.\n-- Existing installations must apply only missing individual migrations.\n\n'
const source = await Promise.all(names.map(async name => `-- Migration: ${name}\n${await readFile(new URL(name, migrations), 'utf8')}\n`))
await mkdir(new URL('../setup/', import.meta.url), { recursive: true })
await writeFile(new URL('../setup/new-project.sql', import.meta.url), header + source.join('\n'))
console.log(`Prepared new-project setup from ${names.length} migrations.`)
