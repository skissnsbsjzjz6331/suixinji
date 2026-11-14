import { useEffect, useId, useRef } from 'react';
import { createDockRefractionMap } from './dockRefraction';

type Page = '明细' | '统计' | '导入' | '我的';
type TapSlide = { from: number; startedAt: number; duration: number; presence: number };
const tapRevealMs = 48;
const tapHoldMs = 42;
const tapFadeMs = 130;
const destinations: { label: Page | '＋'; icon: string }[] = [
  { label: '明细', icon: 'receipt_long' },
  { label: '统计', icon: 'bar_chart' },
  { label: '＋', icon: 'add' },
  { label: '导入', icon: 'document_scanner' },
  { label: '我的', icon: 'settings' },
];
const indices = [0, 1, 3, 4];
const indexOf = (page: Page) => destinations.findIndex(item => item.label === page);
const closestPage = (position: number) => indices.reduce((best, index) => Math.abs(index - position) < Math.abs(best - position) ? index : best);

export function LiquidDock({ page, onSelect, onAdd }: { page: Page; onSelect: (page: Page) => void; onAdd: () => void }) {
  const barRef = useRef<HTMLElement>(null);
  const lensRef = useRef<HTMLSpanElement>(null);
  const mapRef = useRef<SVGFEImageElement>(null);
  const filterId = 'dock-refraction-' + useId().replace(/[^a-z0-9_-]/gi, '');
  const startRef = useRef<() => void>(() => {});
  const state = useRef({
    position: indexOf(page), target: indexOf(page), velocity: 0,
    presence: 0, shape: 0, releasedAt: 0, frame: 0, last: 0,
    pointer: -1, startX: 0, dragged: false, suppressClick: false,
    tapSlide: null as TapSlide | null,
  });
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    const bar = barRef.current;
    const lens = lensRef.current;
    if (!bar || !lens) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mapRef.current && !mapRef.current.getAttribute('href')) {
      const map = createDockRefractionMap();
      if (map) {
        mapRef.current.setAttribute('href', map);
        // Safari accepts the syntax but does not apply SVG displacement to backdrops.
        const userAgent = navigator.userAgent;
        const isWebKit = /AppleWebKit/.test(userAgent) && !/\bChrom(?:e|ium)\//.test(userAgent);
        if (CSS.supports('backdrop-filter', 'url(#lens)') && !isWebKit) {
          lens.style.setProperty('--lens-filter', `url("#${filterId}")`);
        }
      }
    }
    const motion = state.current;
    const tick = (now: number) => {
      motion.frame = 0;
      const dt = Math.min(.032, Math.max(.001, (now - (motion.last || now - 16)) / 1000));
      motion.last = now;
      const dragging = motion.pointer !== -1 && motion.dragged;
      const releaseAge = motion.releasedAt ? Math.max(0, (now - motion.releasedAt) / 1000) : 1;
      const tapSlide = motion.tapSlide;
      if (tapSlide) {
        const elapsed = Math.max(0, now - tapSlide.startedAt);
        const progress = Math.max(0, Math.min(1, (elapsed - tapRevealMs) / tapSlide.duration));
        const glide = progress * progress * (3 - 2 * progress);
        motion.position = tapSlide.from + (motion.target - tapSlide.from) * glide;
        const fade = Math.max(0, Math.min(1, (elapsed - tapRevealMs - tapSlide.duration - tapHoldMs) / tapFadeMs));
        const appearance = Math.min(1, elapsed / tapRevealMs);
        motion.presence = (tapSlide.presence + (1 - tapSlide.presence) * appearance) * (1 - fade ** 1.3);
        motion.shape = .13 * Math.sin(progress * Math.PI) - .065 * Math.sin(fade * Math.PI);
        if (fade === 1) motion.tapSlide = null;
      } else if (dragging) {
        const previous = motion.position;
        motion.position += (motion.target - motion.position) * (1 - Math.exp(-dt * 85));
        motion.velocity = Math.max(-10, Math.min(10, (motion.position - previous) / dt));
      } else {
        motion.velocity += ((motion.target - motion.position) * 310 - motion.velocity * 20) * dt;
        motion.position += motion.velocity * dt;
      }

      if (!tapSlide) {
        const presenceTarget = dragging ? 1 : Math.max(0, Math.min(1, (0.36 - releaseAge) / .19));
        const shapeTarget = dragging
          ? Math.min(.28, Math.abs(motion.velocity) * .028)
          : -.32 * Math.exp(-releaseAge * 7) * Math.sin(releaseAge * 25);
        motion.presence += (presenceTarget - motion.presence) * (1 - Math.exp(-dt * 34));
        motion.shape += (shapeTarget - motion.shape) * (1 - Math.exp(-dt * 38));
      }
      if (reducedMotion.matches) {
        motion.position = motion.target;
        motion.presence = dragging ? 1 : 0;
        motion.shape = 0;
        motion.tapSlide = null;
      }

      const pitch = (bar.clientWidth - 8) / 5;
      const travel = pitch * motion.position;
      const size = .88 + motion.presence * .12;
      const shape = motion.shape * motion.presence;
      lens.style.transform = `translate3d(${travel}px,0,0) scale(${size + shape},${size - shape * .64})`;
      const opacity = String(motion.presence > .015 ? motion.presence : 0);
      lens.style.opacity = opacity;
      bar.style.setProperty('--dock-glass-presence', opacity);
      if (dragging || (!reducedMotion.matches && (motion.tapSlide || releaseAge < .36 || motion.presence > .015))) {
        motion.frame = requestAnimationFrame(tick);
      } else {
        motion.last = 0;
        motion.position = motion.target;
        motion.presence = motion.shape = motion.velocity = 0;
      }
    };
    startRef.current = () => { if (!motion.frame) motion.frame = requestAnimationFrame(tick); };
    startRef.current();
    return () => { cancelAnimationFrame(motion.frame); motion.frame = 0; motion.last = 0; startRef.current = () => {}; };
  }, [filterId]);

  useEffect(() => { state.current.target = indexOf(page); startRef.current(); }, [page]);

  const selectTab = (next: Page) => {
    if (next === page) return;
    const motion = state.current;
    // A quick second tap redirects the visible lens from its current position.
    if (motion.presence <= .015) motion.position = indexOf(page);
    motion.target = indexOf(next);
    motion.velocity = 0;
    motion.releasedAt = 0;
    motion.tapSlide = {
      from: motion.position,
      startedAt: performance.now(),
      duration: Math.min(390, 275 + Math.abs(motion.target - motion.position) * 28),
      presence: motion.presence,
    };
    startRef.current();
    onSelect(next);
  };

  const point = (clientX: number) => {
    const bar = barRef.current;
    if (!bar) return 0;
    const bounds = bar.getBoundingClientRect();
    const pitch = (bounds.width - 8) / 5;
    const position = (clientX - bounds.left - 4) / pitch - .5;
    if (position < 0) return -.18 * (1 - Math.exp(position / .18));
    if (position > 4) return 4 + .18 * (1 - Math.exp((4 - position) / .18));
    return position;
  };

  return <nav ref={barRef} className="nav liquid-dock" onPointerDown={event => {
    if (event.button !== 0 || state.current.pointer !== -1) return;
    const motion = state.current;
    motion.pointer = event.pointerId;
    motion.startX = event.clientX;
    motion.dragged = false;
    motion.suppressClick = false;
  }} onPointerMove={event => {
    const motion = state.current;
    if (motion.pointer !== event.pointerId) return;
    if (!motion.dragged && Math.abs(event.clientX - motion.startX) < 9) return;
    if (!motion.dragged) {
      motion.dragged = true;
      motion.tapSlide = null;
      motion.releasedAt = 0;
      motion.position = point(motion.startX);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    motion.target = point(event.clientX);
    startRef.current();
  }} onPointerUp={event => {
    const motion = state.current;
    if (motion.pointer !== event.pointerId) return;
    motion.pointer = -1;
    if (motion.dragged) {
      motion.releasedAt = performance.now();
      motion.suppressClick = true;
      const index = closestPage(point(event.clientX));
      selectRef.current(destinations[index].label as Page);
      motion.target = index;
      startRef.current();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }} onPointerLeave={event => {
    const motion = state.current;
    if (motion.pointer === event.pointerId && !motion.dragged) motion.pointer = -1;
  }} onPointerCancel={event => {
    const motion = state.current;
    if (motion.pointer !== event.pointerId) return;
    motion.pointer = -1;
    if (motion.dragged) motion.releasedAt = performance.now();
    motion.target = indexOf(page);
    startRef.current();
  }} onClickCapture={event => {
    if (!state.current.suppressClick || event.detail === 0) return;
    state.current.suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  }}>
    <svg className="dock-filter" width="0" height="0" aria-hidden="true">
      <filter id={filterId} x="0" y="0" width="100%" height="100%" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
        <feImage ref={mapRef} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale=".24" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
    <span ref={lensRef} className="nav-glider" aria-hidden="true" />
    {destinations.map(({ label, icon }) => <button key={label} className={`${page === label ? 'selected' : ''} ${label === '＋' ? 'add' : ''}`} onClick={() => label === '＋' ? onAdd() : selectTab(label)}><span className="material-symbols-outlined" aria-hidden="true">{icon}</span><span>{label === '＋' ? '记一笔' : label}</span></button>)}
  </nav>;
}
