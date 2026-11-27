export function isDesktop() {
  if (typeof navigator === "undefined") return true;
  const mobile = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile;
  const ipad = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  return !mobile && !ipad && !/Android|Mobile|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    !matchMedia("(pointer: coarse)").matches && window.screen.width >= 1024;
}
