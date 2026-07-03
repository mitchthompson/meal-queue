import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      // The recipe-import MCP server is a separate package with its own build
      // (mcp/dist/*) and toolchain — out of scope for the app's lint (CLAUDE.md).
      'mcp/**',
      'next-env.d.ts',
    ],
  },
]

export default eslintConfig
