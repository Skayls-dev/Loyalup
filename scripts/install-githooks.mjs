import { execSync } from 'node:child_process'

execSync('git config core.hooksPath .githooks', { stdio: 'inherit' })
console.log('Git hooks installed: core.hooksPath=.githooks')
