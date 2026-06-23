// Tamper Monkey Script
// ==UserScript==
// @name         Get Facebook Video Link
// @namespace    http://tampermonkey.net/
// @version      0.2.0
// @description  Fast Facebook video extractor using DOM, React Fiber and GraphQL network capture
// @author       Viet Cat
// @match        https://www.facebook.com/*
// @match        https://web.facebook.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

;(function () {
  'use strict'

  const PANEL_ID = 'pnlVidDnl'
  const LINKS_ID = 'pnlVidLk'
  const INFO_ID = 'pnlInfo'
  const STATUS_ID = 'pnlVidStatus'
  const MAX_LOG_LINES = 5000
  const SCAN_DEBOUNCE_MS = 800
  const FIBER_MAX_DEPTH = 5
  const FIBER_MAX_ANCESTORS = 40

  const state = {
    links: new Map(),
    candidates: new Map(),
    scanning: false,
    autoScan: true,
    observer: null,
    scanTimer: null,
    logLines: [],
  }

  const NetCapture = {
    captured: new Map(),
    thumbToVideoId: new Map(),
    installed: false,

    install() {
      if (this.installed) return
      this.installed = true
      this.interceptFetch()
      this.interceptXHR()
      log('Network capture installed')
    },

    getVideosForId(videoId) {
      const urls = this.captured.get(videoId)
      return urls ? [...urls] : []
    },

    getVideosByPoster(posterURL) {
      const key = this.extractThumbKey(posterURL)
      if (!key) return []
      const videoId = this.thumbToVideoId.get(key)
      return videoId ? this.getVideosForId(videoId) : []
    },

    extractThumbKey(url) {
      if (!url) return null
      const match = /\/(\d{6,}_\d{6,})_/.exec(url)
      return match ? match[1] : null
    },

    parseResponse(text) {
      if (!text || text.length < 100) return
      if (
        !text.includes('playable_url') &&
        !text.includes('progressive_url') &&
        !text.includes('browser_native_') &&
        !text.includes('base_url')
      ) return

      try {
        const chunks = text.split('\n').filter((line) => line.trim().startsWith('{'))
        for (const chunk of chunks) {
          try {
            this.extractFromJSON(JSON.parse(chunk))
          } catch {}
        }
      } catch {}

      this.extractByRegex(text)
    },

    extractFromJSON(obj, videoId = null, thumbs = []) {
      if (!obj || typeof obj !== 'object') return
      if (Array.isArray(obj)) {
        for (const item of obj) this.extractFromJSON(item, videoId, thumbs)
        return
      }

      if (obj.video_id && /^\d+$/.test(String(obj.video_id))) videoId = String(obj.video_id)
      if (obj.videoId && /^\d+$/.test(String(obj.videoId))) videoId = String(obj.videoId)
      if (obj.__typename === 'Video' && obj.id && /^\d+$/.test(String(obj.id))) videoId = String(obj.id)

      const nextThumbs = [...thumbs]
      for (const key of ['preferred_thumbnail', 'thumbnailImage', 'scrubber_thumbnail', 'thumbnail_image', 'previewImage', 'stillImage', 'image']) {
        const val = obj[key]
        if (val && typeof val === 'object') {
          const uri = val.uri || val.url || val.src || ''
          if (typeof uri === 'string' && uri.includes('fbcdn')) nextThumbs.push(uri)
        } else if (typeof val === 'string' && val.includes('fbcdn')) {
          nextThumbs.push(val)
        }
      }
      if (videoId && typeof obj.uri === 'string' && obj.uri.includes('fbcdn') && obj.uri.includes('t15.')) {
        nextThumbs.push(obj.uri)
      }

      for (const key of ['playable_url_quality_hd', 'playable_url', 'browser_native_hd_url', 'browser_native_sd_url', 'progressive_url', 'base_url']) {
        if (typeof obj[key] === 'string') this.addVideo(videoId || '_unknown', obj[key], key)
      }

      if (videoId) {
        for (const thumb of nextThumbs) {
          const thumbKey = this.extractThumbKey(thumb)
          if (thumbKey && !this.thumbToVideoId.has(thumbKey)) this.thumbToVideoId.set(thumbKey, videoId)
        }
      }

      for (const val of Object.values(obj)) {
        if (val && typeof val === 'object' && !val.$$typeof) this.extractFromJSON(val, videoId, nextThumbs)
      }
    },

    extractByRegex(text) {
      const idRe = /"(?:video_id|videoId|id)"\s*:\s*"(\d+)"/g
      let match
      while ((match = idRe.exec(text)) !== null) {
        const videoId = match[1]
        const chunk = text.substring(Math.max(0, match.index - 6000), Math.min(text.length, match.index + 6000))
        for (const re of [
          /"playable_url_quality_hd"\s*:\s*"([^"]+)"/g,
          /"playable_url"\s*:\s*"([^"]+)"/g,
          /"browser_native_hd_url"\s*:\s*"([^"]+)"/g,
          /"browser_native_sd_url"\s*:\s*"([^"]+)"/g,
          /"progressive_url"\s*:\s*"([^"]+)"/g,
          /"base_url"\s*:\s*"([^"]+)"/g,
        ]) {
          let urlMatch
          while ((urlMatch = re.exec(chunk)) !== null) this.addVideo(videoId, urlMatch[1], 'network')
        }
      }
    },

    addVideo(videoId, rawUrl, quality = 'network') {
      const url = cleanVideoUrl(rawUrl)
      if (!isValidVideoUrl(url)) return false
      if (!this.captured.has(videoId)) this.captured.set(videoId, new Set())
      this.captured.get(videoId).add(url)
      return addVideoCandidate(url, quality, videoId)
    },

    interceptFetch() {
      const originalFetch = window.fetch
      if (typeof originalFetch !== 'function') return
      const self = this
      window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args)
        try {
          const url = String(args[0]?.url || args[0] || '')
          if (url.includes('/graphql') || url.includes('facebook.com/api/graphql')) {
            response.clone().text().then((text) => self.parseResponse(text)).catch(() => {})
          }
        } catch {}
        return response
      }
    },

    interceptXHR() {
      const originalOpen = XMLHttpRequest.prototype.open
      const originalSend = XMLHttpRequest.prototype.send
      const self = this
      XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this.__videoCaptureUrl = url
        return originalOpen.call(this, method, url, ...rest)
      }
      XMLHttpRequest.prototype.send = function (...args) {
        this.addEventListener('load', function () {
          try {
            const url = String(this.__videoCaptureUrl || '')
            if (url.includes('/graphql') || url.includes('facebook.com/api/graphql')) self.parseResponse(this.responseText)
          } catch {}
        })
        return originalSend.apply(this, args)
      }
    },
  }

  function init() {
    cleanupExistingPanel()
    NetCapture.install()
    createPanel()
    installObserver()
    scanVideos('initial')
    window.addEventListener('beforeunload', cleanup)
  }

  function cleanupExistingPanel() {
    const oldPanel = document.getElementById(PANEL_ID)
    if (oldPanel) oldPanel.remove()
  }

  function cleanup() {
    if (state.observer) state.observer.disconnect()
    if (state.scanTimer) clearTimeout(state.scanTimer)
  }

  function installObserver() {
    state.observer = new MutationObserver((mutations) => {
      if (!state.autoScan) return
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue
          if (node.id === PANEL_ID || node.closest?.(`#${PANEL_ID}`)) continue
          if (node.matches?.('video, [data-video-id], [aria-label="Video player"]') || node.querySelector?.('video, [data-video-id], [aria-label="Video player"]')) {
            scheduleScan('dom-change')
            return
          }
        }
      }
    })
    state.observer.observe(document.body || document.documentElement, { childList: true, subtree: true })
  }

  function scheduleScan(reason) {
    if (state.scanTimer) clearTimeout(state.scanTimer)
    state.scanTimer = setTimeout(() => scanVideos(reason), SCAN_DEBOUNCE_MS)
  }

  function scanVideos(reason = 'manual') {
    if (state.scanning) return
    state.scanning = true
    const before = state.candidates.size
    const videoIds = new Set()
    const posters = new Set()

    try {
      scanDOM(videoIds, posters)
      scanFiber(videoIds)
      mergeNetworkCapture(videoIds, posters)
      fallbackScriptJSON(videoIds, posters)
      renderBestVideos()
      updateStatus(`Found ${state.links.size} videos`)
      log(`Scan ${reason}: +${state.candidates.size - before} candidates, ${state.links.size} best videos`)
    } catch (error) {
      log(`Scan failed: ${error.message}`, 'error')
    } finally {
      state.scanning = false
    }
  }

  function scanDOM(videoIds, posters) {
    const roots = document.querySelectorAll('video, video source[src], [data-video-id], [data-video-url], [data-src], [aria-label="Video player"], [data-instancekey], a[href*="/reel/"], a[href*="/videos/"], a[href*="/watch"]')
    for (const el of roots) {
      if (el.closest?.(`#${PANEL_ID}`)) continue
      const src = el.currentSrc || el.src || el.getAttribute?.('src') || el.getAttribute?.('data-video-url') || el.getAttribute?.('data-src')
      if (src) addVideoCandidate(src, 'DOM')

      const poster = el.getAttribute?.('poster')
      if (poster && poster.includes('fbcdn')) posters.add(cleanVideoUrl(poster))

      const dataVideoId = el.getAttribute?.('data-video-id')
      if (dataVideoId && /^\d+$/.test(dataVideoId)) videoIds.add(dataVideoId)

      const href = el.href || el.getAttribute?.('href') || ''
      const idMatch = /\/videos\/[^/]*\/(\d+)/.exec(href) || /\/videos\/(\d+)/.exec(href) || /\/reel\/(\d+)/.exec(href) || /[?&]v=(\d+)/.exec(href)
      if (idMatch) videoIds.add(idMatch[1])
    }

    for (const poster of posters) {
      const thumbKey = NetCapture.extractThumbKey(poster)
      const videoId = thumbKey ? NetCapture.thumbToVideoId.get(thumbKey) : null
      if (videoId) videoIds.add(videoId)
    }
  }

  function scanFiber(videoIds) {
    const urls = []
    const candidates = document.querySelectorAll('video, [aria-label="Video player"], [data-instancekey], [data-video-id]')
    for (const el of candidates) {
      if (el.closest?.(`#${PANEL_ID}`)) continue
      extractVideoFromFiber(el, videoIds, urls)
      const parent = el.closest?.('div[role="article"], [data-pagelet], [role="main"]')
      if (parent) extractVideoFromFiber(parent, videoIds, urls)
    }
    for (const url of urls) addVideoCandidate(url, 'Fiber')
  }

  function extractVideoFromFiber(el, videoIds, videoUrls) {
    try {
      const fiberKey = Object.keys(el).find((key) => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$'))
      if (!fiberKey) return
      let fiber = el[fiberKey]
      for (let i = 0; i < FIBER_MAX_ANCESTORS && fiber; i++) {
        const props = fiber.memoizedProps || fiber.pendingProps
        if (props) scanPropsForVideo(props, videoIds, videoUrls, 0)
        fiber = fiber.return
      }
    } catch {}
  }

  function scanPropsForVideo(obj, videoIds, videoUrls, depth) {
    if (!obj || typeof obj !== 'object' || depth > FIBER_MAX_DEPTH) return
    if (Array.isArray(obj)) {
      for (const item of obj) scanPropsForVideo(item, videoIds, videoUrls, depth + 1)
      return
    }

    for (const key of ['videoId', 'video_id', 'videoID']) {
      const val = obj[key]
      if (val && /^\d+$/.test(String(val))) videoIds.add(String(val))
    }
    if (obj.__typename === 'Video' && obj.id && /^\d+$/.test(String(obj.id))) videoIds.add(String(obj.id))

    for (const key of ['playable_url_quality_hd', 'playable_url', 'browser_native_hd_url', 'browser_native_sd_url', 'progressive_url', 'base_url', 'src', 'source', 'videoSrc']) {
      const val = obj[key]
      if (typeof val === 'string' && isValidVideoUrl(cleanVideoUrl(val))) videoUrls.push(val)
    }

    for (const val of Object.values(obj)) {
      if (val && typeof val === 'object' && !val.$$typeof) scanPropsForVideo(val, videoIds, videoUrls, depth + 1)
    }
  }

  function mergeNetworkCapture(videoIds, posters) {
    for (const videoId of videoIds) {
      for (const url of NetCapture.getVideosForId(videoId)) addVideoCandidate(url, 'Network', videoId)
    }
    for (const poster of posters) {
      for (const url of NetCapture.getVideosByPoster(poster)) addVideoCandidate(url, 'Poster')
    }
  }

  function fallbackScriptJSON(videoIds, posters) {
    if (videoIds.size === 0 && posters.size === 0) return
    const posterKeys = [...posters].map((poster) => NetCapture.extractThumbKey(poster)).filter(Boolean)
    const scripts = document.querySelectorAll('script[type="application/json"]')
    for (const script of scripts) {
      const text = script.textContent || ''
      if (text.length < 200 || (!text.includes('playable_url') && !text.includes('progressive_url') && !text.includes('browser_native_'))) continue
      const relevantById = [...videoIds].some((id) => text.includes(`"${id}"`))
      const relevantByPoster = posterKeys.some((key) => text.includes(key))
      if (!relevantById && !relevantByPoster) continue
      NetCapture.parseResponse(text)
      mergeNetworkCapture(videoIds, posters)
    }
  }

  function addVideoCandidate(rawUrl, quality = 'Video', videoId = '') {
    const url = cleanVideoUrl(rawUrl)
    if (!isValidVideoUrl(url)) return false
    if (state.candidates.has(url)) return false
    state.candidates.set(url, { quality, videoId, score: getVideoScore(url) })
    return true
  }

  function renderBestVideos() {
    const bestUrls = selectBestQualityVideos([...state.candidates.keys()])
    state.links = new Map()
    for (const url of bestUrls) state.links.set(url, state.candidates.get(url) || { quality: 'Video', videoId: '' })

    const links = document.getElementById(LINKS_ID)
    if (!links) return
    links.textContent = ''
    for (const [url, meta] of state.links) appendLinkRow(url, meta.quality, meta.videoId, meta.score)
  }

  function decodeEfg(url) {
    try {
      const parsed = new URL(url)
      let b64 = parsed.searchParams.get('efg')
      if (!b64) return null
      b64 = b64.replace(/-/g, '+').replace(/_/g, '/')
      b64 += '='.repeat((4 - (b64.length % 4)) % 4)
      return JSON.parse(atob(b64))
    } catch {
      return null
    }
  }

  function getVideoScore(url) {
    const efg = decodeEfg(url)
    const tag = (efg && efg.vencode_tag) || ''
    const bitrate = Number((efg && efg.bitrate) || /[?&]bitrate=(\d+)/.exec(url)?.[1] || 0)
    const resolution = Number(/(\d{3,4})p/i.exec(tag)?.[1] || /[?&](?:height|quality)=(\d{3,4})/.exec(url)?.[1] || 0)
    const isAudio = /audio/i.test(tag)
    const isDashOnly = /dash_/i.test(tag) && !/(sve_sd|sve_hd|progressive)/i.test(tag)
    let playRank = 2
    if (/sve_sd|sve_hd|progressive/i.test(tag)) playRank = 3
    if (isDashOnly) playRank = 1
    if (isAudio) playRank = 0
    return { assetId: efg?.xpv_asset_id ? String(efg.xpv_asset_id) : null, tag, bitrate, resolution, isAudio, playRank }
  }

  function selectBestQualityVideos(urls) {
    if (urls.length <= 1) return urls
    const groups = new Map()
    for (const url of urls) {
      const score = state.candidates.get(url)?.score || getVideoScore(url)
      const key = score.assetId || state.candidates.get(url)?.videoId || url
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push({ url, score })
    }
    const result = []
    for (const [, group] of groups) {
      const usable = group.filter((entry) => !entry.score.isAudio)
      if (usable.length === 0) continue
      usable.sort((a, b) => {
        if (b.score.playRank !== a.score.playRank) return b.score.playRank - a.score.playRank
        if (b.score.resolution !== a.score.resolution) return b.score.resolution - a.score.resolution
        return b.score.bitrate - a.score.bitrate
      })
      result.push(usable[0].url)
    }
    return result
  }

  function isValidVideoUrl(url) {
    try {
      if (!url) return false
      const parsed = new URL(url)
      const host = parsed.hostname.toLowerCase()
      const validHost = ['fbcdn.net', 'facebook.com', 'fbsbx.com', 'fb.watch', 'fb.gg'].some((domain) => host.includes(domain))
      const validPath = /\.(mp4|mov|m4v)($|\?)|\/video\/|\/fbcdn\//i.test(parsed.pathname) || url.includes('bytestart=') || url.includes('byteend=')
      return parsed.protocol === 'https:' && validHost && validPath
    } catch {
      return false
    }
  }

  function cleanVideoUrl(url) {
    if (!url) return ''
    url = String(url)
      .replace(/\\\//g, '/')
      .replace(/\\u0025/g, '%')
      .replace(/u0025/g, '%')
      .replace(/&amp;/g, '&')
      .replace(/\\/g, '')
    try {
      return decodeURIComponent(url)
    } catch {
      return url
    }
  }

  function createPanel() {
    const panel = document.createElement('div')
    panel.id = PANEL_ID
    Object.assign(panel.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      width: '500px',
      maxHeight: '85vh',
      zIndex: '999999',
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,.18)',
      fontFamily: 'Arial, sans-serif',
      overflow: 'hidden',
    })

    const header = document.createElement('div')
    Object.assign(header.style, {
      background: '#4a76a8',
      color: '#fff',
      padding: '10px',
      cursor: 'move',
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
    })
    header.innerHTML = '<strong style="flex:1">Video Downloader</strong>'

    const scanBtn = createButton('Scan', '#4CAF50')
    scanBtn.onclick = () => scanVideos('manual')
    const autoBtn = createButton('Auto: ON', '#607d8b')
    autoBtn.onclick = () => {
      state.autoScan = !state.autoScan
      autoBtn.textContent = state.autoScan ? 'Auto: ON' : 'Auto: OFF'
      log(`Auto scan ${state.autoScan ? 'enabled' : 'disabled'}`)
    }
    const clearBtn = createButton('Clear', '#f44336')
    clearBtn.onclick = clearLinks
    header.append(scanBtn, autoBtn, clearBtn)

    const status = document.createElement('div')
    status.id = STATUS_ID
    Object.assign(status.style, { padding: '8px 10px', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' })
    status.textContent = 'Ready'

    const links = document.createElement('div')
    links.id = LINKS_ID
    Object.assign(links.style, { maxHeight: '45vh', overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' })

    const info = document.createElement('textarea')
    info.id = INFO_ID
    Object.assign(info.style, { width: '100%', height: '130px', boxSizing: 'border-box', border: '0', borderTop: '1px solid #eee', padding: '8px', fontSize: '12px', fontFamily: 'monospace', resize: 'vertical' })

    panel.append(header, status, links, info)
    document.body.appendChild(panel)
    makeDraggable(panel, header)
  }

  function createButton(text, color) {
    const button = document.createElement('button')
    button.textContent = text
    Object.assign(button.style, { border: '0', borderRadius: '4px', padding: '5px 9px', color: '#fff', background: color, cursor: 'pointer', fontSize: '12px' })
    return button
  }

  function appendLinkRow(url, quality, videoId, score = {}) {
    const links = document.getElementById(LINKS_ID)
    if (!links) return
    const row = document.createElement('div')
    Object.assign(row.style, { display: 'grid', gridTemplateColumns: '150px 1fr auto auto', gap: '8px', alignItems: 'center', padding: '8px', background: '#f5f5f5', borderRadius: '5px' })

    const preview = document.createElement('video')
    preview.src = url
    preview.controls = true
    preview.muted = true
    preview.preload = 'metadata'
    Object.assign(preview.style, { width: '150px', height: '84px', background: '#000', borderRadius: '4px', objectFit: 'contain' })
    preview.addEventListener('error', () => {
      const fallback = document.createElement('div')
      fallback.textContent = 'Preview unavailable'
      Object.assign(fallback.style, { width: '150px', height: '84px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffebee', color: '#b71c1c', borderRadius: '4px', fontSize: '12px', textAlign: 'center' })
      preview.replaceWith(fallback)
    }, { once: true })

    const label = document.createElement('div')
    const qualityText = score.resolution ? `${score.resolution}p` : quality
    const bitrateText = score.bitrate ? ` • ${Math.round(score.bitrate / 1000)}kbps` : ''
    label.textContent = `${qualityText}${bitrateText}${videoId ? ` #${videoId}` : ''}`
    label.title = url
    Object.assign(label.style, { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' })

    const copyBtn = createButton('Copy', '#795548')
    copyBtn.onclick = () => navigator.clipboard?.writeText(url).then(() => log('Copied video URL')).catch(() => prompt('Copy URL:', url))

    const openBtn = createButton('Open', '#007bff')
    openBtn.onclick = () => window.open(url, '_blank')

    row.append(preview, label, copyBtn, openBtn)
    links.appendChild(row)
  }

  function clearLinks() {
    state.links.clear()
    state.candidates.clear()
    const links = document.getElementById(LINKS_ID)
    if (links) links.textContent = ''
    updateStatus('Cleared')
    log('Cleared links')
  }

  function updateStatus(text) {
    const status = document.getElementById(STATUS_ID)
    if (status) status.textContent = text
  }

  function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString()
    const line = `[${timestamp}][${type}] ${message}`
    state.logLines.push(line)
    if (state.logLines.length > MAX_LOG_LINES) {
      state.logLines.splice(0, state.logLines.length - MAX_LOG_LINES)
    }
    const info = document.getElementById(INFO_ID)
    if (info) {
      info.value = state.logLines.join('\n')
      info.scrollTop = info.scrollHeight
    }
    if (type === 'error') console.error(line)
  }

  function makeDraggable(element, handle) {
    let startX = 0, startY = 0, startTop = 0, startLeft = 0
    handle.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return
      e.preventDefault()
      const rect = element.getBoundingClientRect()
      startX = e.clientX
      startY = e.clientY
      startTop = rect.top
      startLeft = rect.left
      element.style.right = 'auto'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp, { once: true })
    })
    function onMove(e) {
      const top = Math.max(0, Math.min(window.innerHeight - element.offsetHeight, startTop + e.clientY - startY))
      const left = Math.max(0, Math.min(window.innerWidth - element.offsetWidth, startLeft + e.clientX - startX))
      element.style.top = `${top}px`
      element.style.left = `${left}px`
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
    }
  }

  init()
})()
