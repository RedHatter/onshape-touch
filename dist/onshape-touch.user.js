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
    link.setAttribute('href', 'https://raw.githubusercontent.com/RedHatter/onshape-touch/main/manifest.json')
    document.head.append(link)
  })
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
        case 4 /* Mode.ZoomPan */: {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib25zaGFwZS10b3VjaC51c2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL29uc2hhcGUtdG91Y2gudXNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxpQkFBaUI7QUFDakIsOEJBQThCO0FBQzlCLDBCQUEwQjtBQUMxQiwyQkFBMkI7QUFDM0IsaURBQWlEO0FBQ2pELDRCQUE0QjtBQUM1QiwwQ0FBMEM7QUFDMUMscUJBQXFCO0FBQ3JCLCtCQUErQjtBQUMvQixrQkFBa0I7QUFFbEIsQ0FBQztBQUFBLENBQUM7SUFDQSxZQUFZLENBQUE7SUFFWjs7T0FFRztJQUNILE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO0lBRTlCOztPQUVHO0lBQ0gsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLENBQUE7SUFFakMsa0RBQWtEO0lBQ2xELFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxrQkFBa0IsRUFBRSxHQUFHLEVBQUU7UUFDakQsTUFBTSxJQUFJLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUMzQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQTtRQUNwQyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSw4RUFBOEUsQ0FBQyxDQUFBO1FBQ3pHLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFBO0lBQzVCLENBQUMsQ0FBQyxDQUFBO0lBRUYsSUFBSSxNQUEwQixDQUFBO0lBRTlCOzs7Ozs7O09BT0c7SUFDSCxNQUFNLGFBQWEsR0FBRyxDQUNwQixVQUFzQixFQUN0QixJQUEwRCxFQUMxRCxZQUE2QyxFQUFFLEVBQy9DLEVBQUU7UUFDRixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDWixNQUFNLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQTtRQUM1QyxDQUFDO1FBRUQsTUFBTSxJQUFJLEdBQ1IsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDOUM7Z0JBQ0UsMERBQTBEO2dCQUMxRCxPQUFPLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sR0FBRyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUM7Z0JBQzVFLE9BQU8sRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQztnQkFDNUUsT0FBTyxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEdBQUcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDO2dCQUM1RSxPQUFPLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sR0FBRyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUM7Z0JBQzVFLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQztnQkFDdEUsS0FBSyxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDO2dCQUN0RSxHQUFHLFNBQVM7Z0JBQ1osT0FBTyxFQUFFLElBQUk7YUFDZDtZQUNILENBQUMsQ0FBQztnQkFDRSxPQUFPLEVBQUUsVUFBVSxD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
