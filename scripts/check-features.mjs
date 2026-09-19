import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import YAML from 'yaml'

const FEATURES_DIR = 'docs/features'
const CLIENT_KEYS = ['web', 'desktop', 'android']
const FEATURE_STATUS = ['draft', 'approved', 'in-progress', 'done', 'deprecated']
const CLIENT_STATUS = ['planned', 'in-progress', 'partial', 'supported', 'inherited', 'n/a']

function collectProtoPackages(dir) {
    const packages = new Set()
    for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.proto')) continue
        const content = readFileSync(join(entry.parentPath, entry.name), 'utf8')
        const match = content.match(/^package\s+([\w.]+)\s*;/m)
        if (match) packages.add(match[1])
    }
    return packages
}

function checkFeature(dir, protoPackages) {
    const errors = []
    const fail = (msg) => errors.push(`${dir}: ${msg}`)

    const yamlPath = join(FEATURES_DIR, dir, 'feature.yaml')
    if (!existsSync(yamlPath)) {
        fail('missing feature.yaml')
        return errors
    }

    let doc
    try {
        doc = YAML.parse(readFileSync(yamlPath, 'utf8'))
    } catch (e) {
        fail(`feature.yaml does not parse: ${e.message}`)
        return errors
    }
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
        fail('feature.yaml must be a mapping')
        return errors
    }

    if (doc.id !== dir) fail(`id "${doc.id}" must equal directory name "${dir}"`)
    if (typeof doc.title !== 'string' || doc.title.length === 0) fail('title is required')
    if (!FEATURE_STATUS.includes(doc.status)) {
        fail(`status "${doc.status}" not in ${FEATURE_STATUS.join(' | ')}`)
    }
    if (!Array.isArray(doc.owners) || doc.owners.length === 0) fail('owners must be a non-empty list')

    const clients = doc.clients
    if (clients === null || typeof clients !== 'object' || Array.isArray(clients)) {
        fail('clients must be a mapping over web, desktop, android')
    } else {
        for (const key of Object.keys(clients)) {
            if (!CLIENT_KEYS.includes(key)) fail(`unknown client "${key}"`)
        }
        for (const key of CLIENT_KEYS) {
            const entry = clients[key]
            if (entry === undefined) {
                fail(`clients.${key} is missing`)
                continue
            }
            if (!CLIENT_STATUS.includes(entry?.status)) {
                fail(`clients.${key}.status "${entry?.status}" not in ${CLIENT_STATUS.join(' | ')}`)
                continue
            }
            if (entry.status === 'inherited') {
                if (!CLIENT_KEYS.includes(entry.inherits)) {
                    fail(`clients.${key}: inherited requires inherits set to a client key`)
                }
            } else if (entry.inherits !== undefined) {
                fail(`clients.${key}: inherits is only allowed with status inherited`)
            }
            if ((entry.status === 'supported' || entry.status === 'partial') && entry.since === undefined) {
                fail(`clients.${key}: status ${entry.status} requires since`)
            }
            if (entry.tracking !== undefined && !Number.isInteger(entry.tracking)) {
                fail(`clients.${key}.tracking must be an issue number`)
            }
        }
    }

    for (const pkg of doc.api?.proto ?? []) {
        if (!protoPackages.has(pkg)) fail(`api.proto: package "${pkg}" not found under proto/`)
    }
    if (doc.links?.plan !== undefined && !existsSync(doc.links.plan)) {
        fail(`links.plan "${doc.links.plan}" does not exist`)
    }

    return errors
}

const protoPackages = collectProtoPackages('proto')
const dirs = readdirSync(FEATURES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== '_template')
    .map((e) => e.name)

const errors = dirs.flatMap((dir) => checkFeature(dir, protoPackages))

if (errors.length > 0) {
    console.error(`feature catalog check failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
    process.exit(1)
}
console.log(`feature catalog check passed (${dirs.length} features)`)
