#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

const [, , inputDir] = process.argv

if (!inputDir) {
    console.error('Usage: meta.mjs <project-folder>')
    process.exit(1)
}

const project = path.basename(inputDir)
const metaPath = path.join(inputDir, 'dist', 'metafile-esm.json')
const prefix = inputDir.endsWith('/') ? inputDir : inputDir + '/'
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))

console.log(`## TSUP Build Summary: ${project}\n`)

const entries = Object.entries(meta.outputs).filter(([_, data]) => data.entryPoint)
const sharedChunks = new Set()

for (const [file, data] of entries) {
    for (const imp of data.imports || []) {
        if (!imp.external && meta.outputs[imp.path]) {
            sharedChunks.add(imp.path)
        }
    }
}

for (const [file, data] of entries) {
    const sizeKb = (data.bytes / 1024).toFixed(1)
    const relativeFile = file.replace(prefix, '')
    const entryPoint = data.entryPoint.replace(/^.*?src\//, 'src/')
    console.log(`- \`${relativeFile}\` (from \`${entryPoint}\`) — ${sizeKb} KB`)
}

for (const file of sharedChunks) {
    const data = meta.outputs[file]
    const sizeKb = (data.bytes / 1024).toFixed(1)
    const relativeFile = file.replace(prefix, '')
    console.log(`- \`${relativeFile}\` (shared chunk) — ${sizeKb} KB`)
}
