// ==UserScript==
// @name         OnShape Touch
// @namespace    redhatter
// @version      2024-07-10
// @description  Enable touch support for OnShape
// @author       Ava Johnson
// @match        https://cad.onshape.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

;(function () {
  'use strict'

  /**
   * How quickly to zoom using the pinch gensture. A higher number is faster.
   */
  const ZOOM_SENSITIVITY = 10000

  /**
   * Number of milliseconds to wait before opening the context menu.
   */
  const CONTEXT_MENU_TIMEOUT = 1000

  // After the DOM is loaded insert web app manifest
  document.addEventListener('DOMContentLoaded', () => {
    const link = document.createElement('link')
    link.setAttribute('rel', 'manifest')
    link.setAttribute('href', 'https://raw.githubusercontent.com/RedHatter/onshape-touch/main/dist/manifest.json')
    document.head.append(link)
  })

  let canvas: HTMLElement | null

  /**
   * Generate a mouse event based on a touch event and dispatches it on "canvas". Note that this doesn't attempt a
   * perfect translation as that's not for OnShape's event listeners.
   *
   * @param touchEvent The originating touch event
   * @param type The type of the generated event
   * @param eventInit Additinal fields to pass to the event constructor
   */
  const dispatchEvent = (
    touchEvent: TouchEvent,
    type: 'mousewheel' | 'mousedown' | 'mouseup' | 'mousemove',
    eventInit: MouseEventInit | WheelEventInit = {},
  ) => {
    if (!canvas) {
      canvas = document.getElementById('canvas')
    }

    const init =
      touchEvent.touches[0] && touchEvent.touches[1] ?
        {
          // If there are at least two touch points take the average
          screenX: (touchEvent.touches[0].screenX + touchEvent.touches[1].screenX) / 2,
          screenY: (touchEvent.touches[0].screenY + touchEvent.touches[1].screenY) / 2,
          clientX: (touchEvent.touches[0].clientX + touchEvent.touches[1].clientX) / 2,
          clientY: (touchEvent.touches[0].clientY + touchEvent.touches[1].clientY) / 2,
          pageX: (touchEvent.touches[0].pageX + touchEvent.touches[1].pageX) / 2,
          pageY: (touchEvent.touches[0].pageY + touchEvent.touches[1].pageY) / 2,
          ...eventInit,
          bubbles: true,
        }
      : {
          screenX: touchEvent.touches[0]?.screenX ?? 0,
          screenY: touchEvent.touches[0]?.screenY ?? 0,
          clientX: touchEvent.touches[0]?.clientX ?? 0,
          clientY: touchEvent.touches[0]?.clientY ?? 0,
          pageX: touchEvent.touches[0]?.pageX ?? 0,
          pageY: touchEvent.touches[0]?.pageY ?? 0,
          ...eventInit,
          bubbles: true,
        }

    canvas?.dispatchEvent(type === 'mousewheel' ? new WheelEvent(type, init) : new MouseEvent(type, init))
  }

  const enum Mode {
    None,
    PreRotate,
    PreZoomPan,
    Rotate,
    ZoomPan,
  }

  let mode: Mode = Mode.None
  let prevDistance: number | null = null
  let contextMenuTimer: number | null = null

  /**
   * @param touchEvent The touch event to check
   * @returns false if the event should be skipped true otherwise.
   */
  const checkEvent = (touchEvent: TouchEvent) => {
    if (touchEvent.target && 'id' in touchEvent.target && touchEvent.target.id !== 'canvas') return false

    touchEvent.preventDefault()

    if (contextMenuTimer) {
      clearTimeout(contextMenuTimer)
      contextMenuTimer = null
    }

    return true
  }

  // When a touch gensture begins we don't know what the user action is yet. We just set the mode and wait for the next
  // event (or the menu timer) to determine what mouse events need to be dispatched.
  document.addEventListener(
    'touchstart',
    (e) => {
      if (!checkEvent(e)) return

      mode = e.touches.length >= 2 ? Mode.PreZoomPan : Mode.PreRotate

      contextMenuTimer = setTimeout(() => {
        mode = Mode.None
        contextMenuTimer = null

        const common = { button: 2, buttons: 2 }
        dispatchEvent(e, 'mousedown', common)
        dispatchEvent(e, 'mouseup', common)
      }, CONTEXT_MENU_TIMEOUT)
    },
    { passive: false },
  )

  document.addEventListener(
    'touchmove',
    (e) => {
      if (!checkEvent(e)) return

      switch (mode) {
        case Mode.PreZoomPan:
          mode = Mode.ZoomPan
          dispatchEvent(e, 'mousedown', { button: 1, buttons: 4 })

          break

        case Mode.ZoomPan: {
          dispatchEvent(e, 'mousemove', { button: 2 })

          const distance = Math.hypot(
            e.touches[0].screenX - e.touches[1].screenX,
            e.touches[0].screenY - e.touches[1].screenY,
          )

          if (prevDistance) {
            dispatchEvent(e, 'mousewheel', {
              // Scale delta based on screen size so the value is indpendant of resolution or window size
              deltaY: ((distance - prevDistance) / window.screen.width) * ZOOM_SENSITIVITY,
            })
          }

          prevDistance = distance

          break
        }

        case Mode.PreRotate:
          mode = Mode.Rotate
          dispatchEvent(e, 'mousedown', { button: 2, buttons: 2 })

          break

        case Mode.Rotate:
          dispatchEvent(e, 'mousemove', { button: 2, buttons: 2 })

          break
      }
    },
    { passive: false },
  )

  document.addEventListener(
    'touchend',
    (e) => {
      if (!checkEvent(e)) return

      switch (mode) {
        case Mode.ZoomPan:
          mode = Mode.None
          prevDistance = null

          dispatchEvent(e, 'mouseup', { button: 1, buttons: 4 })

          break

        case Mode.Rotate:
          mode = Mode.None

          dispatchEvent(e, 'mouseup', { button: 2, buttons: 2 })

          break

        // If we are still in the pre-rotate mode then the user did a qick tap. Dispatch a normal mouse click.
        case Mode.PreRotate:
          mode = Mode.None

          dispatchEvent(e, 'mousemove')
          dispatchEvent(e, 'mousedown')
          dispatchEvent(e, 'mouseup')

          break
      }
    },
    { passive: false },
  )

  // OnShape uses a library that listens to touch events and blocks related mouse events. We bypass this by patching
  // `addEventListener` to ignore touch events.

  const originalAddEventListener = EventTarget.prototype.addEventListener

  EventTarget.prototype.addEventListener = function (type, ...args) {
    if (!type.startsWith('touch')) {
      return originalAddEventListener.call(this, type, ...args)
    }
  }
})()
