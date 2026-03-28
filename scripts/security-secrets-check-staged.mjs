import { execSync } from 'node:child_process'

const EXCLUDED_PATH_PREFIXES = [
  'scripts/security-secrets-',
]

const PATTERNS = [
  { name: 'Supabase JWT-like key', regex: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g },
  { name: 'SumUp secret key', regex: /\bsup_sk_[A-Za-z0-9]+\b/g },
  { name: 'Classic client secret', regex: /\bcc_sk_classic_[A-Za-z0-9]+\b/g },
  { name: 'Service role key literal', regex: /SERVICE_ROLE_KEY\s*=\s*['\"]?(?!__)[^\s'\"]{20,}/g },
]

function getStagedDiff() {
  return execSync('git diff --cached --text', { encoding: 'utf8' })
}

function getStagedFiles() {
  const raw = execSync('git diff --cached --name-only', { encoding: 'utf8' })
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function extractAddedLines(diffText) {
  return diffText
    .split(/\r?\n/)
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1))
    .join('\n')
}

function main() {
  const stagedFiles = getStagedFiles()
  const hasNonExcludedFiles = stagedFiles.some((filePath) => !EXCLUDED_PATH_PREFIXES.some((prefix) => filePath.startsWith(prefix)))
  if (!hasNonExcludedFiles) {
    console.log('[SECURITY] Staged files are scanner internals only; skipping secret gate.')
    return
  }

  const diff = getStagedDiff()
  const addedContent = extractAddedLines(diff)
  const findings = []

  for (const pattern of PATTERNS) {
    const matches = addedContent.match(pattern.regex)
    if (matches && matches.length > 0) {
      findings.push({ pattern: pattern.name, count: matches.length })
    }
  }

  if (findings.length > 0) {
    console.error('[SECURITY] Secret-like value detected in staged changes:')
    for (const finding of findings) {
      console.error(`- ${finding.pattern}: ${finding.count}`)
    }
    console.error('Commit blocked. Remove/redact secrets or move them to secret manager.')
    process.exit(1)
  }

  console.log('[SECURITY] Staged diff secret scan passed.')
}

main()
