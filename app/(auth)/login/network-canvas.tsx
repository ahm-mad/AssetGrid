"use client"

import { useEffect, useRef } from "react"

/**
 * Full-bleed animated network mesh — drifting nodes, connecting lines when
 * close, expanding "pulse" rings emitted from random hub nodes. The one
 * place in the app that gets real animation/glow (ADR-UX005) — a single
 * "gate" moment, not a work surface.
 */
export function NetworkCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    const AZ = "79, 154, 232"
    let W = 0
    let H = 0
    let dpr = 1
    let nodes: { x: number; y: number; vx: number; vy: number; r: number; hub: boolean }[] = []
    let pulses: { x: number; y: number; r: number; max: number }[] = []
    let raf = 0

    function resize() {
      if (!canvas) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = canvas.width = window.innerWidth * dpr
      H = canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      const count = Math.round(Math.min(90, (window.innerWidth * window.innerHeight) / 16000))
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.1 * dpr,
        vy: (Math.random() - 0.5) * 0.1 * dpr,
        r: (Math.random() * 1.4 + 1) * dpr,
        hub: Math.random() < 0.18,
      }))
    }

    function emit() {
      if (reduce) return
      const hubs = nodes.filter((n) => n.hub)
      const n = hubs.length ? hubs[(Math.random() * hubs.length) | 0] : nodes[(Math.random() * nodes.length) | 0]
      if (n) pulses.push({ x: n.x, y: n.y, r: 0, max: (120 + Math.random() * 90) * dpr })
    }

    let last = 0
    function frame(t: number) {
      if (!ctx) return
      ctx.clearRect(0, 0, W, H)
      const LINK = 130 * dpr
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        if (!reduce) {
          a.x += a.vx
          a.y += a.vy
          if (a.x < 0 || a.x > W) a.vx *= -1
          if (a.y < 0 || a.y > H) a.vy *= -1
        }
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d = Math.hypot(dx, dy)
          if (d < LINK) {
            const o = (1 - d / LINK) * 0.5
            ctx.strokeStyle = `rgba(${AZ},${o.toFixed(3)})`
            ctx.lineWidth = dpr * 0.6
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }
      for (let k = pulses.length - 1; k >= 0; k--) {
        const p = pulses[k]
        p.r += 1.5 * dpr
        const o = Math.max(0, 1 - p.r / p.max)
        ctx.strokeStyle = `rgba(${AZ},${(o * 0.5).toFixed(3)})`
        ctx.lineWidth = dpr * 1.2
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.stroke()
        if (p.r >= p.max) pulses.splice(k, 1)
      }
      for (const n of nodes) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = n.hub ? `rgba(${AZ},.95)` : "rgba(150,180,210,.6)"
        if (n.hub) {
          ctx.shadowColor = `rgba(${AZ},.9)`
          ctx.shadowBlur = 10 * dpr
        } else {
          ctx.shadowBlur = 0
        }
        ctx.fill()
        ctx.shadowBlur = 0
      }
      if (!reduce && t - last > 620) {
        emit()
        last = t
      }
      raf = requestAnimationFrame(frame)
    }

    resize()
    for (let i = 0; i < 3; i++) emit()
    window.addEventListener("resize", resize)
    raf = requestAnimationFrame(frame)

    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(raf)
    }
  }, [])

  return <canvas ref={ref} className="fixed inset-0 z-0 block" aria-hidden="true" />
}
