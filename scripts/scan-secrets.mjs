#!/usr/bin/env node
/**
 * scan-secrets.mjs — repository hygiene scan for CivicBid Studio.
 *
 * Scans the working tree (excluding node_modules, dist, .git and test output)
 * and the full git history (`git log -p --all`) for credentials, private
 * key material, environment files, personal e-mail addresses, local user
 * paths, references to private tooling, and localhost URLs in shipped code.
 *
 * No dependencies. Run with:  node scripts/scan-secrets.mjs
 * Exit code 1 when anything is found, 0 when the tree and history are clean.
 *
 * Patterns are assembled from fragments so this file never matches itself.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-ssr', '.git', 'coverage', 'test-results', 'playwright-report']);
const BINARY_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.webm', '.mov', '.pdf', '.zip', '.gz', '.tgz', '.br']);
const SHIPPED_PREFIXES = ['src' + sep, 'public' + sep];
const SHIPPED_FILES = new Set(['index.html']);
const NOREPLY_DOMAIN = 'users.noreply.github.com';

// Fragments keep the literal patterns out of this file's own text.
const USERS = 'Users';
const PRIVATE_TOOLS = ['One' + 'Drive', 'Obsi' + 'dian'];
const PRIVATE_KEY_MARKER = 'BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?' + 'PRIVATE' + ' KEY';

/** @type {Array<{ name: string; regex: RegExp; scope: 'all' | 'shipped' }>} */
const CONTENT_RULES = [
  { name: 'AWS access key id', regex: new RegExp('\\bAKIA[0-9A-Z]{16}\\b', 'g'), scope: 'all' },
  { name: 'GitHub token', regex: new RegExp('\\b(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{20,}\\b|\\bgithub_pat_[A-Za-z0-9_]{20,}\\b', 'g'), scope: 'all' },
  { name: 'Secret key (sk- prefix)', regex: new RegExp('\\bsk-[A-Za-z0-9]{20,}\\b', 'g'), scope: 'all' },
  { name: 'Slack token', regex: new RegExp('\\bxox[baprs]-[A-Za-z0-9-]{8,}', 'g'), scope: 'all' },
  { name: 'Private key block', regex: new RegExp(PRIVATE_KEY_MARKER, 'g'), scope: 'all' },
  { name: 'E-mail address', regex: new RegExp('[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', 'g'), scope: 'all' },
  { name: 'Windows user path', regex: new RegExp('[A-Za-z]:\\\\' + USERS + '\\\\[^\\\\/\\s"\'`<>|]+', 'g'), scope: 'all' },
  { name: 'POSIX drive user path', regex: new RegExp('/[A-Za-z]/' + USERS + '/[^/\\s"\'`<>|]+', 'g'), scope: 'all' },
  { name: 'Private tooling reference', regex: new RegExp('\\b(?:' + PRIVATE_TOOLS.join('|') + ')\\b', 'gi'), scope: 'all' },
  { name: 'localhost URL in shipped code', regex: new RegExp('\\blocalhost\\b|\\b127\\.0\\.0\\.1\\b', 'g'), scope: 'shipped' },
];

const ENV_FILE = new RegExp('^\\.env(?:\\..+)?$');

/** @type {Array<{ where: string; rule: string; snippet: string }>} */
const findings = [];
const warnings = [];
let filesScanned = 0;
let historyLines = 0;

function mask(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 8) return clean;
  return `${clean.slice(0, 4)}${'*'.repeat(Math.min(clean.length - 6, 24))}${clean.slice(-2)}`;
}

function isShipped(relPath) {
  return SHIPPED_FILES.has(relPath) || SHIPPED_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

function acceptMatch(rule, match) {
  if (rule.name === 'E-mail address') {
    const domain = match.split('@')[1] ?? '';
    return domain.toLowerCase() !== NOREPLY_DOMAIN;
  }
  return true;
}

function scanLine(line, where, shipped) {
  for (const rule of CONTENT_RULES) {
    if (rule.scope === 'shipped' && !shipped) continue;
    rule.regex.lastIndex = 0;
    let match;
    while ((match = rule.regex.exec(line)) !== null) {
      if (acceptMatch(rule, match[0])) findings.push({ where, rule: rule.name, snippet: mask(match[0]) });
      if (match[0].length === 0) rule.regex.lastIndex += 1;
    }
  }
}

function isBinary(buffer) {
  const limit = Math.min(buffer.length, 8000);
  for (let i = 0; i < limit; i += 1) if (buffer[i] === 0) return true;
  return false;
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full);
      continue;
    }
    if (!entry.isFile()) continue;
    const relPath = relative(ROOT, full);
    if (ENV_FILE.test(entry.name)) findings.push({ where: relPath, rule: 'Environment file in tree', snippet: entry.name });
    const ext = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase() : '';
    if (BINARY_EXTENSIONS.has(ext)) continue;
    if (statSync(full).size > 20 * 1024 * 1024) {
      warnings.push(`Skipped ${relPath}: larger than 20 MB.`);
      continue;
    }
    const buffer = readFileSync(full);
    if (isBinary(buffer)) continue;
    filesScanned += 1;
    const shipped = isShipped(relPath);
    const lines = buffer.toString('utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) scanLine(lines[i], `${relPath}:${i + 1}`, shipped);
  }
}

function scanHistory() {
  let output;
  try {
    output = execFileSync('git', ['log', '-p', '--all', '--format=commit %H', '--no-color'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 512 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    warnings.push(`Git history was NOT scanned: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
    return;
  }
  let commit = 'unknown';
  let file = '';
  for (const line of output.split(/\r?\n/)) {
    historyLines += 1;
    if (line.startsWith('commit ')) {
      commit = line.slice(7, 19);
      continue;
    }
    if (line.startsWith('diff --git ')) {
      const parts = line.split(' b/');
      file = parts.length > 1 ? parts[parts.length - 1] : '';
      if (ENV_FILE.test(basename(file))) findings.push({ where: `git history ${commit}`, rule: 'Environment file in history', snippet: file });
      continue;
    }
    if (line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ') || line.startsWith('@@')) continue;
    const shipped = isShipped(file.split('/').join(sep));
    scanLine(line, `git history ${commit} (${file || 'metadata'})`, shipped);
  }
}

walk(ROOT);
scanHistory();

console.log(`Scanned ${filesScanned} text files in the working tree and ${historyLines} lines of git history.`);
for (const warning of warnings) console.log(`WARNING: ${warning}`);

if (findings.length === 0) {
  console.log('No secrets, private paths, personal e-mail addresses, environment files, or localhost URLs found.');
  process.exit(0);
}

console.log(`\n${findings.length} finding(s):`);
for (const finding of findings) console.log(`  ${finding.where}  [${finding.rule}]  ${finding.snippet}`);
process.exit(1);
