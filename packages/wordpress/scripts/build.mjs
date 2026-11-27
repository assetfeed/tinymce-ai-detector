// Builds the two editor scripts into build/ and, with --zip, the installable plugin at dist/ai-detector-by-assetfeed.zip.
// ponytail: esbuild + the system `zip`, no wp-scripts; WordPress packages are read from the page's `wp` globals.
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const slug = 'ai-detector-by-assetfeed'

for (const name of ['block-editor', 'classic']) {
    await build({
        entryPoints: [join(root, 'src', `${name}.js`)],
        outfile: join(root, 'build', `${name}.js`),
        bundle: true,
        minify: true,
        format: 'iife',
        target: 'es2019',
        legalComments: 'none',
    })
}

if (process.argv.includes('--zip')) {
    const stage = join(root, 'dist', 'stage')
    const target = join(stage, slug)

    rmSync(join(root, 'dist'), { recursive: true, force: true })
    mkdirSync(target, { recursive: true })

    for (const entry of ['ai-detector-by-assetfeed.php', 'uninstall.php', 'readme.txt', 'LICENSE', 'includes', 'assets', 'build']) {
        cpSync(join(root, entry), join(target, entry), { recursive: true })
    }

    execFileSync('zip', ['-qr', join(root, 'dist', `${slug}.zip`), slug, '-x', '*.DS_Store'], { cwd: stage })
    rmSync(stage, { recursive: true, force: true })
    console.log(`dist/${slug}.zip (${JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version})`)
}
