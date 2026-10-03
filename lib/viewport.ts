/** True on desktop-width viewports — used to gate autofocus so inputs
 *  don't yank the software keyboard up on phones. */
export function isDesktopViewport() {
  return typeof window !== 'undefined' && window.innerWidth >= 768
}
