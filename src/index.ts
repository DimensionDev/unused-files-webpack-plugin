import type { IOptions as GlobOptions } from 'glob'
import { glob } from 'glob'
import path from 'path'
import { promisify } from 'util'
import type { Compilation, Compiler } from 'webpack'
import { WebpackError } from 'webpack'

const toGlob = promisify(glob)

export interface UnusedFilesPluginOptions {
  patterns: string[]
  failOnUnused: boolean
  globOptions: GlobOptions
}

export class UnusedFilesPlugin {
  /** @internal */
  private options: UnusedFilesPluginOptions

  constructor(options?: Partial<UnusedFilesPluginOptions>) {
    this.options = {
      patterns: options?.patterns ?? [`**/*.*`],
      failOnUnused: options?.failOnUnused ?? true,
      globOptions: { ignore: 'node_modules/**/*', ...options?.globOptions },
    }
  }

  apply(compiler: Compiler) {
    compiler.hooks.afterEmit.tapAsync(UnusedFilesPlugin.name, this.applyAfterEmit.bind(this))
  }

  /** @internal */
  private async applyAfterEmit(compilation: Compilation) {
    const { patterns, failOnUnused, globOptions } = this.options
    const cwd = compilation.compiler.context
    try {
      const fileDepsMap = getFileDepsMap(compilation)
      const files = await unfoldPatterns(patterns, { cwd, ...globOptions })
      const unused = files.filter((it) => !fileDepsMap.has(path.join(cwd, it)))
      if (unused.length !== 0) {
        throw new Error(`found some unused files: ${unused.join(`\n`)}`)
      }
    } catch (err: unknown) {
      if (failOnUnused && compilation.bail) {
        throw err
      } else if (err instanceof WebpackError) {
        const errors = compilation[failOnUnused ? 'errors' : 'warnings']
        errors.push(err)
      }
    }
  }
}

export default UnusedFilesPlugin

async function unfoldPatterns(patterns: string[], options: GlobOptions) {
  const matchedFiles: string[] = []
  for (const pattern of patterns) {
    matchedFiles.push(...(await toGlob(pattern, options)))
  }
  return matchedFiles
}

function getFileDepsMap({ assets, fileDependencies }: Compilation) {
  const fileDepsBy = new Set(fileDependencies)
  for (const relpath of Object.keys(assets)) {
    const existsAt = Reflect.get(assets[relpath], 'existsAt')
    if (typeof existsAt === 'string') {
      fileDepsBy.add(existsAt)
    }
  }
  return fileDepsBy
}
