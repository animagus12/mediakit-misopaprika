/**
 * Keeps the tap that closes a dropdown from also pressing what is under it.
 *
 * A Select or menu closes the moment a press outside it begins. A mouse's
 * click is aimed at that moment, while the dropdown still covers the page, so
 * it lands nowhere. A tap's click is aimed when the finger lifts, by which time
 * the dropdown has gone, so it would press whatever is under the finger: Save,
 * Cancel, a row. Cancelling the end of that touch stops the click.
 *
 * Call it from the dropdown's onPointerDownOutside, after any handler that
 * might keep the dropdown open.
 */
export function stopTapThrough(event: CustomEvent<{ originalEvent: PointerEvent }>): void {
  if (event.defaultPrevented || event.detail.originalEvent.pointerType !== "touch") return;

  function handleTouchEnd(touch: TouchEvent) {
    // A touch that scrolled can no longer be cancelled, and has no click to stop.
    if (touch.type === "touchend" && touch.cancelable) touch.preventDefault();
    document.removeEventListener("touchend", handleTouchEnd, true);
    document.removeEventListener("touchcancel", handleTouchEnd, true);
  }
  document.addEventListener("touchend", handleTouchEnd, true);
  document.addEventListener("touchcancel", handleTouchEnd, true);
}
