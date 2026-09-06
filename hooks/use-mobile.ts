import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

// The viewport is an external store, so it is read through
// useSyncExternalStore rather than mirrored into state from an effect: the
// effect version set state on its first run, which cascades a second render
// on every mount (react-hooks/set-state-in-effect).
//
// Server renders have no viewport, so they report desktop and the first
// client render corrects it. That matches the previous behaviour, where the
// initial `undefined` collapsed to false.
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}
