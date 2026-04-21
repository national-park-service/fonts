#!/usr/bin/env bun
/**
 * Render an HTML file to PNG using Bun.WebView (WebKit, headless).
 *
 * Usage:
 *   bun run scripts/screenshot.ts [html-path] [--width N] [--height N]
 *                                 [--selector CSS] [--full-page]
 *                                 [--out /tmp/review-screenshot.png]
 *                                 [--wait MS]
 *
 * Defaults:
 *   html-path : web/review/index.html
 *   --width   : 1400
 *   --out     : /tmp/review-screenshot.png
 *   mode      : full-page (measures scrollHeight after document.fonts.ready)
 *
 * Notes:
 *   - Uses Bun.WebView's default WebKit backend. No Chromium needed.
 *   - The produced PNG is rasterised at the system scale factor (2x on retina),
 *     so a 1400 CSS-wide viewport becomes a 2800px-wide PNG on a retina display.
 *   - --selector scrolls the element into view and sizes the viewport to that
 *     element's bounding rect (nearest full-element crop). Without a pixel-level
 *     clip API, this is the simplest reliable approach.
 */

import { resolve } from 'node:path'
import { stat } from 'node:fs/promises'

interface Args {
  htmlPath: string
  width: number
  height: number | null
  fullPage: boolean
  selector: string | null
  out: string
  wait: number
}

function parseArgs(): Args {
  const argv = Bun.argv.slice(2)
  const positional: string[] = []
  const flags: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const val = argv[i + 1] && !argv[i + 1]!.startsWith('--') ? argv[++i]! : 'true'
      flags[key] = val
    }
    else {
      positional.push(a)
    }
  }
  const root = resolve(import.meta.dir, '..')
  return {
    htmlPath: resolve(root, positional[0] ?? 'web/review/index.html'),
    width: Number(flags.width ?? 1400),
    height: flags.height ? Number(flags.height) : null,
    fullPage: flags['full-page'] === 'true' || (!flags.height && !flags.selector),
    selector: flags.selector && flags.selector !== 'true' ? flags.selector : null,
    out: resolve(flags.out ?? '/tmp/review-screenshot.png'),
    wait: Number(flags.wait ?? 800),
  }
}

// Minimal PNG IHDR reader. PNG bytes 0-7 = signature, 8-11 = IHDR length,
// 12-15 = "IHDR", 16-19 = width (BE u32), 20-23 = height (BE u32).
function readPngSize(buf: Uint8Array): { width: number, height: number } | null {
  if (buf.length < 24) return null
  const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) return null
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  return { width: dv.getUint32(16, false), height: dv.getUint32(20, false) }
}

async function main(): Promise<void> {
  const args = parseArgs()

  const htmlStat = await stat(args.htmlPath).catch(() => null)
  if (!htmlStat || !htmlStat.isFile()) {
    throw new Error(`HTML file not found: ${args.htmlPath}`)
  }

  const html = await Bun.file(args.htmlPath).text()
  const dataUrl = `data:text/html;base64,${Buffer.from(html).toString('base64')}`

  const initialHeight = args.height ?? 900
  const WV = (Bun as { WebView: new (opts: Record<string, unknown>) => unknown }).WebView
  const wv = new WV({
    width: args.width,
    height: initialHeight,
    headless: true,
  }) as {
    navigate: (url: string) => Promise<void>
    evaluate: (code: string) => Promise<unknown>
    resize: (w: number, h: number) => Promise<void>
    screenshot: (opts: { encoding: 'buffer', format: 'png' }) => Promise<Uint8Array>
    close: () => void
  }

  try {
    await wv.navigate(dataUrl)
    // Give the event loop a tick and let layout settle before reading fonts.
    await new Promise(r => setTimeout(r, 200))

    // Wait for fonts + any provided extra wait.
    await wv.evaluate(`
      (async () => {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        return true;
      })()
    `)
    if (args.wait > 0) await new Promise(r => setTimeout(r, args.wait))

    // Decide viewport for the capture.
    let vpW = args.width
    let vpH: number

    if (args.selector) {
      const rawRect = await wv.evaluate(`
        (() => {
          const el = document.querySelector(${JSON.stringify(args.selector)});
          if (!el) return null;
          el.scrollIntoView({ block: 'start', inline: 'start' });
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
        })()
      `) as { x: number, y: number, w: number, h: number } | null
      if (!rawRect) throw new Error(`Selector not found: ${args.selector}`)
      vpW = Math.max(1, Math.min(rawRect.w || args.width, 16384))
      vpH = Math.max(1, Math.min(rawRect.h || 600, 16384))
      // If the element isn't at (0,0) after scrollIntoView (e.g. sticky header),
      // scroll by the remaining offset so it sits at viewport origin.
      await wv.evaluate(`window.scrollBy(${rawRect.x}, ${rawRect.y})`)
      await new Promise(r => setTimeout(r, 100))
    }
    else if (args.fullPage) {
      const sh = await wv.evaluate(`
        Math.max(
          document.documentElement.scrollHeight,
          document.body ? document.body.scrollHeight : 0
        )
      `) as number
      vpH = Math.max(1, Math.min(Number(sh) || 900, 16384))
    }
    else {
      vpH = args.height ?? 900
    }

    await wv.resize(vpW, vpH)
    // Allow layout + compositor to settle after resize.
    await new Promise(r => setTimeout(r, 150))

    const buf = await wv.screenshot({ encoding: 'buffer', format: 'png' })
    await Bun.write(args.out, buf)

    const written = Bun.file(args.out)
    const size = written.size
    if (!size) throw new Error(`Wrote 0 bytes to ${args.out}`)

    const dims = readPngSize(buf)
    if (!dims) throw new Error(`Output is not a valid PNG (first bytes: ${[...buf.slice(0, 8)].map(b => b.toString(16)).join(' ')})`)
    if (dims.width < 2 || dims.height < 2) {
      throw new Error(`PNG is suspiciously small: ${dims.width}x${dims.height}`)
    }

    console.log(JSON.stringify({
      ok: true,
      out: args.out,
      bytes: size,
      pixelWidth: dims.width,
      pixelHeight: dims.height,
      cssWidth: vpW,
      cssHeight: vpH,
      scale: +(dims.width / vpW).toFixed(2),
    }, null, 2))
  }
  finally {
    wv.close()
  }
}

main().catch((err) => {
  console.error('screenshot failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
