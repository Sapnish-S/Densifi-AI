"use client"

import { useEffect, useRef } from "react"
import type { MotionValue } from "framer-motion"
import { siteAssetProxied } from "@/lib/site-assets"

/*
 * Per-pixel hair regrowth for the landing hero (WebGL2).
 *
 * Inputs are two aligned 1600×2400 plates (with hair / bald) plus a growth map
 * covering the head region (generated offline):
 *   R = emergence time, G = scalp area, B = follicle dots.
 * For progress t ∈ [0,1] each pixel goes bald → stubble → short hair → full hair,
 * while hair outside the skull is stretched outward from the scalp so the tips
 * visibly lengthen. Skull geometry must match the bald plate's generator.
 */

const IMG = [1600, 2400] as const
const SKULL = [792, 600, 326, 385] as const // cx, cy, rx, ry (px)
const MAP_CROP = [0.1875, 0, 0.8125, 0.4] as const // u0, v0, u1, v1

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uHair;
uniform sampler2D uBald;
uniform sampler2D uMap;
uniform float uT;
uniform vec2 uImg;
uniform vec4 uSkull;
uniform vec4 uCrop;
const float P = 2.35;

void main() {
  // Explicit LOD from screen-space derivatives (taken before any branching), so
  // mip selection stays stable across the crop edge and the warped region.
  vec2 g = vUv * uImg;
  float lod = max(0.0, 0.5 * log2(max(dot(dFdx(g), dFdx(g)), dot(dFdy(g), dFdy(g)))));

  vec2 m = (vUv - uCrop.xy) / (uCrop.zw - uCrop.xy);
  if (m.x < 0.0 || m.x > 1.0 || m.y < 0.0 || m.y > 1.0) {
    outColor = vec4(textureLod(uHair, vUv, lod).rgb, 1.0); // plates are identical here
    return;
  }
  vec3 mp = textureLod(uMap, clamp(m, 0.0, 1.0), 0.0).rgb;

  // Length: outside the skull (above the brow) sample hair from further out,
  // so the visible hair extent grows from the scalp to its full length.
  vec2 px = vUv * uImg;
  vec2 n = (px - uSkull.xy) / uSkull.zw;
  float r = n.y < 0.0 ? pow(pow(abs(n.x), P) + pow(abs(n.y), P), 1.0 / P) : abs(n.x);
  float len = 0.3 + 0.7 * smoothstep(0.4, 1.0, uT);
  vec2 suv = vUv;
  if (r > 1.0 && n.y < 0.0) {
    float sc = (1.0 + (r - 1.0) / len) / r;
    suv = (uSkull.xy + n * sc * uSkull.zw) / uImg;
  }
  vec3 hair = textureLod(uHair, suv, lod).rgb;
  vec3 hairSoft = textureLod(uHair, suv, lod + 3.0).rgb; // mip-blurred: short, undefined hair
  vec3 bald = textureLod(uBald, vUv, lod).rgb;
  vec3 finalPx = textureLod(uHair, vUv, lod).rgb;
  // Only animate where the plates actually differ (scalp/hair); face & background stay put.
  float animMask = smoothstep(0.025, 0.07, distance(finalPx, bald));

  // Stubble: follicle dots + darkening of the scalp, before hair grows out
  float stub = mp.g * mp.b * smoothstep(0.0, 0.22, uT) * (1.0 - smoothstep(0.55, 0.95, uT));
  float shade = mp.g * smoothstep(0.02, 0.4, uT);
  vec3 base = bald * (1.0 - 0.6 * stub) * (1.0 - 0.32 * shade);

  // Timeline: t≈0–0.25 stubble only, then hair; s reaches 1.12 so every pixel completes.
  float s = uT * 1.87 - 0.75;
  float T = mp.r;
  float dens = smoothstep(T - 0.28, T + 0.02, s);
  float detail = smoothstep(T - 0.02, T + 0.1, s);
  vec3 c = mix(base, hairSoft * 0.9, dens);
  c = mix(c, hair, detail);
  outColor = vec4(mix(finalPx, c, animMask), 1.0);
}`

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous" // WebGL can only sample CORS-clean images
    img.decoding = "async"
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function HairRegrowthCanvas({
  hairSrc,
  baldSrc,
  mapSrc,
  progress,
  onReady,
  className,
}: {
  hairSrc: string
  baldSrc: string
  mapSrc: string
  progress: MotionValue<number>
  /** Called once: true when the shader is drawing, false if unsupported/failed. */
  onReady: (ok: boolean) => void
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false
    let raf = 0
    let cleanup = () => {}

    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false, antialias: false })
    if (!gl) {
      onReadyRef.current(false)
      return
    }

    // Direct from Object Storage when it sends CORS headers (SeaweedFS locally); otherwise
    // fall back to the same-origin /site-proxy rewrite (Akamai can't be configured for CORS).
    const load = (src: string) => loadImage(src).catch(() => loadImage(siteAssetProxied(src)))
    Promise.all([load(hairSrc), load(baldSrc), load(mapSrc)])
      .then(([hairImg, baldImg, mapImg]) => {
        if (disposed) return
        const compile = (type: number, src: string) => {
          const sh = gl.createShader(type)!
          gl.shaderSource(sh, src)
          gl.compileShader(sh)
          if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader")
          return sh
        }
        const prog = gl.createProgram()!
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
        gl.linkProgram(prog)
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link")
        gl.useProgram(prog)

        const buf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
        const loc = gl.getAttribLocation(prog, "aPos")
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

        const texture = (unit: number, img: HTMLImageElement, mip: boolean) => {
          const t = gl.createTexture()
          gl.activeTexture(gl.TEXTURE0 + unit)
          gl.bindTexture(gl.TEXTURE_2D, t)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR)
          if (mip) gl.generateMipmap(gl.TEXTURE_2D)
          return t
        }
        const textures = [texture(0, hairImg, true), texture(1, baldImg, true), texture(2, mapImg, false)]
        gl.uniform1i(gl.getUniformLocation(prog, "uHair"), 0)
        gl.uniform1i(gl.getUniformLocation(prog, "uBald"), 1)
        gl.uniform1i(gl.getUniformLocation(prog, "uMap"), 2)
        gl.uniform2f(gl.getUniformLocation(prog, "uImg"), IMG[0], IMG[1])
        gl.uniform4f(gl.getUniformLocation(prog, "uSkull"), ...SKULL)
        gl.uniform4f(gl.getUniformLocation(prog, "uCrop"), ...MAP_CROP)
        const uT = gl.getUniformLocation(prog, "uT")

        const draw = () => {
          raf = 0
          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          const w = Math.round(canvas.clientWidth * dpr)
          const h = Math.round(canvas.clientHeight * dpr)
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w
            canvas.height = h
          }
          gl.viewport(0, 0, w, h)
          gl.uniform1f(uT, progress.get())
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        }
        const schedule = () => {
          if (!raf) raf = requestAnimationFrame(draw)
        }
        draw()
        const unsub = progress.on("change", schedule)
        const ro = new ResizeObserver(schedule)
        ro.observe(canvas)
        onReadyRef.current(true)

        cleanup = () => {
          unsub()
          ro.disconnect()
          if (raf) cancelAnimationFrame(raf)
          textures.forEach((t) => gl.deleteTexture(t))
          gl.deleteBuffer(buf)
          gl.deleteProgram(prog)
        }
      })
      .catch(() => {
        if (!disposed) onReadyRef.current(false)
      })

    return () => {
      disposed = true
      cleanup()
    }
  }, [hairSrc, baldSrc, mapSrc, progress])

  return <canvas ref={canvasRef} aria-hidden className={className} />
}
