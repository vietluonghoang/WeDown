// Tamper Monkey Script
// ==UserScript==
// @name         Get Odds Bwing
// @namespace    http://tampermonkey.net/
// @version      0.1.1
// @description  Simply get the odds
// @author       Viet Cat
// @match        https://*.bwinghotevent.co/*
// @match        *://*/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

/**
 * Main script function - wrapped in IIFE for scope isolation
 * This script creates a floating popup to collect and display betting odds
 * Features:
 * - Auto-refresh with dynamic intervals (5s default, 2s if no matches, 30s if matches found)
 * - Manual refresh with visual feedback
 * - Pause/resume functionality
 * - Draggable and resizable popup
 * - Collapsible interface
 */
;(function () {
  'use strict'

  try {
    console.log('Odds Collector: Script starting...')

    // ==================== CONSTANTS ====================
    const CONSTANTS = {
      REFRESH: {
        DEFAULT_INTERVAL: 5,
        NO_MATCHES_INTERVAL: 2,
        MATCHES_FOUND_INTERVAL: 30,
      },
      PERF: {
        DOM_OBSERVER_ENABLED: false,
        MIN_REFRESH_GAP_MS: 2000,
        CHILD_TIMEOUT_MS: 5000,
        CHILD_CACHE_MS: 0,
      },
      POPUP: {
        DEFAULT_WIDTH: 300,
        MIN_WIDTH: 200,
        MIN_HEIGHT: 150,
        HEADER_HEIGHT: 40,
        PADDING: 20,
        BORDER_WIDTH: 2,
        MARGIN_FROM_EDGE: 40,
      },
      COLORS: {
        HEADER_GRADIENT_START: '#8B0000',
        HEADER_GRADIENT_END: '#FF6B6B',
        BACKGROUND: '#f0f8ff',
        BORDER: '#ccc',
        HIGHLIGHT: '#ffffe0',
        HEADER_BACKGROUND: '#f8f9fa',
      },
      ANIMATIONS: {
        FLASH_DURATION: 1000,
        SPIN_DURATION: 1000,
      },
    }

    // ==================== SETTINGS (USER CONFIG) ====================
    const SETTINGS_STORAGE_KEY = 'odds_collector_settings_v1'
    const settings = loadSettings()

    function loadSettings() {
      try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
        const parsed = raw ? JSON.parse(raw) : {}
        return {
          defaultInterval:
            Number(parsed.defaultInterval) > 0
              ? Number(parsed.defaultInterval)
              : CONSTANTS.REFRESH.DEFAULT_INTERVAL,
          noMatchesInterval:
            Number(parsed.noMatchesInterval) > 0
              ? Number(parsed.noMatchesInterval)
              : CONSTANTS.REFRESH.NO_MATCHES_INTERVAL,
          matchesFoundInterval:
            Number(parsed.matchesFoundInterval) > 0
              ? Number(parsed.matchesFoundInterval)
              : CONSTANTS.REFRESH.MATCHES_FOUND_INTERVAL,
          stakeMatchOdd:
            Number(parsed.stakeMatchOdd) > 0
              ? Number(parsed.stakeMatchOdd)
              : 150,
          stakeOverUnder:
            Number(parsed.stakeOverUnder) > 0
              ? Number(parsed.stakeOverUnder)
              : 150,
          stake1X2: Number(parsed.stake1X2) > 0 ? Number(parsed.stake1X2) : 150,
          deltaOddMatch:
            Number(parsed.deltaOddMatch) >= 0
              ? Number(parsed.deltaOddMatch)
              : 0.05,
          deltaOddOverUnder:
            Number(parsed.deltaOddOverUnder) >= 0
              ? Number(parsed.deltaOddOverUnder)
              : 0.05,
          deltaOdd1X2:
            Number(parsed.deltaOdd1X2) >= 0 ? Number(parsed.deltaOdd1X2) : 0.05,
          maxBetsPerRound:
            Number(parsed.maxBetsPerRound) > 0
              ? Number(parsed.maxBetsPerRound)
              : 15,
        }
      } catch (_) {
        return {
          defaultInterval: CONSTANTS.REFRESH.DEFAULT_INTERVAL,
          noMatchesInterval: CONSTANTS.REFRESH.NO_MATCHES_INTERVAL,
          matchesFoundInterval: CONSTANTS.REFRESH.MATCHES_FOUND_INTERVAL,
          stakeMatchOdd: 150,
          stakeOverUnder: 150,
          stake1X2: 150,
          deltaOddMatch: 0.05,
          deltaOddOverUnder: 0.05,
          deltaOdd1X2: 0.05,
          maxBetsPerRound: 15,
        }
      }
    }

    function saveSettings(newSettings) {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings))
      } catch (_) {}
    }

    function getStakeForKind(kind) {
      try {
        if (kind === 'match') return Number(settings.stakeMatchOdd) || 150
        if (kind === 'overunder') return Number(settings.stakeOverUnder) || 150
        if (kind === '1x2') return Number(settings.stake1X2) || 150
        return 150
      } catch (_) {
        return 150
      }
    }

    function getDeltaOddForKind(kind) {
      try {
        if (kind === 'match') return Number(settings.deltaOddMatch) || 0.05
        if (kind === 'overunder')
          return Number(settings.deltaOddOverUnder) || 0.05
        if (kind === '1x2') return Number(settings.deltaOdd1X2) || 0.05
        return 0.05
      } catch (_) {
        return 0.05
      }
    }

    function isOddInDeltaRange(storedOdd, currentOdd, delta) {
      try {
        const stored = normalizeNumber(storedOdd)
        const current = normalizeNumber(currentOdd)
        if (!isFinite(stored) || !isFinite(current)) return false
        return Math.abs(stored - current) <= delta
      } catch (_) {
        return false
      }
    }

    // ==================== STATE MANAGEMENT ====================
    const state = {
      timeLeft: CONSTANTS.REFRESH.DEFAULT_INTERVAL,
      refreshIntervalId: null,
      isPaused: false,
      currentInterval: CONSTANTS.REFRESH.DEFAULT_INTERVAL,
      originalWidth: CONSTANTS.POPUP.DEFAULT_WIDTH,
      originalHeight: 0,
      isDragging: false,
      isResizing: false,
      isCollapsed: false,
      startX: 0,
      startY: 0,
      startLeft: 0,
      startTop: 0,
      startWidth: 0,
      startHeight: 0,
      lastRefreshAt: 0,
      isRefreshing: false,
      lastChildData: { timestamp: 0, data: [] },
      lastRenderSignature: '',
      lastMatchCount: 0,
      isUserScrolling: false,
      scrollIdleTimer: null,
      autoPlay: false,
      isAutoBetting: false,
      autoScrollLog: true,
      bettedOdds: new Set(), // Track odds that have been bet
      currentRoundBetCount: 0, // Count bets in current round
    }

    // ==================== XPath CONFIGURATION ====================
    const XPATH_CONFIG = {
      main: "//div[@id='mainArea']/div[contains(@class, 'odds')]/div[contains(@class, 'c-odds-table')]/div[contains(@class, 'c-league')]/div[contains(@class, 'c-match-group')]/div[contains(@class, 'c-match')]/div[contains(@class, 'bets')]/div[contains(@class, 'odds-group')]",
      oddsGroup: "./div[contains(@class, 'odds')]",
      expressions: {
        matchInfo: {
          teamA:
            "./div[contains(@class, 'odds')][1]/div[contains(@class, 'event')]/div[contains(@class, 'team')][1]/div[contains(@class, 'team')]/div[contains(@class, 'info')]/span/text()[1]",
          teamB:
            "./div[contains(@class, 'odds')][1]/div[contains(@class, 'event')]/div[contains(@class, 'team')][2]/div[contains(@class, 'team')]/div[contains(@class, 'info')]/span/text()[1]",
          time: "parent::div/preceding-sibling::div[contains(@class, 'mathch-header')]/div[contains(@class, 'row-title')]/div[contains(@class, 'info')]/span/text()",
        },
        matchOdd: {
          handicapA:
            "./div[contains(@class, 'bettype-col')][1]/div[contains(@class, 'odds-button')][1]/span[contains(@class, 'text-goal')]//text()[1]",
          teamAodd:
            "./div[contains(@class, 'bettype-col')][1]/div[contains(@class, 'odds-button')][1]/span[contains(@class, 'odds')]/text()[1]",
          handicapB:
            "./div[contains(@class, 'bettype-col')][1]/div[contains(@class, 'odds-button')][2]/span[contains(@class, 'text-goal')]//text()[1]",
          teamBodd:
            "./div[contains(@class, 'bettype-col')][1]/div[contains(@class, 'odds-button')][2]/span[contains(@class, 'odds')]/text()[1]",
        },
        odds1X2: {
          teamAodd:
            "./div[contains(@class, 'bettype-col')][3]/div[contains(@class, 'odds-button')][1]/span[contains(@class, 'odds')]/text()[1]",
          teamBodd:
            "./div[contains(@class, 'bettype-col')][3]/div[contains(@class, 'odds-button')][2]/span[contains(@class, 'odds')]/text()[1]",
          draw: "./div[contains(@class, 'bettype-col')][3]/div[contains(@class, 'odds-button')][3]/span[contains(@class, 'odds')]/text()[1]",
        },
        overUnder: {
          handicapA:
            "./div[contains(@class, 'bettype-col')][2]/div[contains(@class, 'odds-button')][1]/span[contains(@class, 'text-goal')]/text()[1]",
          teamAodd:
            "./div[contains(@class, 'bettype-col')][2]/div[contains(@class, 'odds-button')][1]/span[contains(@class, 'odds')]/text()[1]",
          handicapB:
            "./div[contains(@class, 'bettype-col')][2]/div[contains(@class, 'odds-button')][2]/span[contains(@class, 'text-goal')]/text()[1]",
          teamBodd:
            "./div[contains(@class, 'bettype-col')][2]/div[contains(@class, 'odds-button')][2]/span[contains(@class, 'odds')]/text()[1]",
        },
      },
    }

    // ==================== UTILITY FUNCTIONS ====================
    /**
     * Helper function to extract text content using XPath
     * @param {string} xpath - XPath expression to evaluate
     * @param {Node} context - Context node for XPath evaluation
     * @returns {string} - Concatenated text content from matching nodes
     */
    function getTextContent(xpath, context) {
      try {
        const result = document.evaluate(
          xpath,
          context,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        )
        let text = ''
        for (let i = 0; i < result.snapshotLength; i++) {
          text += result.snapshotItem(i).textContent.trim()
        }
        return text.trim()
      } catch (error) {
        console.error('Odds Collector: Error in getTextContent:', error)
        return ''
      }
    }

    /**
     * Creates a table cell with consistent styling
     * @param {string} content - Cell content
     * @param {Object} options - Styling options
     * @returns {HTMLElement} - Styled table cell
     */
    function createTableCell(content, options = {}) {
      const td = document.createElement('td')
      td.textContent = content

      const defaultStyle = `
                border: 1px solid ${CONSTANTS.COLORS.BORDER};
                padding: 4px;
                text-align: center;
                word-wrap: break-word;
                word-break: break-word;
                min-width: 60px;
            `

      const customStyle = options.style || ''
      td.style.cssText = defaultStyle + customStyle

      if (options.rowSpan) td.rowSpan = options.rowSpan
      if (options.colSpan) td.colSpan = options.colSpan
      if (options.backgroundColor)
        td.style.backgroundColor = options.backgroundColor

      return td
    }

    /**
     * Creates a block data structure for odds
     * @param {string} name - Block name
     * @param {Array} detailNames - Array of detail column names
     * @returns {Object} - Block structure
     */
    function createOddsBlock(name, detailNames) {
      return {
        name: name,
        detailNames: detailNames,
        details: [],
        meta: [],
      }
    }

    // ==================== EV CALCULATION UTILITIES ====================
    let _ocUniqueIdCounter = 1
    function generateUniqueId() {
      return (
        'ocbtn_' +
        _ocUniqueIdCounter++ +
        '_' +
        Math.random().toString(36).slice(2, 6)
      )
    }

    function ensureElementId(element) {
      if (!element) return null
      const existing = element.getAttribute('data-oc-id')
      if (existing) return existing
      const id = generateUniqueId()
      try {
        element.setAttribute('data-oc-id', id)
      } catch (_) {}
      return id
    }

    function firstNode(xpath, context) {
      try {
        return document.evaluate(
          xpath,
          context,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue
      } catch (_) {
        return null
      }
    }

    function isHiddenByAria(element) {
      try {
        if (!element) return false
        let node = element
        while (node) {
          if (node.getAttribute && node.getAttribute('aria-hidden') === 'true')
            return true
          node = node.parentElement
        }
        return false
      } catch (_) {
        return false
      }
    }

    function normalizeNumber(text) {
      if (text == null) return NaN
      const cleaned = String(text)
        .replace(/,/g, '.')
        .replace(/[^0-9.\/-]/g, '')
        .trim()
      if (!cleaned) return NaN
      if (cleaned.includes('/')) {
        const parts = cleaned.split('/').map((p) => parseFloat(p))
        const a = parts[0]
        const b = parts[1]
        if (!isNaN(a) && !isNaN(b)) return (a + b) / 2
      }
      const n = parseFloat(cleaned)
      return isNaN(n) ? NaN : n
    }

    function computeEVSpread(handicapA, oddA, handicapB, oddB) {
      const hA = Number(handicapA)
      const hB = Number(handicapB)
      const oA = Number(oddA)
      const oB = Number(oddB)
      if (!isFinite(hA) || !isFinite(hB) || !isFinite(oA) || !isFinite(oB))
        return NaN
      const denom = (1 - oB) * hB
      if (!isFinite(denom) || Math.abs(denom) < 1e-9) return NaN
      return ((1 - oA) * hA) / denom
    }

    function computeEV1X2(oddA, oddB, draw) {
      const oA = Number(oddA)
      const oB = Number(oddB)
      const d = Number(draw)
      if (!isFinite(oA) || !isFinite(oB) || !isFinite(d) || Math.abs(d) < 1e-9)
        return NaN
      return (oA - oB) / d
    }

    function formatEV(value) {
      if (!isFinite(value)) return '-'
      try {
        return value.toFixed(3)
      } catch {
        return String(value)
      }
    }

    // ==================== DATA EXTRACTION ====================
    /**
     * Helper function to wait for iframe to be accessible
     * @param {HTMLIFrameElement} iframe - The iframe element to wait for
     * @param {number} maxWaitTime - Maximum time to wait in milliseconds
     * @returns {Promise<Document|null>} - Promise that resolves to iframe document or null
     */
    function waitForIframeAccess(iframe, maxWaitTime = 10000) {
      return new Promise((resolve) => {
        if (!iframe) {
          resolve(null)
          return
        }

        // Check if already accessible
        try {
          if (iframe.contentDocument && iframe.contentDocument.body) {
            resolve(iframe.contentDocument)
            return
          }
        } catch (e) {
          console.log(
            'Odds Collector: Cross-origin iframe detected, trying alternative approach'
          )
        }

        // Wait for iframe to load
        const startTime = Date.now()
        const checkInterval = 100

        const checkAccess = () => {
          try {
            if (iframe.contentDocument && iframe.contentDocument.body) {
              resolve(iframe.contentDocument)
              return
            }
          } catch (e) {
            // Cross-origin error, continue waiting
          }

          if (Date.now() - startTime > maxWaitTime) {
            console.log('Odds Collector: Timeout waiting for iframe access')
            resolve(null)
            return
          }

          setTimeout(checkAccess, checkInterval)
        }

        // Start checking
        checkAccess()
      })
    }

    /**
     * Alternative method to access iframe content using postMessage or other techniques
     * @param {HTMLIFrameElement} iframe - The iframe element
     * @returns {Promise<Document|null>} - Promise that resolves to iframe document or null
     */
    function tryAlternativeIframeAccess(iframe) {
      return new Promise((resolve) => {
        if (!iframe) {
          resolve(null)
          return
        }

        console.log(
          'Odds Collector: Trying alternative iframe access methods...'
        )

        // Method 1: Wait for load event and try safe access
        iframe.addEventListener('load', () => {
          console.log('Odds Collector: Iframe load event fired')
          setTimeout(() => {
            try {
              if (iframe.contentDocument && iframe.contentDocument.body) {
                console.log('Odds Collector: Alternative method 1 successful')
                resolve(iframe.contentDocument)
                return
              }
            } catch (e) {
              console.log(
                'Odds Collector: Alternative method 1 failed (cross-origin):',
                e.message
              )
            }
            resolve(null)
          }, 2000)
        })

        // Method 2: Check if iframe is already loaded (safe way)
        try {
          if (iframe.contentWindow && iframe.contentWindow.document) {
            if (iframe.contentWindow.document.body) {
              console.log('Odds Collector: Alternative method 2 successful')
              resolve(iframe.contentWindow.document)
              return
            }
          }
        } catch (e) {
          console.log(
            'Odds Collector: Alternative method 2 failed (cross-origin):',
            e.message
          )
        }

        // Method 3: Try to access after a delay (safe way)
        setTimeout(() => {
          try {
            if (iframe.contentDocument && iframe.contentDocument.body) {
              console.log('Odds Collector: Alternative method 3 successful')
              resolve(iframe.contentDocument)
              return
            }
          } catch (e) {
            console.log(
              'Odds Collector: Alternative method 3 failed (cross-origin):',
              e.message
            )
          }
          resolve(null)
        }, 5000)
      })
    }

    /**
     * Try to access iframe using postMessage communication
     * @param {HTMLIFrameElement} iframe - The iframe to access
     * @returns {Promise<Document|null>} - Promise resolving to iframe document or null
     */
    function tryPostMessageAccess(iframe) {
      return new Promise((resolve) => {
        console.log(
          'Odds Collector: Trying postMessage communication with iframe...'
        )

        let responseReceived = false
        let timeoutId

        // Listen for response from iframe
        const messageHandler = (event) => {
          if (
            event.source === iframe.contentWindow &&
            event.data &&
            event.data.type === 'ODDS_COLLECTOR_RESPONSE'
          ) {
            console.log(
              'Odds Collector: Received response from iframe via postMessage'
            )
            responseReceived = true
            clearTimeout(timeoutId)
            window.removeEventListener('message', messageHandler)
            resolve(event.data.document || null)
          }
        }

        window.addEventListener('message', messageHandler)

        // Send message to iframe requesting access
        try {
          iframe.contentWindow.postMessage(
            {
              type: 'ODDS_COLLECTOR_REQUEST',
              action: 'GET_DOCUMENT_CONTENT',
            },
            '*'
          )

          console.log('Odds Collector: Sent postMessage to iframe')
        } catch (e) {
          console.log('Odds Collector: Failed to send postMessage:', e.message)
          clearTimeout(timeoutId)
          window.removeEventListener('message', messageHandler)
          resolve(null)
        }

        // Set timeout for response
        timeoutId = setTimeout(() => {
          if (!responseReceived) {
            console.log(
              'Odds Collector: PostMessage timeout - no response from iframe'
            )
            window.removeEventListener('message', messageHandler)
            resolve(null)
          }
        }, 3000)
      })
    }

    /**
     * Try to access iframe using iframe.src manipulation
     * @param {HTMLIFrameElement} iframe - The iframe to access
     * @returns {Promise<Document|null>} - Promise resolving to iframe document or null
     */
    function trySrcManipulation(iframe) {
      return new Promise((resolve) => {
        console.log('Odds Collector: Trying iframe src manipulation...')

        try {
          const originalSrc = iframe.src
          const currentOrigin = window.location.origin

          // Try to set same-origin src temporarily
          if (
            originalSrc &&
            !originalSrc.startsWith('data:') &&
            !originalSrc.startsWith('blob:')
          ) {
            const url = new URL(originalSrc, window.location.href)

            // Method 1: Try to proxy the iframe content through same origin
            iframe.src = `data:text/html,<script>window.parent.postMessage({type:'ODDS_COLLECTOR_RESPONSE',document:document},'${currentOrigin}');</script>`

            setTimeout(() => {
              try {
                if (iframe.contentDocument && iframe.contentDocument.body) {
                  console.log('Odds Collector: Src manipulation successful')
                  resolve(iframe.contentDocument)
                } else {
                  console.log(
                    'Odds Collector: Src manipulation failed - no document access'
                  )
                  resolve(null)
                }
              } catch (e) {
                console.log(
                  'Odds Collector: Src manipulation failed with error:',
                  e.message
                )
                resolve(null)
              } finally {
                // Restore original src
                iframe.src = originalSrc
              }
            }, 2000)
          } else {
            console.log(
              'Odds Collector: Cannot manipulate iframe src - invalid or data/blob URL'
            )
            resolve(null)
          }
        } catch (e) {
          console.log('Odds Collector: Src manipulation error:', e.message)
          resolve(null)
        }
      })
    }

    /**
     * Try to access iframe using sandbox attribute manipulation
     * @param {HTMLIFrameElement} iframe - The iframe to access
     * @returns {Promise<Document|null>} - Promise resolving to iframe document or null
     */
    function trySandboxManipulation(iframe) {
      return new Promise((resolve) => {
        console.log('Odds Collector: Trying sandbox attribute manipulation...')

        try {
          const originalSandbox = iframe.sandbox

          // Temporarily remove sandbox restrictions
          iframe.sandbox = ''

          setTimeout(() => {
            try {
              if (iframe.contentDocument && iframe.contentDocument.body) {
                console.log('Odds Collector: Sandbox manipulation successful')
                resolve(iframe.contentDocument)
                return
              } else {
                console.log(
                  'Odds Collector: Sandbox manipulation failed - no document access'
                )
                resolve(null)
              }
            } catch (e) {
              console.log(
                'Odds Collector: Sandbox manipulation failed with error:',
                e.message
              )
              resolve(null)
            } finally {
              // Restore original sandbox
              iframe.sandbox = originalSandbox
            }
          }, 1000)
        } catch (e) {
          console.log('Odds Collector: Sandbox manipulation error:', e.message)
          resolve(null)
        }
      })
    }

    /**
     * Try to access iframe using CORS bypass techniques
     * @param {HTMLIFrameElement} iframe - The iframe to access
     * @returns {Promise<Document|null>} - Promise resolving to iframe document or null
     */
    function tryCORSBypass(iframe) {
      return new Promise((resolve) => {
        console.log('Odds Collector: Trying CORS bypass techniques...')

        try {
          // Method 1: Try to inject a script into the iframe that communicates back
          const script = document.createElement('script')
          script.textContent = `
                        try {
                            const iframe = document.querySelector('iframe[title*="sport"]');
                            if (iframe && iframe.contentWindow) {
                                iframe.contentWindow.postMessage({
                                    type: 'ODDS_COLLECTOR_INJECT',
                                    script: \`
                                        window.parent.postMessage({
                                            type: 'ODDS_COLLECTOR_RESPONSE',
                                            document: document.documentElement.outerHTML
                                        }, '*');
                                    \`
                                }, '*');
                            }
                        } catch (e) {
                            console.log('Odds Collector: CORS bypass injection failed:', e.message);
                        }
                    `

          document.head.appendChild(script)
          document.head.removeChild(script)

          // Listen for response
          const messageHandler = (event) => {
            if (event.data && event.data.type === 'ODDS_COLLECTOR_RESPONSE') {
              console.log('Odds Collector: CORS bypass successful')
              window.removeEventListener('message', messageHandler)
              resolve(event.data.document || null)
            }
          }

          window.addEventListener('message', messageHandler)

          // Timeout
          setTimeout(() => {
            window.removeEventListener('message', messageHandler)
            console.log('Odds Collector: CORS bypass timeout')
            resolve(null)
          }, 5000)
        } catch (e) {
          console.log('Odds Collector: CORS bypass error:', e.message)
          resolve(null)
        }
      })
    }

    /**
     * Try to access iframe using fetch to get content from external URL
     * @param {HTMLIFrameElement} iframe - The iframe to access
     * @returns {Promise<Document|null>} - Promise resolving to iframe document or null
     */
    function tryFetchAccess(iframe) {
      return new Promise(async (resolve) => {
        console.log('Odds Collector: Trying fetch access to iframe content...')

        try {
          if (
            !iframe.src ||
            iframe.src.startsWith('data:') ||
            iframe.src.startsWith('blob:')
          ) {
            console.log(
              'Odds Collector: Cannot fetch iframe with data/blob URL'
            )
            resolve(null)
            return
          }

          // Try to fetch the iframe content directly
          const response = await fetch(iframe.src, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            headers: {
              'User-Agent': navigator.userAgent,
              Referer: window.location.href,
            },
          })

          if (response.ok) {
            const html = await response.text()
            console.log(
              'Odds Collector: Fetch successful, creating document from HTML'
            )

            // Create a new document from the fetched HTML
            const parser = new DOMParser()
            const doc = parser.parseFromString(html, 'text/html')

            if (doc.body) {
              console.log('Odds Collector: Fetch access successful')
              resolve(doc)
            } else {
              console.log(
                'Odds Collector: Fetch access failed - no body in parsed document'
              )
              resolve(null)
            }
          } else {
            console.log(
              'Odds Collector: Fetch failed with status:',
              response.status
            )
            resolve(null)
          }
        } catch (e) {
          console.log('Odds Collector: Fetch access error:', e.message)
          resolve(null)
        }
      })
    }

    /**
     * Try to access iframe using XMLHttpRequest (older browsers)
     * @param {HTMLIFrameElement} iframe - The iframe to access
     * @returns {Promise<Document|null>} - Promise resolving to iframe document or null
     */
    function tryXMLHttpRequestAccess(iframe) {
      return new Promise((resolve) => {
        console.log(
          'Odds Collector: Trying XMLHttpRequest access to iframe content...'
        )

        try {
          if (
            !iframe.src ||
            iframe.src.startsWith('data:') ||
            iframe.src.startsWith('blob:')
          ) {
            console.log(
              'Odds Collector: Cannot use XMLHttpRequest with data/blob URL'
            )
            resolve(null)
            return
          }

          const xhr = new XMLHttpRequest()
          xhr.open('GET', iframe.src, true)
          xhr.setRequestHeader('User-Agent', navigator.userAgent)
          xhr.setRequestHeader('Referer', window.location.href)

          xhr.onload = function () {
            if (xhr.status === 200) {
              console.log(
                'Odds Collector: XMLHttpRequest successful, creating document from HTML'
              )

              const html = xhr.responseText
              const parser = new DOMParser()
              const doc = parser.parseFromString(html, 'text/html')

              if (doc.body) {
                console.log('Odds Collector: XMLHttpRequest access successful')
                resolve(doc)
              } else {
                console.log(
                  'Odds Collector: XMLHttpRequest access failed - no body in parsed document'
                )
                resolve(null)
              }
            } else {
              console.log(
                'Odds Collector: XMLHttpRequest failed with status:',
                xhr.status
              )
              resolve(null)
            }
          }

          xhr.onerror = function () {
            console.log('Odds Collector: XMLHttpRequest error')
            resolve(null)
          }

          xhr.send()

          // Timeout
          setTimeout(() => {
            xhr.abort()
            console.log('Odds Collector: XMLHttpRequest timeout')
            resolve(null)
          }, 10000)
        } catch (e) {
          console.log('Odds Collector: XMLHttpRequest access error:', e.message)
          resolve(null)
        }
      })
    }

    /**
     * Try to access iframe using new tab approach with localStorage communication
     * @param {HTMLIFrameElement} iframe - The iframe to access
     * @returns {Promise<Document|null>} - Promise resolving to iframe document or null
     */
    function tryNewTabAccess(iframe) {
      return new Promise((resolve) => {
        console.log('Odds Collector: Trying new tab access approach...')

        try {
          if (
            !iframe.src ||
            iframe.src.startsWith('data:') ||
            iframe.src.startsWith('blob:')
          ) {
            console.log(
              'Odds Collector: Cannot use new tab approach with data/blob URL'
            )
            resolve(null)
            return
          }

          // Generate unique key for this request
          const requestId =
            'odds_collector_' +
            Date.now() +
            '_' +
            Math.random().toString(36).substr(2, 9)

          // Set up listener for localStorage changes
          const storageHandler = (e) => {
            if (e.key === requestId && e.newValue) {
              try {
                const data = JSON.parse(e.newValue)
                if (data.type === 'ODDS_COLLECTOR_TAB_RESPONSE') {
                  console.log('Odds Collector: New tab approach successful')

                  // Clean up
                  localStorage.removeItem(requestId)
                  window.removeEventListener('storage', storageHandler)

                  // Create document from received HTML
                  const parser = new DOMParser()
                  const doc = parser.parseFromString(data.html, 'text/html')

                  if (doc.body) {
                    resolve(doc)
                  } else {
                    resolve(null)
                  }
                }
              } catch (e) {
                console.log(
                  'Odds Collector: Error parsing new tab response:',
                  e.message
                )
                resolve(null)
              }
            }
          }

          window.addEventListener('storage', storageHandler)

          // Open iframe URL in new tab with script to extract content
          const newTabUrl =
            iframe.src +
            (iframe.src.includes('?') ? '&' : '?') +
            'odds_collector=1'
          const newTab = window.open(newTabUrl, '_blank')

          if (newTab) {
            // Inject script into new tab to extract content
            setTimeout(() => {
              try {
                newTab.postMessage(
                  {
                    type: 'ODDS_COLLECTOR_EXTRACT',
                    requestId: requestId,
                  },
                  '*'
                )
              } catch (e) {
                console.log(
                  'Odds Collector: Failed to postMessage to new tab:',
                  e.message
                )
              }
            }, 2000)

            // Timeout
            setTimeout(() => {
              localStorage.removeItem(requestId)
              window.removeEventListener('storage', storageHandler)
              newTab.close()
              console.log('Odds Collector: New tab approach timeout')
              resolve(null)
            }, 15000)
          } else {
            console.log('Odds Collector: Failed to open new tab')
            localStorage.removeItem(requestId)
            window.removeEventListener('storage', storageHandler)
            resolve(null)
          }
        } catch (e) {
          console.log('Odds Collector: New tab approach error:', e.message)
          resolve(null)
        }
      })
    }

    /**
     * Try to access iframe using proxy server approach
     * @param {HTMLIFrameElement} iframe - The iframe to access
     * @returns {Promise<Document|null>} - Promise resolving to iframe document or null
     */
    function tryProxyServerAccess(iframe) {
      return new Promise(async (resolve) => {
        console.log('Odds Collector: Trying proxy server approach...')

        try {
          if (
            !iframe.src ||
            iframe.src.startsWith('data:') ||
            iframe.src.startsWith('blob:')
          ) {
            console.log(
              'Odds Collector: Cannot use proxy server with data/blob URL'
            )
            resolve(null)
            return
          }

          // List of CORS proxy services
          const proxyServices = [
            'https://api.allorigins.win/raw?url=',
            'https://cors-anywhere.herokuapp.com/',
            'https://cors.bridged.cc/',
            'https://thingproxy.freeboard.io/fetch/',
            'https://corsproxy.io/?',
            'https://api.codetabs.com/v1/proxy?quest=',
          ]

          for (let i = 0; i < proxyServices.length; i++) {
            try {
              const proxyUrl = proxyServices[i] + encodeURIComponent(iframe.src)
              console.log(
                'Odds Collector: Trying proxy service',
                i + 1,
                ':',
                proxyUrl
              )

              const response = await fetch(proxyUrl, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit',
                headers: {
                  Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                  'Accept-Language': 'en-US,en;q=0.5',
                  'Accept-Encoding': 'gzip, deflate',
                  DNT: '1',
                  Connection: 'keep-alive',
                  'Upgrade-Insecure-Requests': '1',
                },
              })

              if (response.ok) {
                const html = await response.text()
                console.log(
                  'Odds Collector: Proxy service',
                  i + 1,
                  'successful'
                )

                // Create document from HTML
                const parser = new DOMParser()
                const doc = parser.parseFromString(html, 'text/html')

                if (doc.body) {
                  console.log('Odds Collector: Proxy server access successful')
                  resolve(doc)
                  return
                }
              }
            } catch (e) {
              console.log(
                'Odds Collector: Proxy service',
                i + 1,
                'failed:',
                e.message
              )
              continue
            }
          }

          console.log('Odds Collector: All proxy services failed')
          resolve(null)
        } catch (e) {
          console.log('Odds Collector: Proxy server approach error:', e.message)
          resolve(null)
        }
      })
    }

    /**
     * Try to access iframe using iframe cloning and manipulation
     * @param {HTMLIFrameElement} iframe - The iframe to access
     * @returns {Promise<Document|null>} - Promise resolving to iframe document or null
     */
    function tryIframeCloning(iframe) {
      return new Promise((resolve) => {
        console.log('Odds Collector: Trying iframe cloning approach...')

        try {
          // Create a clone of the iframe
          const clonedIframe = iframe.cloneNode(true)

          // Remove all restrictions
          clonedIframe.removeAttribute('sandbox')
          clonedIframe.removeAttribute('allow')
          clonedIframe.removeAttribute('referrerpolicy')

          // Set same-origin policy
          clonedIframe.setAttribute(
            'sandbox',
            'allow-same-origin allow-scripts allow-forms allow-popups'
          )

          // Try to inject content directly
          const testContent = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Test</title>
                        </head>
                        <body>
                            <script>
                                try {
                                    window.parent.postMessage({
                                        type: 'ODDS_COLLECTOR_CLONE_RESPONSE',
                                        document: document.documentElement.outerHTML
                                    }, '*');
                                } catch (e) {
                                    console.log('Clone script error:', e.message);
                                }
                            </script>
                            <div>Testing iframe access...</div>
                        </body>
                        </html>
                    `

          clonedIframe.src =
            'data:text/html;charset=utf-8,' + encodeURIComponent(testContent)

          // Listen for response
          const messageHandler = (event) => {
            if (
              event.data &&
              event.data.type === 'ODDS_COLLECTOR_CLONE_RESPONSE'
            ) {
              console.log('Odds Collector: Iframe cloning successful')
              window.removeEventListener('message', messageHandler)
              resolve(event.data.document || null)
            }
          }

          window.addEventListener('message', messageHandler)

          // Add cloned iframe to page temporarily
          clonedIframe.style.position = 'absolute'
          clonedIframe.style.left = '-9999px'
          clonedIframe.style.top = '-9999px'
          clonedIframe.style.width = '1px'
          clonedIframe.style.height = '1px'
          document.body.appendChild(clonedIframe)

          // Timeout
          setTimeout(() => {
            window.removeEventListener('message', messageHandler)
            document.body.removeChild(clonedIframe)
            console.log('Odds Collector: Iframe cloning timeout')
            resolve(null)
          }, 5000)
        } catch (e) {
          console.log('Odds Collector: Iframe cloning error:', e.message)
          resolve(null)
        }
      })
    }

    /**
     * Try to inject a script into the iframe to extract data
     * @param {HTMLIFrameElement} iframe - Iframe element
     * @returns {Promise<Document|null>} - Promise resolving to iframe document or null
     */
    async function tryIframeInjection(iframe) {
      try {
        console.log('Odds Collector: Trying iframe injection approach...')

        // Try to access the iframe's window
        const iframeWindow = iframe.contentWindow
        if (!iframeWindow) {
          console.log('Odds Collector: Cannot access iframe window')
          return null
        }

        // Create a script element to inject
        const script = document.createElement('script')
        script.textContent = `
                    // This script will run in the iframe context
                    try {
                        // Send the document content back to parent
                        window.parent.postMessage({
                            type: 'IFRAME_INJECTION_SUCCESS',
                            documentReady: document.readyState === 'complete',
                            bodyContent: document.body ? document.body.innerHTML.substring(0, 1000) : 'No body',
                            title: document.title
                        }, '*');
                    } catch (e) {
                        window.parent.postMessage({
                            type: 'IFRAME_INJECTION_ERROR',
                            error: e.message
                        }, '*');
                    }
                `

        // Set up message listener
        let receivedMessage = null
        const messagePromise = new Promise((resolve) => {
          const messageHandler = (event) => {
            if (event.data && event.data.type === 'IFRAME_INJECTION_SUCCESS') {
              receivedMessage = event.data
              resolve()
            } else if (
              event.data &&
              event.data.type === 'IFRAME_INJECTION_ERROR'
            ) {
              console.log(
                'Odds Collector: Iframe injection script error:',
                event.data.error
              )
              resolve()
            }
          }
          window.addEventListener('message', messageHandler)

          // Cleanup after timeout
          setTimeout(() => {
            window.removeEventListener('message', messageHandler)
            resolve()
          }, 5000)
        })

        // Inject the script into the iframe
        try {
          iframeWindow.document.head.appendChild(script)
        } catch (e) {
          console.log(
            'Odds Collector: Cannot inject script into iframe:',
            e.message
          )
          return null
        }

        // Wait for message or timeout
        await messagePromise

        if (receivedMessage && receivedMessage.documentReady) {
          console.log('Odds Collector: Iframe injection successful')
          // Try to access the iframe document now
          try {
            return iframe.contentDocument || iframe.contentWindow?.document
          } catch (e) {
            console.log(
              'Odds Collector: Still cannot access iframe document after injection'
            )
            return null
          }
        } else {
          console.log('Odds Collector: Iframe injection failed or timed out')
          return null
        }
      } catch (e) {
        console.log('Odds Collector: Error in iframe injection:', e.message)
        return null
      }
    }

    /**
     * Try to use a different approach - modify iframe attributes dynamically
     * @param {HTMLIFrameElement} iframe - Iframe element
     * @returns {Promise<Document|null>} - Promise resolving to iframe document or null
     */
    async function tryDynamicIframeModification(iframe) {
      try {
        console.log('Odds Collector: Trying dynamic iframe modification...')

        // Store original attributes
        const originalSrc = iframe.src
        const originalSandbox = iframe.sandbox
        const originalAllow = iframe.allow

        // Temporarily modify iframe attributes
        iframe.removeAttribute('sandbox')
        iframe.removeAttribute('allow')

        // Try to access the iframe now
        let iframeDocument = null
        try {
          iframeDocument =
            iframe.contentDocument || iframe.contentWindow?.document
        } catch (e) {
          console.log(
            'Odds Collector: Still cannot access iframe after attribute removal'
          )
        }

        // Restore original attributes
        if (originalSandbox) iframe.sandbox = originalSandbox
        if (originalAllow) iframe.allow = originalAllow

        if (iframeDocument) {
          console.log('Odds Collector: Dynamic iframe modification successful')
          return iframeDocument
        } else {
          console.log('Odds Collector: Dynamic iframe modification failed')
          return null
        }
      } catch (e) {
        console.log(
          'Odds Collector: Error in dynamic iframe modification:',
          e.message
        )
        return null
      }
    }

    /**
     * Try to use a different approach - create a new iframe with the same src
     * @param {HTMLIFrameElement} iframe - Iframe element
     * @returns {Promise<Document|null>} - Promise resolving to iframe document or null
     */
    async function tryNewIframeCreation(iframe) {
      try {
        console.log('Odds Collector: Trying new iframe creation approach...')

        // Create a completely new iframe
        const newIframe = document.createElement('iframe')
        newIframe.src = iframe.src
        newIframe.style.position = 'absolute'
        newIframe.style.left = '-9999px'
        newIframe.style.top = '-9999px'
        newIframe.style.width = '1px'
        newIframe.style.height = '1px'
        newIframe.style.opacity = '0'

        // Remove all restrictions
        newIframe.removeAttribute('sandbox')
        newIframe.removeAttribute('allow')
        newIframe.removeAttribute('referrerpolicy')

        // Add to page
        document.body.appendChild(newIframe)

        // Wait for load
        await new Promise((resolve) => {
          newIframe.onload = resolve
          setTimeout(resolve, 5000)
        })

        // Try to access
        let newIframeDocument = null
        try {
          newIframeDocument =
            newIframe.contentDocument || newIframe.contentWindow?.document
        } catch (e) {
          console.log('Odds Collector: Cannot access new iframe document')
        }

        // Cleanup
        document.body.removeChild(newIframe)

        if (newIframeDocument) {
          console.log('Odds Collector: New iframe creation successful')
          return newIframeDocument
        } else {
          console.log('Odds Collector: New iframe creation failed')
          return null
        }
      } catch (e) {
        console.log('Odds Collector: Error in new iframe creation:', e.message)
        return null
      }
    }

    /**
     * Extract matches from XPath snapshot
     * @param {XPathResult} matches - XPath snapshot result
     * @returns {Array} - Array of match data
     */
    function extractMatchesFromSnapshot(matches) {
      const extractedData = []
      let currentId = 1

      console.log(
        'Odds Collector: Starting extraction from',
        matches.snapshotLength,
        'matches...'
      )

      for (let i = 0; i < matches.snapshotLength; i++) {
        const match = matches.snapshotItem(i)
        console.log(
          'Odds Collector: Processing match',
          i,
          ':',
          match.className,
          match.textContent.substring(0, 100)
        )

        try {
          const teamA = getTextContent(
            XPATH_CONFIG.expressions.matchInfo.teamA,
            match
          )
          const teamB = getTextContent(
            XPATH_CONFIG.expressions.matchInfo.teamB,
            match
          )
          const matchTime = getTextContent(
            XPATH_CONFIG.expressions.matchInfo.time,
            match
          )

          console.log(
            'Odds Collector: Extracted basic info - TeamA:',
            teamA,
            'TeamB:',
            teamB,
            'Time:',
            matchTime
          )

          const matchData = extractMatchData(match, teamA, teamB)
          console.log('Odds Collector: Match data extracted:', matchData)

          extractedData.push({
            id: currentId++,
            blocks: matchData,
          })

          console.log(
            'Odds Collector: Successfully added match',
            i,
            'to extracted data'
          )
        } catch (e) {
          console.log(
            'Odds Collector: Error extracting match',
            i,
            ':',
            e.message
          )
          // No fallback - if iframe extraction fails, we don't want main document data
        }
      }

      console.log(
        'Odds Collector: Final extracted data count:',
        extractedData.length
      )
      return extractedData
    }

    /**
     * Extracts betting odds data from the page using XPath
     * @returns {Array} - Array of match data with odds
     */
    async function extractDataFromPage() {
      try {
        console.log('Odds Collector: Starting data extraction...')

        // Always request data from child frames via postMessage immediately
        const viaChildren = await requestDataFromChildren()
        return Array.isArray(viaChildren) ? viaChildren : []
      } catch (error) {
        console.error('Odds Collector: Error in extractDataFromPage:', error)
        return []
      }
    }

    /**
     * Extracts data for a single match
     * @param {Node} match - Match DOM node
     * @param {string} teamA - Team A name
     * @param {string} teamB - Team B name
     * @returns {Array} - Array of odds blocks
     */
    function extractMatchData(match, teamA, teamB) {
      const matchInfo = createOddsBlock('Kèo trận', [
        'EV',
        'Mốc kèo',
        teamA,
        teamB,
      ])
      const overUnder = createOddsBlock('Kèo Tài Xỉu', [
        'EV',
        'Mốc kèo',
        'Tài',
        'Xỉu',
      ])
      const odds1X2 = createOddsBlock('Kèo 1X2', ['EV', teamA, teamB, 'Hoà'])

      const oddsGroups = document.evaluate(
        XPATH_CONFIG.oddsGroup,
        match,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      )

      for (let j = 0; j < oddsGroups.snapshotLength; j++) {
        const oddsGroup = oddsGroups.snapshotItem(j)

        extractOddsFromGroup(oddsGroup, matchInfo, overUnder, odds1X2)
      }

      return [matchInfo, overUnder, odds1X2]
    }

    /**
     * Extracts odds data from a single odds group
     * @param {Node} oddsGroup - Odds group DOM node
     * @param {Object} matchInfo - Match info block
     * @param {Object} overUnder - Over/under block
     * @param {Object} odds1X2 - 1X2 odds block
     */
    function extractOddsFromGroup(oddsGroup, matchInfo, overUnder, odds1X2) {
      const mHandiAtext = getTextContent(
        XPATH_CONFIG.expressions.matchOdd.handicapA,
        oddsGroup
      )
      const mHandiBtext = getTextContent(
        XPATH_CONFIG.expressions.matchOdd.handicapB,
        oddsGroup
      )
      const mHandiDisplay = mHandiAtext === '' ? mHandiBtext : mHandiAtext
      const mOddAtext = getTextContent(
        XPATH_CONFIG.expressions.matchOdd.teamAodd,
        oddsGroup
      )
      const mOddBtext = getTextContent(
        XPATH_CONFIG.expressions.matchOdd.teamBodd,
        oddsGroup
      )
      // tag buttons for clicking
      const mBtnA = firstNode(
        "./div[contains(@class, 'bettype-col')][1]/div[contains(@class, 'odds-button')][1]",
        oddsGroup
      )
      const mBtnB = firstNode(
        "./div[contains(@class, 'bettype-col')][1]/div[contains(@class, 'odds-button')][2]",
        oddsGroup
      )
      const mBtnAId = ensureElementId(mBtnA)
      const mBtnBId = ensureElementId(mBtnB)
      const mEV = formatEV(
        computeEVSpread(
          normalizeNumber(mHandiAtext),
          normalizeNumber(mOddAtext),
          normalizeNumber(mHandiBtext),
          normalizeNumber(mOddBtext)
        )
      )

      matchInfo.details.push([
        [mEV, 0],
        [mHandiDisplay, 0],
        [mOddAtext, mHandiAtext === '' ? 0 : 1],
        [mOddBtext, mHandiBtext === '' ? 0 : 1],
      ])
      matchInfo.meta.push({
        aId: mBtnAId,
        bId: mBtnBId,
        aOdd: normalizeNumber(mOddAtext),
        bOdd: normalizeNumber(mOddBtext),
        kind: 'match',
      })

      const ouHandiAtext = getTextContent(
        XPATH_CONFIG.expressions.overUnder.handicapA,
        oddsGroup
      )
      const ouHandiBtext = getTextContent(
        XPATH_CONFIG.expressions.overUnder.handicapB,
        oddsGroup
      )
      const ouOddAtext = getTextContent(
        XPATH_CONFIG.expressions.overUnder.teamAodd,
        oddsGroup
      )
      const ouOddBtext = getTextContent(
        XPATH_CONFIG.expressions.overUnder.teamBodd,
        oddsGroup
      )
      // tag OU buttons
      const ouBtnA = firstNode(
        "./div[contains(@class, 'bettype-col')][2]/div[contains(@class, 'odds-button')][1]",
        oddsGroup
      )
      const ouBtnB = firstNode(
        "./div[contains(@class, 'bettype-col')][2]/div[contains(@class, 'odds-button')][2]",
        oddsGroup
      )
      const ouBtnAId = ensureElementId(ouBtnA)
      const ouBtnBId = ensureElementId(ouBtnB)
      const ouEV = formatEV(
        computeEVSpread(
          normalizeNumber(ouHandiAtext),
          normalizeNumber(ouOddAtext),
          normalizeNumber(ouHandiBtext),
          normalizeNumber(ouOddBtext)
        )
      )

      overUnder.details.push([
        [ouEV, 0],
        [ouHandiAtext, 0],
        [ouOddAtext, 0],
        [ouOddBtext, 0],
      ])
      overUnder.meta.push({
        aId: ouBtnAId,
        bId: ouBtnBId,
        aOdd: normalizeNumber(ouOddAtext),
        bOdd: normalizeNumber(ouOddBtext),
        kind: 'overunder',
      })

      const x2OddAtext = getTextContent(
        XPATH_CONFIG.expressions.odds1X2.teamAodd,
        oddsGroup
      )
      const x2OddBtext = getTextContent(
        XPATH_CONFIG.expressions.odds1X2.teamBodd,
        oddsGroup
      )
      const x2DrawText = getTextContent(
        XPATH_CONFIG.expressions.odds1X2.draw,
        oddsGroup
      )
      // tag 1X2 buttons (A=home, B=away)
      const x2BtnA = firstNode(
        "./div[contains(@class, 'bettype-col')][3]/div[contains(@class, 'odds-button')][1]",
        oddsGroup
      )
      const x2BtnB = firstNode(
        "./div[contains(@class, 'bettype-col')][3]/div[contains(@class, 'odds-button')][2]",
        oddsGroup
      )
      const x2BtnD = firstNode(
        "./div[contains(@class, 'bettype-col')][3]/div[contains(@class, 'odds-button')][3]",
        oddsGroup
      )
      const x2BtnAId = ensureElementId(x2BtnA)
      const x2BtnBId = ensureElementId(x2BtnB)
      const x2BtnDId = ensureElementId(x2BtnD)
      const x2EV = formatEV(
        computeEV1X2(
          normalizeNumber(x2OddAtext),
          normalizeNumber(x2OddBtext),
          normalizeNumber(x2DrawText)
        )
      )

      odds1X2.details.push([
        [x2EV, 0],
        [x2OddAtext, 0],
        [x2OddBtext, 0],
        [x2DrawText, 0],
      ])
      odds1X2.meta.push({
        aId: x2BtnAId,
        bId: x2BtnBId,
        dId: x2BtnDId,
        aOdd: normalizeNumber(x2OddAtext),
        bOdd: normalizeNumber(x2OddBtext),
        dOdd: normalizeNumber(x2DrawText),
        kind: '1x2',
      })
    }

    // ==================== TABLE UPDATES ====================
    /**
     * Updates the popup table with extracted data
     * @param {Array} data - Array of match data
     * @param {HTMLElement} tbody - Table body element to update
     */
    function updateTableWithData(data, tbody) {
      try {
        // Skip render if data unchanged
        const signature = JSON.stringify(data)
        if (signature === state.lastRenderSignature) {
          console.log('Odds Collector: Skipping table update - data unchanged')
          return
        }
        state.lastRenderSignature = signature

        // Preserve scroll position
        const scrollContainer = window.oddsCollectorMainContent
        const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0
        const prevScrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0

        tbody.innerHTML = ''
        const fragment = document.createDocumentFragment()

        data.forEach((entity) => {
          const maxDetails = Math.max(
            ...entity.blocks.map((block) => block.details.length)
          )
          const totalRows = 2 + maxDetails

          // Build rows into fragment to reduce reflows
          for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
            const tr = document.createElement('tr')
            if (rowIndex === 0) {
              tr.appendChild(
                createTableCell(entity.id, {
                  rowSpan: totalRows,
                  style: 'min-width: 30px;',
                })
              )
            }
            entity.blocks.forEach((block) => {
              if (rowIndex === 0) {
                tr.appendChild(
                  createTableCell(block.name, {
                    colSpan: 4,
                    style: `background-color: ${CONSTANTS.COLORS.HEADER_BACKGROUND}; font-weight: bold; min-width: 80px;`,
                  })
                )
              } else if (rowIndex === 1) {
                block.detailNames.forEach((name) => {
                  tr.appendChild(
                    createTableCell(name, {
                      style: `background-color: ${CONSTANTS.COLORS.HEADER_BACKGROUND}; min-width: 60px;`,
                    })
                  )
                })
              } else {
                const detailIndex = rowIndex - 2
                const details = block.details[detailIndex] || ['', '', '', '']
                details.forEach((value, colIdx) => {
                  const style =
                    value[1] == 1
                      ? `background-color: ${CONSTANTS.COLORS.HIGHLIGHT};`
                      : ''
                  const td = createTableCell(value[0], { style })
                  // Add click behavior on EV cell (first column of each block row)
                  if (colIdx === 0 && block.meta && block.meta[detailIndex]) {
                    td.style.cursor = 'pointer'
                    const meta = block.meta[detailIndex]
                    td.addEventListener('click', () => {
                      const evText = value[0]
                      if (evText === '-') return
                      const evVal = normalizeNumber(evText)
                      let targetId = null
                      let fallbackId = null
                      if (
                        meta.kind === '1x2' &&
                        isFinite(evVal) &&
                        evVal === 0
                      ) {
                        targetId = meta.dId || null
                        fallbackId = meta.aId || meta.bId || null
                      } else {
                        const preferA = isFinite(evVal) && evVal > 0
                        targetId = preferA ? meta.aId : meta.bId
                        fallbackId = preferA ? meta.bId : meta.aId
                      }
                      const amount = getStakeForKind(meta.kind)
                      try {
                        window.postMessage(
                          {
                            type: 'ODDS_COLLECTOR_CLICK',
                            targetId,
                            fallbackId,
                            ttl: 3,
                            amount,
                          },
                          '*'
                        )
                        window.logToPopup(
                          `Requested click on ${
                            meta.kind === '1x2' &&
                            isFinite(evVal) &&
                            evVal === 0
                              ? 'Draw'
                              : isFinite(evVal) && evVal > 0
                              ? 'A'
                              : 'B'
                          } with id ${targetId} (amount=${amount})`
                        )
                      } catch (_) {}
                    })
                  }
                  tr.appendChild(td)
                })
              }
            })
            if (rowIndex === 0) {
              tr.appendChild(
                createTableCell('', {
                  rowSpan: totalRows,
                  style: 'min-width: 30px;',
                })
              )
            }
            fragment.appendChild(tr)
          }
        })

        tbody.appendChild(fragment)

        // Adjust width and restore scroll on next frame to avoid layout thrash
        requestAnimationFrame(() => {
          if (scrollContainer) {
            const maxTop = Math.max(
              0,
              scrollContainer.scrollHeight - scrollContainer.clientHeight
            )
            scrollContainer.scrollTop = Math.min(prevScrollTop, maxTop)
            scrollContainer.scrollLeft = prevScrollLeft
          }
          if (!state.isUserScrolling) {
            adjustPopupWidth()
          }
          // Trigger header flash
          const header = window.oddsCollectorHeader
          if (header) {
            header.classList.add('header-updated')
            setTimeout(() => header.classList.remove('header-updated'), 800)
          }
        })
      } catch (error) {
        console.error('Odds Collector: Error in updateTableWithData:', error)
      }
    }

    /**
     * Adjusts popup width based on table content
     */
    function adjustPopupWidth() {
      const table = document.querySelector('#odds-collector-popup table')
      if (!table) return

      // Use scrollWidth to estimate required width of table content
      const requiredWidth = table.scrollWidth

      const popup = document.getElementById('odds-collector-popup')
      if (popup) {
        const newWidth = Math.min(
          Math.max(
            requiredWidth + CONSTANTS.POPUP.BORDER_WIDTH,
            CONSTANTS.POPUP.MIN_WIDTH
          ),
          window.innerWidth - CONSTANTS.POPUP.MARGIN_FROM_EDGE
        )

        popup.style.width = `${newWidth}px`

        state.originalWidth = newWidth
        state.originalHeight = popup.offsetHeight

        window.logToPopup(`Popup width adjusted to ${newWidth}px`)
      }
    }

    // ==================== REFRESH MANAGEMENT ====================
    /**
     * Main refresh function - extracts and updates data
     * Also manages refresh interval based on results
     */
    async function refreshData() {
      try {
        const now = Date.now()
        // Hard gate: do not refresh if within the lock window
        if (state.nextAllowedRefreshAt && now < state.nextAllowedRefreshAt) {
          console.log(
            'Odds Collector: Skipping refresh - locked until next interval'
          )
          return
        }
        if (state.isRefreshing) {
          console.log('Odds Collector: Skipping refresh - already in progress')
          return
        }
        if (now - state.lastRefreshAt < CONSTANTS.PERF.MIN_REFRESH_GAP_MS) {
          console.log('Odds Collector: Skipping refresh - within min gap')
          return
        }
        state.isRefreshing = true
        state.lastRefreshAt = now
        console.log('Odds Collector: Refreshing data...')

        // While refresh in progress, requestDataFromChildren will broadcast repeatedly until first non-empty payload
        const extractedData = await extractDataFromPage()

        if (window.oddsCollectorTbody) {
          updateTableWithData(extractedData, window.oddsCollectorTbody)
        }

        updateRefreshInterval(extractedData.length)
        // Reset countdown to reflect new interval
        state.timeLeft = state.currentInterval
        if (window.oddsCollectorRefreshIndicator) {
          window.oddsCollectorRefreshIndicator.textContent = `Auto-refresh in: ${state.timeLeft}s`
        }
        // Lock further refreshes until current interval elapses
        state.nextAllowedRefreshAt =
          Date.now() + state.currentInterval * 1000 - 100
        window.logToPopup(
          `Successfully extracted ${
            extractedData.length
          } matches at ${new Date().toLocaleTimeString()}`
        )
        console.log('Extracted data:', extractedData)

        // Auto-bet flow if enabled
        window.logToPopup(
          `Auto-bet check: autoPlay=${state.autoPlay}, dataLength=${
            extractedData ? extractedData.length : 0
          }`
        )
        if (state.autoPlay && extractedData && extractedData.length > 0) {
          window.logToPopup(
            `Starting auto-bet with ${extractedData.length} matches`
          )
          await withRefreshSuspended(async () => {
            await runAutoBetOnData(extractedData)
          })
        }

        console.log('Odds Collector: Refresh complete')
      } catch (error) {
        console.error('Odds Collector: Error in refreshData:', error)
        window.logToPopup(`Error extracting data: ${error.message}`)
      } finally {
        state.isRefreshing = false
      }
    }

    /**
     * Updates refresh interval based on match results
     * @param {number} matchCount - Number of matches found
     */
    function updateRefreshInterval(matchCount) {
      state.lastMatchCount = matchCount
      if (matchCount === 0) {
        state.currentInterval = settings.noMatchesInterval
        window.logToPopup(
          `No matches found. Changing refresh interval to ${state.currentInterval}s`
        )
      } else {
        state.currentInterval = settings.matchesFoundInterval
        window.logToPopup(
          `Found ${matchCount} matches. Changing refresh interval to ${state.currentInterval}s`
        )
      }
    }

    /**
     * Starts the auto-refresh interval
     * Manages countdown and refresh timing
     */
    function startRefreshInterval() {
      try {
        if (state.refreshIntervalId) {
          clearInterval(state.refreshIntervalId)
        }

        // Initialize countdown display with current interval
        state.timeLeft = state.currentInterval
        if (window.oddsCollectorRefreshIndicator) {
          window.oddsCollectorRefreshIndicator.textContent = `Auto-refresh in: ${state.timeLeft}s`
        }

        state.refreshIntervalId = setInterval(() => {
          if (!state.isPaused) {
            state.timeLeft--
            if (state.timeLeft <= 0) {
              refreshData()
              state.timeLeft = state.currentInterval
            }
            window.oddsCollectorRefreshIndicator.textContent = `Auto-refresh in: ${state.timeLeft}s`
          }
        }, 1000)
      } catch (error) {
        console.error('Odds Collector: Error in startRefreshInterval:', error)
      }
    }

    // ==================== EVENT HANDLERS ====================
    /**
     * Sets up drag and drop functionality for the popup
     * @param {HTMLElement} popup - Popup element
     * @param {HTMLElement} header - Header element
     */
    function setupDragAndDrop(popup, header) {
      const handleMouseDown = (e) => {
        if (
          e.target === header ||
          e.target.closest('.title-container') ||
          e.target.closest('.title')
        ) {
          state.isDragging = true
          state.startX = e.clientX
          state.startY = e.clientY
          const rect = popup.getBoundingClientRect()
          state.startLeft = rect.left
          state.startTop = rect.top
          e.preventDefault()
        }
      }

      const handleMouseMove = (e) => {
        if (!state.isDragging) return

        const dx = e.clientX - state.startX
        const dy = e.clientY - state.startY

        popup.style.left = `${state.startLeft + dx}px`
        popup.style.top = `${state.startTop + dy}px`
      }

      const handleMouseUp = () => {
        state.isDragging = false
      }

      header.addEventListener('mousedown', handleMouseDown)
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      // Store cleanup function
      popup._dragCleanup = () => {
        header.removeEventListener('mousedown', handleMouseDown)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }

    /**
     * Sets up resize functionality for the popup
     * @param {HTMLElement} popup - Popup element
     * @param {HTMLElement} resizeHandle - Resize handle element
     */
    function setupResize(popup, resizeHandle) {
      let resizing = false
      let startX = 0
      let startY = 0
      let startWidth = 0
      let startHeight = 0
      let contentWrapper = popup.querySelector(
        'div[style*="flex-direction: column"]'
      )
      let wasPaused = false

      const downEvent = window.PointerEvent ? 'pointerdown' : 'mousedown'
      const moveEvent = window.PointerEvent ? 'pointermove' : 'mousemove'
      const upEvent = window.PointerEvent ? 'pointerup' : 'mouseup'

      function onPointerDown(e) {
        e.preventDefault()
        e.stopPropagation()
        resizing = true
        startX = e.clientX
        startY = e.clientY
        startWidth = popup.offsetWidth
        startHeight = popup.offsetHeight
        // Ẩn nội dung bên trong popup (chỉ ẩn content, không ẩn header)
        if (contentWrapper) contentWrapper.style.visibility = 'hidden'
        // Tạm dừng refresh nếu chưa dừng
        wasPaused = state.isPaused
        state.isPaused = true
        if (window.oddsCollectorRefreshIndicator) {
          window.oddsCollectorRefreshIndicator.textContent =
            'Auto-refresh is paused'
        }
        window.addEventListener(moveEvent, onPointerMove, true)
        window.addEventListener(upEvent, onPointerUp, true)
      }

      function onPointerMove(e) {
        if (!resizing) return
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        const newWidth = Math.max(CONSTANTS.POPUP.MIN_WIDTH, startWidth + dx)
        const newHeight = Math.max(CONSTANTS.POPUP.MIN_HEIGHT, startHeight + dy)
        popup.style.width = newWidth + 'px'
        popup.style.height = newHeight + 'px'
      }

      function onPointerUp(e) {
        if (!resizing) return
        resizing = false
        window.removeEventListener(moveEvent, onPointerMove, true)
        window.removeEventListener(upEvent, onPointerUp, true)
        // Hiện lại nội dung
        if (contentWrapper) contentWrapper.style.visibility = ''
        state.originalWidth = popup.offsetWidth
        state.originalHeight = popup.offsetHeight
        // Nếu trước đó không pause thì resume lại refresh
        if (!wasPaused) {
          state.isPaused = false
          if (window.oddsCollectorRefreshIndicator) {
            state.timeLeft = state.currentInterval
            window.oddsCollectorRefreshIndicator.textContent = `Auto-refresh in: ${state.timeLeft}s`
          }
          refreshData()
        }
      }

      resizeHandle.addEventListener(downEvent, onPointerDown, true)

      popup._resizeCleanup = () => {
        resizeHandle.removeEventListener(downEvent, onPointerDown, true)
        window.removeEventListener(moveEvent, onPointerMove, true)
        window.removeEventListener(upEvent, onPointerUp, true)
      }
    }

    /**
     * Sets up toggle functionality for the popup
     * @param {HTMLElement} popup - Popup element
     * @param {HTMLElement} toggleBtn - Toggle button
     * @param {HTMLElement} contentWrapper - Content wrapper
     */
    function setupToggle(popup, toggleBtn, contentWrapper) {
      toggleBtn.addEventListener('click', () => {
        state.isCollapsed = !state.isCollapsed
        if (state.isCollapsed) {
          // Lưu lại kích thước hiện tại trước khi thu gọn
          state.originalWidth = popup.offsetWidth
          state.originalHeight = popup.offsetHeight
          // Đặt minWidth đủ lớn để chứa header và các nút
          const minHeaderWidth = 520 // Tùy chỉnh nếu cần, đảm bảo đủ cho tất cả nút
          popup.style.height = `${CONSTANTS.POPUP.HEADER_HEIGHT}px`
          popup.style.width = `${minHeaderWidth}px`
          popup.style.minWidth = `${minHeaderWidth}px`
          popup.style.minHeight = `${CONSTANTS.POPUP.HEADER_HEIGHT}px`
          contentWrapper.style.display = 'none'
          toggleBtn.textContent = '+'
        } else {
          // Mở lại đúng kích thước trước khi thu gọn
          popup.style.height = `${
            state.originalHeight || CONSTANTS.POPUP.MIN_HEIGHT
          }px`
          popup.style.width = `${
            state.originalWidth || CONSTANTS.POPUP.DEFAULT_WIDTH
          }px`
          popup.style.minHeight = `${CONSTANTS.POPUP.MIN_HEIGHT}px`
          popup.style.minWidth = `${CONSTANTS.POPUP.MIN_WIDTH}px`
          contentWrapper.style.display = 'flex'
          toggleBtn.textContent = '−'
        }
      })
    }

    /**
     * Sets up refresh button functionality
     * @param {HTMLElement} refreshButton - Refresh button
     */
    function setupRefreshButton(refreshButton) {
      refreshButton.addEventListener('click', () => {
        try {
          refreshButton.classList.add('spinning')
          refreshData()
          state.timeLeft = state.currentInterval
          window.oddsCollectorRefreshIndicator.textContent = `Auto-refresh in: ${state.timeLeft}s`
          setTimeout(() => {
            refreshButton.classList.remove('spinning')
          }, CONSTANTS.ANIMATIONS.SPIN_DURATION)
          window.logToPopup('Manual refresh triggered')
        } catch (error) {
          console.error('Odds Collector: Error in refresh button click:', error)
        }
      })
    }

    /**
     * Sets up refresh indicator functionality
     * @param {HTMLElement} refreshIndicator - Refresh indicator
     * @param {HTMLElement} header - Header element
     * @param {HTMLElement} refreshButton - Refresh button
     */
    function setupRefreshIndicator(refreshIndicator, header, refreshButton) {
      refreshIndicator.addEventListener('click', () => {
        try {
          if (state.isPaused) {
            // Resume refresh
            state.isPaused = false
            header.classList.remove('flashing')
            refreshData()
            state.timeLeft = state.currentInterval
            refreshIndicator.textContent = `Auto-refresh in: ${state.timeLeft}s`
            refreshButton.style.display = 'flex'
            startRefreshInterval()
            window.logToPopup('Auto-refresh resumed with immediate refresh')
          } else {
            // Pause refresh
            state.isPaused = true
            header.classList.add('flashing')
            refreshIndicator.textContent = 'Auto-refresh is paused'
            refreshButton.style.display = 'none'
            window.logToPopup('Auto-refresh paused')
          }
        } catch (error) {
          console.error(
            'Odds Collector: Error in refresh indicator click:',
            error
          )
        }
      })
    }

    /**
     * Observe DOM changes and debounce a refresh
     */
    function setupDOMObserver() {
      try {
        if (!CONSTANTS.PERF.DOM_OBSERVER_ENABLED) {
          console.log('Odds Collector: DOM observer disabled by config')
          return
        }
        const observer = new MutationObserver(() => {
          try {
            if (state.isPaused) return
            if (window._oddsCollectorDomDebounce) {
              clearTimeout(window._oddsCollectorDomDebounce)
            }
            window._oddsCollectorDomDebounce = setTimeout(() => {
              const now = Date.now()
              if (now - state.lastRefreshAt < CONSTANTS.PERF.MIN_REFRESH_GAP_MS)
                return
              refreshData()
              state.timeLeft = state.currentInterval
              if (window.oddsCollectorRefreshIndicator) {
                window.oddsCollectorRefreshIndicator.textContent = `Auto-refresh in: ${state.timeLeft}s`
              }
            }, 1000)
          } catch (e) {
            console.error('Odds Collector: DOM observer refresh error:', e)
          }
        })
        observer.observe(document.body, { childList: true, subtree: true })
        window._oddsCollectorDomObserver = observer
      } catch (e) {
        console.error('Odds Collector: Error setting up DOM observer:', e)
      }
    }

    /**
     * Extract data from a given document using configured XPath
     * @param {Document} doc
     * @returns {Array}
     */
    function extractDataFromDocument(doc) {
      try {
        const matches = doc.evaluate(
          XPATH_CONFIG.main,
          doc,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        )
        const extractedData = []
        let currentId = 1
        for (let i = 0; i < matches.snapshotLength; i++) {
          const match = matches.snapshotItem(i)
          const teamA = getTextContent(
            XPATH_CONFIG.expressions.matchInfo.teamA,
            match
          )
          const teamB = getTextContent(
            XPATH_CONFIG.expressions.matchInfo.teamB,
            match
          )
          // time may not be used in table rows yet, but keep extraction consistent
          const _matchTime = getTextContent(
            XPATH_CONFIG.expressions.matchInfo.time,
            match
          )
          const matchData = extractMatchData(match, teamA, teamB)
          extractedData.push({ id: currentId++, blocks: matchData })
        }
        return extractedData
      } catch (e) {
        console.error('Odds Collector: Error in extractDataFromDocument:', e)
        return []
      }
    }

    /**
     * Request odds data from child iframes via postMessage
     * @returns {Promise<Array>}
     */
    function requestDataFromChildren(
      timeoutMs = CONSTANTS.PERF.CHILD_TIMEOUT_MS
    ) {
      return new Promise((resolve) => {
        try {
          const iframes = Array.from(document.querySelectorAll('iframe'))
          if (iframes.length === 0) return resolve([])

          const requestId =
            'oc_' + Date.now() + '_' + Math.random().toString(36).slice(2)
          let resolved = false
          let bestPayload = []

          const handler = (event) => {
            try {
              if (
                !event.data ||
                event.data.type !== 'ODDS_COLLECTOR_DATA' ||
                event.data.requestId !== requestId
              )
                return
              const payload = Array.isArray(event.data.payload)
                ? event.data.payload
                : []
              if (payload.length > bestPayload.length) {
                bestPayload = payload
              }
              if (payload.length > 0 && !resolved) {
                resolved = true
                cleanupListeners()
                resolve(payload)
              }
            } catch (_) {}
          }

          const sendOnce = () => {
            if (resolved) return
            iframes.forEach((f) => {
              try {
                f.contentWindow &&
                  f.contentWindow.postMessage(
                    { type: 'ODDS_COLLECTOR_EXTRACT_DATA', ttl: 2, requestId },
                    '*'
                  )
              } catch (_) {}
            })
          }

          const cleanupListeners = () => {
            window.removeEventListener('message', handler)
            if (intervalId) clearInterval(intervalId)
            if (timeoutId) clearTimeout(timeoutId)
          }

          window.addEventListener('message', handler)
          sendOnce()
          const intervalId = setInterval(sendOnce, 400) // faster while waiting
          const timeoutId = setTimeout(() => {
            if (!resolved) {
              resolved = true
              cleanupListeners()
              resolve(bestPayload)
            }
          }, timeoutMs)
        } catch (e) {
          resolve([])
        }
      })
    }

    /**
     * Collect data from descendant iframes recursively (to be used inside frames)
     */
    function collectFromDescendants(timeoutMs = 2500, ttl = 1, requestId = '') {
      return new Promise((resolve) => {
        try {
          if (ttl <= 0) return resolve([])
          const iframes = Array.from(document.querySelectorAll('iframe'))
          if (iframes.length === 0) return resolve([])

          let resolved = false
          let bestPayload = []

          const handler = (event) => {
            try {
              if (
                !event.data ||
                event.data.type !== 'ODDS_COLLECTOR_DATA' ||
                event.data.requestId !== requestId
              )
                return
              const payload = Array.isArray(event.data.payload)
                ? event.data.payload
                : []
              if (payload.length > bestPayload.length) {
                bestPayload = payload
              }
              if (payload.length > 0 && !resolved) {
                resolved = true
                cleanup()
                resolve(payload)
              }
            } catch (_) {}
          }

          const sendReq = () => {
            if (resolved) return
            iframes.forEach((f) => {
              try {
                f.contentWindow &&
                  f.contentWindow.postMessage(
                    {
                      type: 'ODDS_COLLECTOR_EXTRACT_DATA',
                      ttl: ttl - 1,
                      requestId,
                    },
                    '*'
                  )
              } catch (_) {}
            })
          }

          const cleanup = () => {
            window.removeEventListener('message', handler)
            if (intervalId) clearInterval(intervalId)
            if (timeoutId) clearTimeout(timeoutId)
          }

          window.addEventListener('message', handler)
          sendReq()
          const intervalId = setInterval(sendReq, 800)
          const timeoutId = setTimeout(() => {
            if (!resolved) {
              resolved = true
              cleanup()
              resolve(bestPayload)
            }
          }, timeoutMs)
        } catch (e) {
          resolve([])
        }
      })
    }

    // ==================== POPUP CREATION ====================
    /**
     * Creates the header section of the popup
     * @returns {HTMLElement} - Header element
     */
    function createHeader() {
      const header = document.createElement('div')
      header.style.cssText = `
                padding: 8px;
                background: linear-gradient(to right, ${CONSTANTS.COLORS.HEADER_GRADIENT_START}, ${CONSTANTS.COLORS.HEADER_GRADIENT_END});
                border-bottom: 1px solid ${CONSTANTS.COLORS.BORDER};
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
                user-select: none;
                flex-shrink: 0;
                box-sizing: border-box;
                height: ${CONSTANTS.POPUP.HEADER_HEIGHT}px;
                line-height: 24px;
                color: white;
                min-width: 520px; /* Đảm bảo header không nhỏ hơn tổng chiều rộng các nút */
            `

      return header
    }

    /**
     * Creates the title section of the header
     * @returns {HTMLElement} - Title container
     */
    function createTitleSection() {
      const titleContainer = document.createElement('div')
      titleContainer.className = 'title-container'
      titleContainer.style.cssText = `
                display: flex;
                align-items: center;
                min-width: 0;
                gap: 16px;
            `

      const title = document.createElement('span')
      title.className = 'title'
      title.textContent = 'Odds Collector'
      title.style.cssText = `
                font-weight: bold;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                color: white;
                flex-shrink: 0;
                min-width: 90px;
            `

      titleContainer.appendChild(title)
      return titleContainer
    }

    /**
     * Creates the refresh controls section
     * @returns {Object} - Object containing refresh elements
     */
    function createRefreshControls() {
      const refreshContainer = document.createElement('div')
      refreshContainer.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            `

      const refreshIndicator = document.createElement('span')
      refreshIndicator.style.cssText = `
                font-size: 12px;
                color: #ccc;
                min-width: 80px;
                text-align: right;
                cursor: pointer;
                user-select: none;
            `
      refreshIndicator.textContent = `Auto-refresh in: ${state.timeLeft}s`

      const refreshButton = document.createElement('button')
      refreshButton.innerHTML = '↻'
      refreshButton.style.cssText = `
                background: none;
                border: none;
                color: #ccc;
                cursor: pointer;
                font-size: 14px;
                padding: 0 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s;
            `
      refreshButton.title = 'Refresh now'

      // Đảo thứ tự: nút refresh trước, rồi đến indicator để khi đặt bên phải (row-reverse) sẽ thành title, indicator, refresh
      refreshContainer.appendChild(refreshButton)
      refreshContainer.appendChild(refreshIndicator)

      return { refreshContainer, refreshIndicator, refreshButton }
    }

    function createSettingsButton() {
      const btn = document.createElement('button')
      btn.textContent = '⚙️'
      btn.style.cssText = `
                border: none;
                background: none;
                cursor: pointer;
                font-size: 16px;
                padding: 0 6px;
                flex-shrink: 0;
                margin-left: 4px;
                color: white;
            `
      btn.title = 'Settings'
      return btn
    }

    function createSettingsPanel() {
      const panel = document.createElement('div')
      panel.style.cssText = `
                position: absolute;
                top: ${CONSTANTS.POPUP.HEADER_HEIGHT + 4}px;
                left: 8px;
                background: white;
                border: 1px solid ${CONSTANTS.COLORS.BORDER};
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                border-radius: 4px;
                padding: 10px;
                z-index: 10000;
                min-width: 260px;
                display: none;
                font-size: 12px;
            `

      // Tabs
      const tabBar = document.createElement('div')
      tabBar.style.cssText = 'display: flex; gap: 8px; margin-bottom: 10px;'
      const tabInterval = document.createElement('button')
      tabInterval.textContent = 'Interval'
      tabInterval.style.cssText =
        'flex:1; padding: 4px 0; border:none; border-bottom:2px solid transparent; background:none; font-weight:bold; cursor:pointer;'
      const tabStake = document.createElement('button')
      tabStake.textContent = 'Stake'
      tabStake.style.cssText =
        'flex:1; padding: 4px 0; border:none; border-bottom:2px solid #8B0000; background:none; font-weight:bold; cursor:pointer;'
      tabBar.appendChild(tabInterval)
      tabBar.appendChild(tabStake)
      panel.appendChild(tabBar)

      // Content containers
      const intervalContent = document.createElement('div')
      const stakeContent = document.createElement('div')
      stakeContent.style.display = ''

      // Helper to create field
      const field = (labelText, initValue, id) => {
        const row = document.createElement('div')
        row.style.cssText =
          'display: flex; align-items: center; justify-content: space-between; margin: 6px 0; gap: 8px;'
        const label = document.createElement('label')
        label.textContent = labelText
        label.style.cssText = 'flex: 1;'
        label.setAttribute('for', id)
        const input = document.createElement('input')
        input.type = 'number'
        input.min = '1'
        input.step = '1'
        input.value = String(initValue)
        input.id = id
        input.style.cssText = 'width: 70px; padding: 2px 4px;'
        row.appendChild(label)
        row.appendChild(input)
        return { row, input }
      }

      // Interval fields
      const noMatch = field(
        'No match interval (s)',
        settings.noMatchesInterval,
        'oc-no-match'
      )
      const hasMatch = field(
        'Matches found interval (s)',
        settings.matchesFoundInterval,
        'oc-has-match'
      )
      const defInt = field(
        'Default interval (s)',
        settings.defaultInterval,
        'oc-default'
      )
      intervalContent.appendChild(noMatch.row)
      intervalContent.appendChild(hasMatch.row)
      intervalContent.appendChild(defInt.row)

      // Stake fields
      const stakeMatchOdd = field(
        'Stake kèo chấp',
        settings.stakeMatchOdd,
        'oc-stake-matchodd'
      )
      const stakeOverUnder = field(
        'Stake tài xỉu',
        settings.stakeOverUnder,
        'oc-stake-overunder'
      )
      const stake1X2 = field('Stake 1X2', settings.stake1X2, 'oc-stake-1x2')
      stakeContent.appendChild(stakeMatchOdd.row)
      stakeContent.appendChild(stakeOverUnder.row)
      stakeContent.appendChild(stake1X2.row)

      // Delta odds fields
      const deltaOddMatch = field(
        'Delta odds chấp',
        settings.deltaOddMatch,
        'oc-delta-matchodd'
      )
      const deltaOddOverUnder = field(
        'Delta odds tài xỉu',
        settings.deltaOddOverUnder,
        'oc-delta-overunder'
      )
      const deltaOdd1X2 = field(
        'Delta odds 1X2',
        settings.deltaOdd1X2,
        'oc-delta-1x2'
      )
      stakeContent.appendChild(deltaOddMatch.row)
      stakeContent.appendChild(deltaOddOverUnder.row)
      stakeContent.appendChild(deltaOdd1X2.row)

      // Max bets per round
      const maxBetsPerRound = field(
        'Giới hạn kèo/round',
        settings.maxBetsPerRound,
        'oc-max-bets-round'
      )
      stakeContent.appendChild(maxBetsPerRound.row)

      panel.appendChild(intervalContent)
      panel.appendChild(stakeContent)

      // default show stake tab
      intervalContent.style.display = 'none'

      // Tab switching logic
      tabInterval.addEventListener('click', () => {
        tabInterval.style.borderBottom = '2px solid #8B0000'
        tabStake.style.borderBottom = '2px solid transparent'
        intervalContent.style.display = ''
        stakeContent.style.display = 'none'
      })
      tabStake.addEventListener('click', () => {
        tabInterval.style.borderBottom = '2px solid transparent'
        tabStake.style.borderBottom = '2px solid #8B0000'
        intervalContent.style.display = 'none'
        stakeContent.style.display = ''
      })

      // Actions
      const actions = document.createElement('div')
      actions.style.cssText =
        'margin-top: 10px; display: flex; justify-content: flex-end; gap: 8px;'
      const cancel = document.createElement('button')
      cancel.textContent = 'Cancel'
      cancel.style.cssText = 'padding: 4px 8px;'
      const save = document.createElement('button')
      save.textContent = 'Save'
      save.style.cssText = 'padding: 4px 8px;'
      actions.appendChild(cancel)
      actions.appendChild(save)
      panel.appendChild(actions)

      panel._inputs = {
        noMatch,
        hasMatch,
        defInt,
        stakeMatchOdd,
        stakeOverUnder,
        stake1X2,
        deltaOddMatch,
        deltaOddOverUnder,
        deltaOdd1X2,
        maxBetsPerRound,
      }
      panel._buttons = { cancel, save }
      return panel
    }

    function setupSettingsInteractions(settingsBtn, panel, refreshIndicator) {
      const open = () => {
        panel.style.display = 'block'
      }
      const close = () => {
        panel.style.display = 'none'
      }
      settingsBtn.addEventListener('click', () => {
        if (panel.style.display === 'none') open()
        else close()
      })
      panel._buttons.cancel.addEventListener('click', close)
      panel._buttons.save.addEventListener('click', () => {
        const n = Math.max(
          1,
          parseInt(panel._inputs.noMatch.input.value || '0', 10)
        )
        const m = Math.max(
          1,
          parseInt(panel._inputs.hasMatch.input.value || '0', 10)
        )
        const d = Math.max(
          1,
          parseInt(panel._inputs.defInt.input.value || '0', 10)
        )
        const stakeMatchOdd = Math.max(
          1,
          parseInt(panel._inputs.stakeMatchOdd.input.value || '0', 10)
        )
        const stakeOverUnder = Math.max(
          1,
          parseInt(panel._inputs.stakeOverUnder.input.value || '0', 10)
        )
        const stake1X2 = Math.max(
          1,
          parseInt(panel._inputs.stake1X2.input.value || '0', 10)
        )
        const deltaOddMatch = Math.max(
          0,
          parseFloat(panel._inputs.deltaOddMatch.input.value || '0.05')
        )
        const deltaOddOverUnder = Math.max(
          0,
          parseFloat(panel._inputs.deltaOddOverUnder.input.value || '0.05')
        )
        const deltaOdd1X2 = Math.max(
          0,
          parseFloat(panel._inputs.deltaOdd1X2.input.value || '0.05')
        )
        const maxBetsPerRound = Math.max(
          1,
          parseInt(panel._inputs.maxBetsPerRound.input.value || '15', 10)
        )
        settings.noMatchesInterval = n
        settings.matchesFoundInterval = m
        settings.defaultInterval = d
        settings.stakeMatchOdd = stakeMatchOdd
        settings.stakeOverUnder = stakeOverUnder
        settings.stake1X2 = stake1X2
        settings.deltaOddMatch = deltaOddMatch
        settings.deltaOddOverUnder = deltaOddOverUnder
        settings.deltaOdd1X2 = deltaOdd1X2
        settings.maxBetsPerRound = maxBetsPerRound
        saveSettings(settings)
        // Apply immediately based on last match count
        updateRefreshInterval(state.lastMatchCount)
        state.timeLeft = state.currentInterval
        if (refreshIndicator) {
          refreshIndicator.textContent = `Auto-refresh in: ${state.timeLeft}s`
        }
        // Reset hard gate to align with new interval
        state.nextAllowedRefreshAt =
          Date.now() + state.currentInterval * 1000 - 100
        close()
      })
    }

    /**
     * Creates the toggle button
     * @returns {HTMLElement} - Toggle button
     */
    function createToggleButton() {
      const toggleBtn = document.createElement('button')
      toggleBtn.textContent = '−'
      toggleBtn.style.cssText = `
                border: none;
                background: none;
                cursor: pointer;
                font-size: 16px;
                padding: 0 5px;
                flex-shrink: 0;
                margin-left: 8px;
                color: white;
            `
      return toggleBtn
    }

    /**
     * Creates the main content area
     * @returns {Object} - Object containing content elements
     */
    function createMainContent() {
      const contentWrapper = document.createElement('div')
      contentWrapper.style.cssText = `
                flex: 1;
                display: flex;
                flex-direction: column;
                min-height: 0;
                overflow: hidden;
                box-sizing: border-box;
            `

      const mainContent = document.createElement('div')
      mainContent.style.cssText = `
                flex: 1;
                padding: 10px;
                overflow-y: auto;
                min-height: 0;
                box-sizing: border-box;
            `

      // Track user scroll to avoid disruptive layout adjustments
      mainContent.addEventListener('scroll', () => {
        state.isUserScrolling = true
        if (state.scrollIdleTimer) clearTimeout(state.scrollIdleTimer)
        state.scrollIdleTimer = setTimeout(() => {
          state.isUserScrolling = false
        }, 300)
      })

      const table = createTable()
      mainContent.appendChild(table)

      // Controls bar between table and log (checkbox + gripper for resize)
      const controlsBar = document.createElement('div')
      controlsBar.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 4px 10px;
                border-top: 1px solid ${CONSTANTS.COLORS.BORDER};
                border-bottom: 1px solid ${CONSTANTS.COLORS.BORDER};
                background: ${CONSTANTS.COLORS.HEADER_BACKGROUND};
                user-select: none;
                gap: 8px;
                flex-wrap: nowrap;
                min-height: 26px;
            `
      const autoScrollWrap = document.createElement('label')
      autoScrollWrap.style.cssText =
        'display:flex; align-items:center; gap:6px; cursor:pointer; white-space: nowrap;'
      const autoScrollCheckbox = document.createElement('input')
      autoScrollCheckbox.type = 'checkbox'
      autoScrollCheckbox.checked = true
      const autoScrollText = document.createElement('span')
      autoScrollText.textContent = 'Auto-scroll log'
      autoScrollText.style.cssText = 'white-space: nowrap;'
      autoScrollWrap.appendChild(autoScrollCheckbox)
      autoScrollWrap.appendChild(autoScrollText)

      const gripper = document.createElement('div')
      gripper.textContent = '⋮⋮'
      gripper.title = 'Drag to resize log height'
      gripper.style.cssText =
        'cursor: row-resize; padding: 0 6px; color:#666; height: 18px; display:flex; align-items:center;'

      controlsBar.appendChild(autoScrollWrap)
      controlsBar.appendChild(gripper)

      const logArea = document.createElement('textarea')
      logArea.style.cssText = `
                width: calc(100% - 20px);
                height: 120px;
                margin: 10px;
                padding: 5px;
                border: 1px solid ${CONSTANTS.COLORS.BORDER};
                resize: none;
                box-sizing: border-box;
                flex-shrink: 0;
            `
      logArea.readOnly = true

      // Auto-scroll toggle
      autoScrollCheckbox.addEventListener('change', () => {
        state.autoScrollLog = !!autoScrollCheckbox.checked
      })

      // Drag to resize log height
      ;(function setupInnerResize() {
        let resizing = false
        let startY = 0
        let startHeight = 0
        const minLogHeight = 60
        function onDown(e) {
          if (e.target === autoScrollCheckbox || e.target === autoScrollText)
            return
          e.preventDefault()
          resizing = true
          startY = e.clientY
          startHeight = logArea.offsetHeight
          window.addEventListener('mousemove', onMove) // bubble phase
          window.addEventListener('mouseup', onUp)
        }
        function onMove(e) {
          if (!resizing) return
          const delta = startY - e.clientY // kéo lên tăng, kéo xuống giảm
          const wrapperRect = contentWrapper.getBoundingClientRect()
          const maxLogHeight = Math.max(minLogHeight, wrapperRect.height - 120)
          const newHeight = Math.min(
            Math.max(minLogHeight, startHeight + delta),
            maxLogHeight
          )
          logArea.style.height = newHeight + 'px'
        }
        function onUp() {
          if (!resizing) return
          resizing = false
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
        }
        gripper.addEventListener('mousedown', onDown)
        controlsBar.addEventListener('mousedown', (e) => {
          if (e.target === autoScrollCheckbox || e.target === autoScrollText)
            return
          onDown(e)
        })
      })()

      contentWrapper.appendChild(mainContent)
      contentWrapper.appendChild(controlsBar)
      contentWrapper.appendChild(logArea)

      return { contentWrapper, mainContent, table, logArea }
    }

    /**
     * Creates the data table
     * @returns {HTMLElement} - Table element
     */
    function createTable() {
      const table = document.createElement('table')
      table.style.cssText = `
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
                margin-bottom: 10px;
                table-layout: auto;
            `

      const thead = document.createElement('thead')
      thead.innerHTML = `
                <tr>
                    <th style="width: 5%; border: 1px solid ${CONSTANTS.COLORS.BORDER}; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 30px;">#</th>
                    <th colspan="4" style="border: 1px solid ${CONSTANTS.COLORS.BORDER}; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 80px;"></th>
                    <th colspan="4" style="border: 1px solid ${CONSTANTS.COLORS.BORDER}; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 80px;"></th>
                    <th colspan="4" style="border: 1px solid ${CONSTANTS.COLORS.BORDER}; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 80px;"></th>
                    <th style="width: 5%; border: 1px solid ${CONSTANTS.COLORS.BORDER}; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 30px;"></th>
                </tr>
            `
      table.appendChild(thead)

      const tbody = document.createElement('tbody')
      table.appendChild(tbody)

      return table
    }

    /**
     * Creates the resize handle
     * @returns {HTMLElement} - Resize handle
     */
    function createResizeHandle() {
      const resizeHandle = document.createElement('div')
      resizeHandle.style.cssText = `
                position: absolute;
                right: 0;
                bottom: 0;
                width: 10px;
                height: 10px;
                cursor: se-resize;
                background: linear-gradient(135deg, transparent 50%, ${CONSTANTS.COLORS.BORDER} 50%);
                z-index: 1;
            `
      return resizeHandle
    }

    /**
     * Creates and initializes the floating popup
     * @returns {HTMLElement} - The created popup element
     */
    function createFloatingPopup() {
      try {
        console.log('Odds Collector: Creating popup...')

        // Ensure required styles are present
        injectStyles()

        // Create main container
        const popup = document.createElement('div')
        popup.id = 'odds-collector-popup'
        popup.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 20px;
                    width: ${CONSTANTS.POPUP.DEFAULT_WIDTH}px;
                    min-width: ${CONSTANTS.POPUP.MIN_WIDTH}px;
                    max-width: calc(100vw - ${CONSTANTS.POPUP.MARGIN_FROM_EDGE}px);
                    max-height: calc(100vh - ${CONSTANTS.POPUP.MARGIN_FROM_EDGE}px);
                    background: ${CONSTANTS.COLORS.BACKGROUND};
                    border: 1px solid ${CONSTANTS.COLORS.BORDER};
                    border-radius: 4px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    will-change: transform;
                    box-sizing: border-box;
                    overflow: hidden;
                `

        // Create header
        const header = createHeader()
        const titleContainer = createTitleSection()
        const { refreshContainer, refreshIndicator, refreshButton } =
          createRefreshControls()
        const settingsBtn = createSettingsButton()
        const settingsPanel = createSettingsPanel()
        const autoPlayBtn = createAutoPlayButton()
        const toggleBtn = createToggleButton()

        // Left controls container
        const leftControls = document.createElement('div')
        leftControls.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                `
        leftControls.appendChild(toggleBtn)
        leftControls.appendChild(settingsBtn)
        leftControls.appendChild(autoPlayBtn)

        // Right controls container (hiển thị từ trái -> phải: refresh, indicator, title)
        const rightControls = document.createElement('div')
        rightControls.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                    margin-left: auto;
                `
        rightControls.appendChild(refreshContainer)
        rightControls.appendChild(titleContainer)

        // Assemble the popup header: left group on left, right group on right
        header.appendChild(leftControls)
        header.appendChild(rightControls)

        // Create content
        const { contentWrapper, mainContent, table, logArea } =
          createMainContent()
        const tbody = table.querySelector('tbody')
        const resizeHandle = createResizeHandle()

        // Assemble the popup
        popup.appendChild(header)
        popup.appendChild(contentWrapper)
        popup.appendChild(settingsPanel)
        popup.appendChild(resizeHandle)

        // Ensure popup width is enough to show all header controls at creation
        const MIN_HEADER_WIDTH = 520
        try {
          const minWidthPx = Math.max(
            CONSTANTS.POPUP.MIN_WIDTH,
            MIN_HEADER_WIDTH
          )
          popup.style.minWidth = `${minWidthPx}px`
          const defaultWidth = Math.max(
            CONSTANTS.POPUP.DEFAULT_WIDTH,
            MIN_HEADER_WIDTH
          )
          popup.style.width = `${defaultWidth}px`
        } catch (_) {}

        // Store original dimensions
        state.originalWidth = CONSTANTS.POPUP.DEFAULT_WIDTH
        state.originalHeight = popup.offsetHeight

        // Setup event handlers
        setupDragAndDrop(popup, header)
        setupResize(popup, resizeHandle)
        setupToggle(popup, toggleBtn, contentWrapper)
        setupRefreshButton(refreshButton)
        setupRefreshIndicator(refreshIndicator, header, refreshButton)
        setupSettingsInteractions(settingsBtn, settingsPanel, refreshIndicator)
        setupAutoPlayInteractions(autoPlayBtn)

        // Add logging function
        window.logToPopup = function (message) {
          const timestamp = new Date().toLocaleTimeString()
          logArea.value += `[${timestamp}] ${message}\n`
          if (state.autoScrollLog) {
            logArea.scrollTop = logArea.scrollHeight
          }
        }

        // Store references
        window.oddsCollectorTbody = tbody
        window.oddsCollectorRefreshIndicator = refreshIndicator
        window.oddsCollectorRefreshButton = refreshButton
        window.oddsCollectorHeader = header
        window.oddsCollectorMainContent = mainContent

        // Initialize refresh button visibility
        refreshButton.style.display = 'flex'

        return popup
      } catch (error) {
        console.error('Odds Collector: Error in createFloatingPopup:', error)
        throw error
      }
    }

    // ==================== CLEANUP AND INITIALIZATION ====================
    /**
     * Cleans up all event listeners and intervals
     * @param {HTMLElement} popup - Popup element to cleanup
     */
    function cleanup(popup) {
      if (state.refreshIntervalId) {
        clearInterval(state.refreshIntervalId)
        state.refreshIntervalId = null
      }

      if (popup._dragCleanup) {
        popup._dragCleanup()
      }

      if (popup._resizeCleanup) {
        popup._resizeCleanup()
      }

      if (window._oddsCollectorDomObserver) {
        try {
          window._oddsCollectorDomObserver.disconnect()
        } catch (_) {}
        window._oddsCollectorDomObserver = null
      }
      if (window._oddsCollectorDomDebounce) {
        clearTimeout(window._oddsCollectorDomDebounce)
        window._oddsCollectorDomDebounce = null
      }
    }

    // Initialize popup when page loads
    window.addEventListener('load', () => {
      try {
        console.log('Odds Collector: Page loaded, initializing...')

        // Always enable child message handler
        setupChildMessageHandler()

        // Only create UI in top window
        if (window.top !== window.self) {
          return
        }

        // Inject helper script for iframe access
        injectHelperScript()

        const popup = createFloatingPopup()
        document.body.appendChild(popup)
        window.logToPopup('Odds Collector initialized')

        // Setup DOM observer for dynamic content
        setupDOMObserver()

        // Initial data extraction
        refreshData()

        // Start initial interval
        startRefreshInterval()

        // Clean up interval when popup is closed
        window.addEventListener('unload', () => {
          cleanup(popup)
        })

        // Clean up when popup is removed from DOM
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.removedNodes.forEach((node) => {
              if (node === popup) {
                cleanup(popup)
                observer.disconnect()
              }
            })
          })
        })

        observer.observe(document.body, { childList: true })
      } catch (error) {
        console.error('Odds Collector: Error in initialization:', error)
      }
    })

    /**
     * Inject helper script to support iframe access
     */
    function injectHelperScript() {
      try {
        console.log('Odds Collector: Injecting helper script...')

        // Create script element
        const script = document.createElement('script')
        script.id = 'odds-collector-helper'
        script.textContent = `
                    // Helper script for Odds Collector
                    (function() {
                        'use strict';
                        
                        // Listen for postMessage requests
                        window.addEventListener('message', function(event) {
                            if (event.data && event.data.type === 'ODDS_COLLECTOR_REQUEST') {
                                try {
                                    // Send document content back
                                    event.source.postMessage({
                                        type: 'ODDS_COLLECTOR_RESPONSE',
                                        document: document.documentElement.outerHTML
                                    }, '*');
                                } catch (e) {
                                    console.log('Odds Collector Helper: Error sending response:', e.message);
                                }
                            }
                            
                            if (event.data && event.data.type === 'ODDS_COLLECTOR_EXTRACT') {
                                try {
                                    // Extract content and send via localStorage
                                    const html = document.documentElement.outerHTML;
                                    localStorage.setItem(event.data.requestId, JSON.stringify({
                                        type: 'ODDS_COLLECTOR_TAB_RESPONSE',
                                        html: html
                                    }));
                                } catch (e) {
                                    console.log('Odds Collector Helper: Error extracting content:', e.message);
                                }
                            }
                        });
                        
                        // Listen for URL parameter to auto-extract
                        if (window.location.search.includes('odds_collector=1')) {
                            setTimeout(() => {
                                try {
                                    const html = document.documentElement.outerHTML;
                                    const requestId = 'odds_collector_' + Date.now();
                                    localStorage.setItem(requestId, JSON.stringify({
                                        type: 'ODDS_COLLECTOR_TAB_RESPONSE',
                                        html: html
                                    }));
                                } catch (e) {
                                    console.log('Odds Collector Helper: Error in auto-extract:', e.message);
                                }
                            }, 1000);
                        }
                        
                        console.log('Odds Collector Helper: Script loaded successfully');
                    })();
                `

        // Inject into head
        document.head.appendChild(script)
        console.log('Odds Collector: Helper script injected successfully')
      } catch (e) {
        console.error('Odds Collector: Error injecting helper script:', e)
      }
    }

    /**
     * Inject component styles (animations)
     */
    function injectStyles() {
      try {
        if (document.getElementById('odds-collector-styles')) return
        const style = document.createElement('style')
        style.id = 'odds-collector-styles'
        style.textContent = `
#odds-collector-popup .spinning { animation: oc-spin 1s linear; }
@keyframes oc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
#odds-collector-popup .flashing { animation: oc-flash 1s infinite alternate; }
@keyframes oc-flash { from { filter: brightness(1); } to { filter: brightness(1.4); } }
/* Header update flash */
#odds-collector-popup .header-updated { 
  background: linear-gradient(90deg, #00c853, #b9f6ca, #00c853) !important; 
  background-size: 200% 100% !important;
  animation: oc-header-sheen 0.8s linear;
}
@keyframes oc-header-sheen { from { background-position: 100% 0; } to { background-position: 0 0; } }
                `
        document.head.appendChild(style)
      } catch (e) {
        console.error('Odds Collector: Error injecting styles:', e)
      }
    }

    /**
     * Setup child-frame handler to perform extraction on request
     */
    function setupChildMessageHandler() {
      try {
        if (window._oddsCollectorChildHandlerAttached) return
        window._oddsCollectorChildHandlerAttached = true

        // Định nghĩa logToPopup mặc định nếu chưa có (tránh lỗi trong iframe)
        if (typeof window.logToPopup !== 'function') {
          window.logToPopup = function () {
            // fallback: log ra console
            if (arguments.length > 0) {
              try {
                console.log('[OddsCollector]', ...arguments)
              } catch (_) {}
            }
          }
        }

        const lastResponseAtByRequest = new Map()

        // Ensure a11y focus guard active in this frame
        // setupAriaHiddenFocusGuard();

        const dbg = (msg, extra) => {
          try {
            console.log('OC DEBUG:', msg, extra || '')
          } catch (_) {}
        }

        async function fillStakeInputForOcId(
          ocId,
          amount,
          storedOdd,
          currentOdd,
          delta,
          attempts = 20,
          delayMs = 300
        ) {
          const XPATHS = [
            "//div[contains(@class, 'quick-bet')]//div[contains(@class, 'betslip')]//div[contains(@class, 'betting-scroller')]//div[contains(@class, 'betting-stake')]//div[contains(@data-focus,'true')]/input",
            "//span/div[contains(@class, 'quick-bet')]/div[contains(@class, 'quick-bet')]/div[contains(@class, 'betslip')]/div/div[contains(@class, 'betting-scroller')]/div/div/div[contains(@class, 'betting-stake')]/div[contains(@class, 'betting-stake')]/div[contains(@data-focus,'true')]/input",
          ]

          function isInputVisible(input) {
            if (!input) return false
            const style = window.getComputedStyle(input)
            return (
              input.offsetParent !== null &&
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              !input.disabled &&
              !input.readOnly
            )
          }

          function isInputLocked(input) {
            return input.disabled || input.readOnly
          }

          function setNativeValue(input, value) {
            try {
              const proto = Object.getPrototypeOf(input)
              const desc = Object.getOwnPropertyDescriptor(proto, 'value')
              if (desc && typeof desc.set === 'function') {
                desc.set.call(input, String(value))
              } else {
                input.value = String(value)
              }
            } catch (_) {
              input.value = String(value)
            }
          }

          function findStakeInputByFullXPath() {
            for (const xp of XPATHS) {
              try {
                const node = document.evaluate(
                  xp,
                  document,
                  null,
                  XPathResult.FIRST_ORDERED_NODE_TYPE,
                  null
                ).singleNodeValue
                if (node && isInputVisible(node)) {
                  console.log('Found stake input:', node)
                  return node
                }
              } catch (e) {
                console.log('XPath error:', e)
              }
            }
            console.log('No stake input found')
            return null
          }

          async function tryFill(input, value) {
            setNativeValue(input, value)
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
            input.dispatchEvent(
              new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' })
            )
            if (input.value !== String(value)) {
              await new Promise((r) => setTimeout(r, 120))
              input.value = String(value)
              input.dispatchEvent(new Event('input', { bubbles: true }))
              input.dispatchEvent(new Event('change', { bubbles: true }))
            }
            return input.value === String(value)
          }

          // Debug log
          try {
            if (window.logToPopup) {
              window.logToPopup(
                `Fill stake debug: ocId=${ocId}, amount=${amount}, storedOdd=${storedOdd}, currentOdd=${currentOdd}, delta=${delta}`
              )
            }
          } catch (_) {}

          // Kiểm tra odds trong khoảng delta
          if (!isOddInDeltaRange(storedOdd, currentOdd, delta)) {
            try {
              if (window.logToPopup) {
                window.logToPopup(
                  `Skip fill: odds changed (stored: ${storedOdd}, current: ${currentOdd}, delta: ${delta})`
                )
              }
            } catch (_) {}
            return false
          }

          // Kiểm tra đã bet kèo này chưa
          const oddKey = `${ocId}_${storedOdd}`
          if (state.bettedOdds.has(oddKey)) {
            try {
              if (window.logToPopup) {
                window.logToPopup(`Skip fill: already bet this odd (${oddKey})`)
              }
            } catch (_) {}
            return false
          }

          for (let i = 0; i < attempts; i++) {
            let input = findStakeInputByFullXPath()
            if (!input) {
              const speedyDelay = i < 6 ? 80 : i < 12 ? 160 : delayMs
              await new Promise((r) => setTimeout(r, speedyDelay))
              continue
            }

            // Scroll input vào giữa màn hình
            try {
              input.scrollIntoView({ behavior: 'instant', block: 'center' })
            } catch (_) {}
            await new Promise((r) => setTimeout(r, 50))

            // Kiểm tra visible
            if (!isInputVisible(input)) {
              await new Promise((r) => setTimeout(r, 100))
              continue
            }

            // Nếu input bị lock, thử lại sau 0.2s
            if (isInputLocked(input)) {
              await new Promise((r) => setTimeout(r, 200))
              continue
            }

            // Focus trước khi fill để framework bắt sự kiện đúng
            try {
              input.focus()
            } catch (_) {}

            // Fill value
            const filled = await tryFill(input, amount)
            if (filled) {
              // Đánh dấu đã bet kèo này
              const oddKey = `${ocId}_${storedOdd}`
              state.bettedOdds.add(oddKey)
              try {
                if (window.logToPopup) {
                  window.logToPopup(`Fill stake success: ${oddKey}`)
                }
              } catch (_) {}
              return true
            }

            // Nếu chưa fill được, thử lại nhanh
            await new Promise((r) => setTimeout(r, 120))
          }
          try {
            if (window.logToPopup) {
              window.logToPopup(`Fill stake failed after ${attempts} attempts`)
            }
          } catch (_) {}
          return false
        }

        window.addEventListener('message', async (event) => {
          try {
            if (!event.data) return
            if (event.data.type === 'ODDS_COLLECTOR_EXTRACT_DATA') {
              const ttl =
                typeof event.data.ttl === 'number' ? event.data.ttl : 1
              const requestId =
                typeof event.data.requestId === 'string'
                  ? event.data.requestId
                  : ''
              const now = Date.now()
              const lastAt = lastResponseAtByRequest.get(requestId) || 0
              if (now - lastAt < 600) return // throttle per requestId
              lastResponseAtByRequest.set(requestId, now)

              const selfData = extractDataFromDocument(document)
              const childrenData = await collectFromDescendants(
                1500,
                ttl,
                requestId
              )
              const payload = [...selfData, ...childrenData]
              event.source &&
                event.source.postMessage(
                  { type: 'ODDS_COLLECTOR_DATA', requestId, payload },
                  '*'
                )
              return
            }
            if (event.data.type === 'ODDS_COLLECTOR_CLICK') {
              const targetId = event.data.targetId
              const fallbackId = event.data.fallbackId
              const ttl =
                typeof event.data.ttl === 'number' ? event.data.ttl : 0
              const amountFromMsg = Number(event.data.amount)
              const amount = amountFromMsg > 0 ? amountFromMsg : 150
              const storedOdd = event.data.storedOdd
              const currentOdd = event.data.currentOdd
              const delta = event.data.delta
              dbg('click: received', {
                targetId,
                fallbackId,
                ttl,
                amount,
                storedOdd,
                currentOdd,
                delta,
              })
              window.logToPopup(
                `Click handler received: targetId=${targetId}, amount=${amount}, storedOdd=${storedOdd}, currentOdd=${currentOdd}, delta=${delta}`
              )
              const tryClick = (id) => {
                if (!id) return false
                const el = document.querySelector(`[data-oc-id="${id}"]`)
                dbg('click: found target element?', { id, exists: !!el })
                if (el) {
                  try {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  } catch (_) {}
                  const clickable = el.closest
                    ? el.closest('.odds-button') || el
                    : el
                  dbg('click: clickable resolved?', {
                    hasClickable: !!clickable,
                    cls: clickable && clickable.className,
                  })
                  try {
                    clickable.click()
                  } catch (e) {
                    dbg('click: clickable.click threw', { message: e.message })
                    return false
                  }
                  // If focused element is in aria-hidden subtree, blur to satisfy a11y
                  try {
                    if (
                      document.activeElement &&
                      isHiddenByAria(document.activeElement)
                    ) {
                      document.activeElement.blur()
                    }
                  } catch (_) {}
                  // Enforce blurring focus while panel transitions
                  //   startAriaFocusEnforcer(2000, 50)
                  return true
                }
                return false
              }
              let usedId = null
              let clicked = false
              if (tryClick(targetId)) {
                clicked = true
                usedId = targetId
              } else if (tryClick(fallbackId)) {
                clicked = true
                usedId = fallbackId
              }
              dbg('click: result', { clicked, usedId })
              if (!clicked && ttl > 0) {
                const iframes = Array.from(document.querySelectorAll('iframe'))
                dbg('click: forwarding to children', {
                  children: iframes.length,
                  ttl: ttl - 1,
                })
                iframes.forEach((f) => {
                  try {
                    f.contentWindow &&
                      f.contentWindow.postMessage(
                        {
                          type: 'ODDS_COLLECTOR_CLICK',
                          targetId,
                          fallbackId,
                          ttl: ttl - 1,
                          amount,
                          storedOdd,
                          currentOdd,
                          delta,
                        },
                        '*'
                      )
                  } catch (_) {}
                })
              } else if (clicked && usedId) {
                // After a successful click, wait and fill stake input
                dbg('fillStake: start', {
                  usedId,
                  amount,
                  storedOdd,
                  currentOdd,
                  delta,
                })
                window.logToPopup(
                  `Starting fill stake: usedId=${usedId}, amount=${amount}, storedOdd=${storedOdd}, currentOdd=${currentOdd}, delta=${delta}`
                )
                console.log('Starting fill stake:', {
                  usedId,
                  amount,
                  storedOdd,
                  currentOdd,
                  delta,
                })
                fillStakeInputForOcId(
                  usedId,
                  amount,
                  storedOdd,
                  currentOdd,
                  delta
                ).then((ok) => {
                  try {
                    const msg = ok
                      ? `Filled stake=${amount} for ${usedId}`
                      : `Failed to fill stake for ${usedId}`
                    window.logToPopup
                      ? window.logToPopup(msg)
                      : console.log('OC DEBUG:', msg)
                  } catch (_) {}
                  // Notify parent/top window for sequencing
                  try {
                    if (window.parent) {
                      window.parent.postMessage(
                        { type: 'ODDS_COLLECTOR_STAKE_FILLED', usedId, ok },
                        '*'
                      )
                    } else {
                      window.postMessage(
                        { type: 'ODDS_COLLECTOR_STAKE_FILLED', usedId, ok },
                        '*'
                      )
                    }
                  } catch (_) {}
                })
              }
              return
            }
          } catch (e) {
            try {
              console.log('OC DEBUG: handler exception', e)
            } catch (_) {}
          }
        })
      } catch (e) {
        console.error(
          'Odds Collector: Error setting up child message handler:',
          e
        )
      }
    }

    function setupAriaHiddenFocusGuard() {
      try {
        if (window._ocAriaGuardAttached) return
        window._ocAriaGuardAttached = true
        const observer = new MutationObserver((mutations) => {
          try {
            const active = document.activeElement
            if (!active) return
            for (const m of mutations) {
              if (
                m.type === 'attributes' &&
                m.attributeName === 'aria-hidden'
              ) {
                const target = m.target
                if (
                  target &&
                  target.getAttribute &&
                  target.getAttribute('aria-hidden') === 'true'
                ) {
                  // Add inert to prevent focus in hidden region
                  try {
                    target.setAttribute('inert', '')
                  } catch (_) {}
                  const active = document.activeElement
                  if (active && target.contains(active)) {
                    try {
                      active.blur()
                    } catch (_) {}
                  }
                } else if (target && target.getAttribute) {
                  // Remove inert when aria-hidden is removed or not true
                  try {
                    target.removeAttribute('inert')
                  } catch (_) {}
                }
              }
            }
          } catch (_) {}
        })
        observer.observe(document.body, {
          subtree: true,
          attributes: true,
          attributeFilter: ['aria-hidden'],
        })
        window._ocAriaGuardObserver = observer

        // Block focusing into aria-hidden regions
        const focusBlocker = (e) => {
          try {
            const t = e.target
            if (isHiddenByAria(t)) {
              e.preventDefault()
              e.stopPropagation()
              try {
                t.blur && t.blur()
              } catch (_) {}
            }
          } catch (_) {}
        }
        document.addEventListener('focus', focusBlocker, true)
        document.addEventListener('mousedown', focusBlocker, true)
        document.addEventListener('touchstart', focusBlocker, true)
        window._ocAriaGuardFocusBlocker = focusBlocker
      } catch (_) {}
    }

    function startAriaFocusEnforcer(durationMs = 2000, stepMs = 50) {
      try {
        const start = Date.now()
        const tick = () => {
          try {
            const ae = document.activeElement
            if (ae && isHiddenByAria(ae)) {
              try {
                ae.blur()
              } catch (_) {}
            }
          } catch (_) {}
          if (Date.now() - start < durationMs) {
            setTimeout(tick, stepMs)
          }
        }
        setTimeout(tick, stepMs)
      } catch (_) {}
    }

    function createAutoPlayButton() {
      const btn = document.createElement('button')
      btn.textContent = '▶'
      btn.title = 'Start auto-bet'
      btn.style.cssText = `
                border: none;
                background: none;
                cursor: pointer;
                font-size: 16px;
                padding: 0 6px;
                flex-shrink: 0;
                margin-left: 4px;
                color: white;
            `
      return btn
    }

    function setupAutoPlayInteractions(autoBtn) {
      const updateBtnUi = () => {
        if (state.autoPlay) {
          autoBtn.textContent = '⏸'
          autoBtn.title = 'Pause auto-bet'
        } else {
          autoBtn.textContent = '▶'
          autoBtn.title = 'Start auto-bet'
        }
      }
      updateBtnUi()
      autoBtn.addEventListener('click', () => {
        const oldState = state.autoPlay
        state.autoPlay = !state.autoPlay
        updateBtnUi()
        window.logToPopup(
          `Auto-bet button clicked: ${oldState ? 'PAUSE' : 'PLAY'} -> ${
            state.autoPlay ? 'PLAY' : 'PAUSE'
          }`
        )
        console.log('Auto-bet state changed:', {
          oldState,
          newState: state.autoPlay,
        })
      })
    }

    async function withRefreshSuspended(fn) {
      const prevPaused = state.isPaused
      try {
        state.isPaused = true
        if (window.oddsCollectorRefreshIndicator) {
          window.oddsCollectorRefreshIndicator.textContent =
            'Auto-refresh is paused'
        }
        state.isAutoBetting = true
        await fn()
      } finally {
        state.isAutoBetting = false
        state.isPaused = prevPaused
        if (!state.isPaused) {
          state.timeLeft = state.currentInterval
          if (window.oddsCollectorRefreshIndicator) {
            window.oddsCollectorRefreshIndicator.textContent = `Auto-refresh in: ${state.timeLeft}s`
          }
        }
      }
    }

    async function runAutoBetOnData(extractedData) {
      try {
        window.logToPopup(
          `runAutoBetOnData called: autoPlay=${state.autoPlay}, dataLength=${extractedData.length}`
        )
        if (!state.autoPlay) return

        // Reset bet count cho round mới (giữ nguyên danh sách kèo đã bet theo session)
        state.currentRoundBetCount = 0
        const maxBets = settings.maxBetsPerRound || 15

        for (const entity of extractedData) {
          if (!state.autoPlay) return
          for (let bIndex = 0; bIndex < entity.blocks.length; bIndex++) {
            if (!state.autoPlay) return
            const block = entity.blocks[bIndex]
            for (let i = 0; i < block.details.length; i++) {
              if (!state.autoPlay) return

              // Kiểm tra giới hạn số kèo
              if (state.currentRoundBetCount >= maxBets) {
                window.logToPopup(
                  `AutoBet: reached max bets limit (${maxBets})`
                )
                return
              }

              const meta = block.meta && block.meta[i]
              if (!meta) continue
              const evText =
                block.details[i] &&
                block.details[i][0] &&
                block.details[i][0][0]
              if (evText == null || evText === '-') continue
              const evVal = normalizeNumber(evText)
              if (!isFinite(evVal)) continue

              // Lấy odds hiện tại từ data
              let storedOdd = null
              let currentOdd = null
              if (meta.kind === 'match') {
                storedOdd = evVal > 0 ? meta.aOdd : meta.bOdd
                currentOdd = storedOdd // Tạm thời dùng storedOdd làm currentOdd
              } else if (meta.kind === 'overunder') {
                storedOdd = evVal > 0 ? meta.aOdd : meta.bOdd
                currentOdd = storedOdd
              } else if (meta.kind === '1x2') {
                if (evVal === 0) {
                  storedOdd = meta.dOdd
                  currentOdd = storedOdd
                } else {
                  storedOdd = evVal > 0 ? meta.aOdd : meta.bOdd
                  currentOdd = storedOdd
                }
              }

              // Debug log meta data
              window.logToPopup(
                `AutoBet debug: kind=${
                  meta.kind
                }, evVal=${evVal}, storedOdd=${storedOdd}, meta=${JSON.stringify(
                  meta
                )}`
              )
              console.log('Meta data for auto bet:', meta)

              if (!storedOdd) {
                window.logToPopup(
                  `AutoBet skip: no storedOdd for kind=${meta.kind}`
                )
                continue
              }

              let targetId = null
              let fallbackId = null
              if (meta.kind === '1x2' && evVal === 0 && meta.dId) {
                targetId = meta.dId
                fallbackId = meta.aId || meta.bId || null
              } else {
                const preferA = evVal > 0
                targetId = preferA ? meta.aId : meta.bId
                fallbackId = preferA ? meta.bId : meta.aId
              }
              if (!targetId) continue
              if (!state.autoPlay) return
              const amount = getStakeForKind(meta.kind)
              const delta = getDeltaOddForKind(meta.kind)

              try {
                if (!state.autoPlay) return
                const clickMessage = {
                  type: 'ODDS_COLLECTOR_CLICK',
                  targetId,
                  fallbackId,
                  ttl: 3,
                  amount,
                  storedOdd,
                  currentOdd,
                  delta,
                }
                window.logToPopup(
                  `AutoBet sending click message: ${JSON.stringify(
                    clickMessage
                  )}`
                )
                window.postMessage(clickMessage, '*')
                window.logToPopup(
                  `AutoBet: ${meta.kind} -> click ${
                    meta.kind === '1x2' && evVal === 0
                      ? 'Draw'
                      : evVal > 0
                      ? 'A'
                      : 'B'
                  } id=${targetId} amount=${amount} odd=${storedOdd} delta=${delta} (EV=${evText})`
                )
              } catch (e) {
                window.logToPopup(`AutoBet click error: ${e.message}`)
              }
              // Wait for stake fill ack or timeout to avoid racing next bets
              const ok = await waitForStakeFill(targetId, 3000)
              if (ok) {
                state.currentRoundBetCount++
              }
              if (!state.autoPlay) return
              // small gap before next item
              await new Promise((r) => setTimeout(r, 100))
            }
          }
        }
      } catch (e) {
        console.error('Odds Collector: Error in runAutoBetOnData:', e)
      }
    }

    function waitForStakeFill(usedId, timeoutMs = 6000) {
      return new Promise((resolve) => {
        let resolved = false
        function handler(e) {
          try {
            const d = e && e.data
            if (!d || d.type !== 'ODDS_COLLECTOR_STAKE_FILLED') return
            if (d.usedId !== usedId) return
            if (!resolved) {
              resolved = true
              window.removeEventListener('message', handler)
              resolve(!!d.ok)
            }
          } catch (_) {}
        }
        window.addEventListener('message', handler)
        setTimeout(() => {
          if (!resolved) {
            resolved = true
            window.removeEventListener('message', handler)
            resolve(false)
          }
        }, timeoutMs)
      })
    }

    console.log('Odds Collector: Script loaded successfully')
    console.log('Initial state:', { autoPlay: state.autoPlay, settings })
  } catch (error) {
    console.error('Odds Collector: Fatal error in script:', error)
  }
})()
