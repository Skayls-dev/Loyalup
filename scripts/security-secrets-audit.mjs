import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MAX_FILE_SIZE = 1024 * 1024
const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', '.vercel', '.tmp'])

const SECRET_PATTERNS = [
  { name: 'Supabase JWT-like key', regex: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g },
  { name: 'SumUp secret key', regex: /\bsup_sk_[A-Za-z0-9]+\b/g },
  { name: 'Classic client secret', regex: /\bcc_sk_classic_[A-Za-z0-9]+\b/g },
  { name: 'Generic private key assignment', regex: /(SECRET|TOKEN|API_KEY|SERVICE_ROLE_KEY)\s*=\s*['\"]?(?!__)[A-Za-z0-9._\-]{20,}/gi },
]

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, out)
      continue
    }
    out.push(fullPath)
  }
  return out
}

function shouldScan(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/')
  if (rel.endsWith('.png') || rel.endsWith('.jpg') || rel.endsWith('.jpeg') || rel.endsWith('.gif') || rel.endsWith('.webp')) return false
  if (rel.endsWith('.lock')) return false
  const stat = fs.statSync(filePath)
  return stat.size <= MAX_FILE_SIZE
}

function scanFile(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/')
  const content = fs.readFileSync(filePath, 'utf8')
  const hits = []

  for (const pattern of SECRET_PATTERNS) {
    const matches = content.match(pattern.regex)
    if (matches && matches.length > 0) {
      hits.push({ pattern: pattern.name, count: matches.length })
    }
  }

  return { file: rel, hits }
}

function main() {
  const allFiles = walk(ROOT)
  const candidates = allFiles.filter(shouldScan)
  const findings = candidates
    .map(scanFile)
    .filter((entry) => entry.hits.length > 0)
    .sort((a, b) => a.file.localeCompare(b.file))

  const summary = {
    scanned_files: candidates.length,
    files_with_findings: findings.length,
    findings,
  }

  const outputPath = path.join(ROOT, 'build-check.log')
  fs.appendFileSync(outputPath, `\n[security-secrets-audit] ${new Date().toISOString()}\n`)
  fs.appendFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`)

  console.log(JSON.stringify(summary, null, 2))
  if (findings.length > 0) process.exitCode = 1
}

main()
