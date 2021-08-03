#!/usr/bin/env node
import { promises as fs } from 'fs'
import { glob } from 'glob'
import path from 'path'
import { promisify } from 'util'
import type { StatsCompilation } from 'webpack'

const toGlob = promisify(glob)

async function readCompilation(): Promise<StatsCompilation> {
  const handle = process.stdin as unknown as fs.FileHandle
  return JSON.parse(await fs.readFile(handle, 'utf-8'))
}

async function main(cwd: string) {
  const compilation = await readCompilation()
  const usedFiles = new Set(
    compilation.modules
      ?.filter(({ name }) => name && name.startsWith('./') && !name.includes('./~/'))
      .map(({ name }) => path.join(cwd, name!))
  )
  return (await toGlob('*', { ignore: 'node_modules/**/*' }))
    .filter((name) => usedFiles.has(name))
    .map((name) => path.relative(cwd, name))
}

main(process.env.CWD ?? process.cwd())
  .then((unusedFiles) => unusedFiles.map(console.log))
  .catch(console.error)
