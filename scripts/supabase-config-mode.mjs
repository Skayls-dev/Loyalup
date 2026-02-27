import fs from 'node:fs'
import path from 'node:path'

const mode = process.argv[2]
const allowedModes = new Set(['local', 'prod', 'check-prod'])

if (!mode || !allowedModes.has(mode)) {
  console.error('Usage: node scripts/supabase-config-mode.mjs <local|prod|check-prod>')
  process.exit(1)
}

const configPath = path.resolve(process.cwd(), 'supabase', 'config.toml')
let config = fs.readFileSync(configPath, 'utf8')

const targets = ['generate-qr', 'validate-qr', 'credit-points', 'unlock-reward']

function setFunctionVerifyJwt(input, functionName, value) {
  const blockRegex = new RegExp(`(\\[functions\\.${functionName}\\][\\s\\S]*?verify_jwt\\s*=\\s*)(true|false)`, 'm')

  if (!blockRegex.test(input)) {
    return input
  }

  return input.replace(blockRegex, `$1${value}`)
}

if (mode === 'check-prod') {
  const hasUnsafe = targets.some((functionName) => {
    const blockRegex = new RegExp(`\\[functions\\.${functionName}\\][\\s\\S]*?verify_jwt\\s*=\\s*false`, 'm')
    return blockRegex.test(config)
  })

  if (hasUnsafe) {
    console.error('Unsafe config detected: one or more functions have verify_jwt = false')
    process.exit(2)
  }

  console.log('Supabase function JWT config is production-safe.')
  process.exit(0)
}

const nextValue = mode === 'local' ? 'false' : 'true'
for (const functionName of targets) {
  config = setFunctionVerifyJwt(config, functionName, nextValue)
}

fs.writeFileSync(configPath, config, 'utf8')
console.log(`Updated supabase/config.toml to mode: ${mode} (verify_jwt=${nextValue})`)
