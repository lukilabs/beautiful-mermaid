import { Resvg } from "@resvg/resvg-js"

export async function svgToPng(svg: string, scale = 2): Promise<string> {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "zoom", value: scale },
    font: { loadSystemFonts: true },
  })
  const rendered = resvg.render()
  const pngBuffer = rendered.asPng()
  return Buffer.from(pngBuffer).toString("base64")
}
