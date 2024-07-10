// ==UserScript==
// @name         OnShape Touch
// @namespace    http://tampermonkey.net/
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
  let canvas
  /**
   * Generate a mouse event based on a touch event and dispatches it on "canvas". Note that this doesn't attempt a
   * perfect translation as that's not for OnShape's event listeners.
   *
   * @param touchEvent The originating touch event
   * @param type The type of the generated event
   * @param eventInit Additinal fields to pass to the event constructor
   */
  const dispatchEvent = (touchEvent, type, eventInit = {}) => {
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
  let mode = 0 /* Mode.None */
  let prevDistance = null
  let contextMenuTimer = null
  /**
   * @param touchEvent The touch event to check
   * @returns false if the event should be skipped true otherwise.
   */
  const checkEvent = (touchEvent) => {
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
      mode = e.touches.length >= 2 ? 2 /* Mode.PreZoomPan */ : 1 /* Mode.PreRotate */
      contextMenuTimer = setTimeout(() => {
        mode = 0 /* Mode.None */
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
        case 2 /* Mode.PreZoomPan */:
          mode = 4 /* Mode.ZoomPan */
          dispatchEvent(e, 'mousedown', { button: 1, buttons: 4 })
          break
        case 4 /* Mode.ZoomPan */:
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
        case 1 /* Mode.PreRotate */:
          mode = 3 /* Mode.Rotate */
          dispatchEvent(e, 'mousedown', { button: 2, buttons: 2 })
          break
        case 3 /* Mode.Rotate */:
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
        case 4 /* Mode.ZoomPan */:
          mode = 0 /* Mode.None */
          prevDistance = null
          dispatchEvent(e, 'mouseup', { button: 1, buttons: 4 })
          break
        case 3 /* Mode.Rotate */:
          mode = 0 /* Mode.None */
          dispatchEvent(e, 'mouseup', { button: 2, buttons: 2 })
          break
        // If we are still in the pre-rotate mode then the user did a qick tap. Dispatch a normal mouse click.
        case 1 /* Mode.PreRotate */:
          mode = 0 /* Mode.None */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib25zaGFwZS10b3VjaC51c2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsib25zaGFwZS10b3VjaC51c2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGlCQUFpQjtBQUNqQiw4QkFBOEI7QUFDOUIseUNBQXlDO0FBQ3pDLDJCQUEyQjtBQUMzQixpREFBaUQ7QUFDakQsNEJBQTRCO0FBQzVCLDBDQUEwQztBQUMxQyxxQkFBcUI7QUFDckIsK0JBQStCO0FBQy9CLGtCQUFrQjtBQUVsQixDQUFDO0FBQUEsQ0FBQztJQUNBLFlBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUE7SUFFOUI7O09BRUc7SUFDSCxNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQTtJQUVqQyxJQUFJLE1BQTBCLENBQUE7SUFFOUI7Ozs7Ozs7T0FPRztJQUNILE1BQU0sYUFBYSxHQUFHLENBQ3BCLFVBQXNCLEVBQ3RCLElBQTBELEVBQzFELFlBQTZDLEVBQUUsRUFDL0MsRUFBRTtRQUNGLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNaLE1BQU0sR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFBO1FBQzVDLENBQUM7UUFFRCxNQUFNLElBQUksR0FDUixVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM5QztnQkFDRSwwREFBMEQ7Z0JBQzFELE9BQU8sRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQztnQkFDNUUsT0FBTyxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEdBQUcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFD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
