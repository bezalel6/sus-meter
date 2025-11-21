# CSS-Based Profile Detection: Research & Implementation Plan

**Branch**: `feature/css-based-profile-detection`
**Date**: 2025-11-21
**Goal**: Replace costly MutationObserver with efficient CSS-based detection methodology

---

## Executive Summary

This document outlines a research-backed plan to replace the current MutationObserver-based profile detection system with a more efficient CSS-based approach. The current implementation scans the entire DOM on every relevant mutation, which is resource-intensive on dynamic chess websites. The proposed solution uses CSS animation events and modern Observer APIs to achieve significant performance improvements.

---

## Current Implementation Analysis

### Architecture (src/content/lichess.ts & src/content/chess-com.ts)

**Lines 61-76**: MutationObserver setup
```typescript
this.observer = new MutationObserver((mutations) => {
  const hasRelevantChanges = mutations.some(mutation =>
    mutation.type === 'childList' && mutation.addedNodes.length > 0
  );

  if (hasRelevantChanges) {
    this.scanForProfiles();
  }
});

this.observer.observe(document.body, {
  childList: true,
  subtree: true,
});
```

### Performance Bottlenecks

1. **Global Observation**: Observes entire `document.body` with `subtree: true`
   - Fires on every DOM mutation across the entire page
   - No throttling beyond basic "hasRelevantChanges" check

2. **Full DOM Scans**: `findProfileElements()` (Lines 122-225)
   - Executes `querySelectorAll` with 7+ complex selectors on every relevant mutation
   - Scans entire DOM tree each time
   - No incremental detection

3. **High Mutation Frequency**: Chess websites are highly dynamic
   - Live games: board updates, move lists, timer changes
   - Chat: new messages constantly
   - Tournaments: standings updates
   - Lobbies: game list refreshes

4. **Redundant Processing**
   - Same elements may be scanned multiple times
   - No spatial awareness (scans elements not in viewport)

### Cost Estimation

On a typical chess.com game page:
- **~50-100 mutations/minute** during active gameplay
- **~200ms per full DOM scan** with complex selectors
- **~10-20 seconds of blocking time per minute** of browsing

---

## Research Findings

### 1. CSS Animation Detection Technique

**Concept**: Use `animationstart` events to detect when elements matching specific selectors appear in the DOM.

#### How It Works

1. Define CSS keyframe animations for target selectors:
```css
@keyframes sus-meter-detect-user-link {
  from { opacity: 0.99; }
  to { opacity: 1; }
}

.user-link, a[href*="/@/"], .username-component {
  animation: sus-meter-detect-user-link 0.001s;
}
```

2. Listen for `animationstart` events:
```javascript
document.addEventListener('animationstart', (event) => {
  if (event.animationName === 'sus-meter-detect-user-link') {
    handleNewUserElement(event.target);
  }
}, true);
```

#### Performance Characteristics

✅ **Advantages**:
- **Event-driven**: Only fires when matching elements are actually added
- **Minimal overhead**: Single hash lookup per animationstart event
- **Browser-optimized**: Leverages native CSS engine efficiency
- **No polling**: Unlike MutationObserver, doesn't fire on unrelated changes
- **Lightweight**: ~650 bytes (SentinelJS library reference)

❌ **Limitations**:
- Does not detect `display: none` elements (detects `visibility: hidden`)
- Requires CSS injection (already done for badge styling)
- Animation conflicts: Must use unique, non-interfering animations
- CSS specificity: May need `!important` for high-specificity sites

#### Browser Support
- Chrome/Edge: ✅ Excellent
- Firefox: ✅ Excellent
- Safari: ✅ Excellent
- **All modern browsers since ~2015**

### 2. IntersectionObserver

**Concept**: Efficiently detect when elements enter/exit the viewport.

#### Use Case for This Project

While IntersectionObserver doesn't detect element insertion, it's perfect for **deferred processing**:

```javascript
// Detect elements via CSS animation
function handleNewUserElement(element) {
  // Only process if element is visible or near viewport
  if (!viewportObserver) return;

  viewportObserver.observe(element);
}

// Process when element enters viewport
const viewportObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      processProfile(entry.target);
      viewportObserver.unobserve(entry.target);
    }
  });
}, { rootMargin: '100px' }); // Pre-load 100px before visible
```

#### Performance Characteristics

✅ **Advantages**:
- **Lazy processing**: Only analyze profiles when they're about to be visible
- **Browser-optimized**: Offloads intersection calculations to browser
- **Reduces wasted work**: Don't process off-screen profiles that may never be seen
- **Configurable margins**: Can tune "pre-load" distance

❌ **Limitations**:
- Adds complexity (two-stage detection)
- Delayed badges for initially off-screen elements
- May not be needed if CSS animation detection is already fast enough

### 3. ResizeObserver

**Concept**: Detect when elements change size (including 0 to non-zero, i.e., insertion).

#### Use Case for This Project

ResizeObserver can detect element insertion/removal:

```javascript
const resizeObserver = new ResizeObserver((entries) => {
  entries.forEach(entry => {
    // Element has appeared in DOM (size changed from 0)
    if (entry.borderBoxSize[0].inlineSize > 0) {
      handleNewUserElement(entry.target);
    }
  });
});

// Observe container elements that receive new user links
document.querySelectorAll('.chat-container, .game-meta, .tournament-standings')
  .forEach(container => resizeObserver.observe(container));
```

#### Performance Characteristics

✅ **Advantages**:
- **10x faster** than event-based approaches (Chrome benchmarks)
- **Optimized timing**: Fires between layout and paint
- **Safe reads**: Can read offsetWidth/scrollWidth without forced reflow
- **Detects insertion/removal**: Fires when display changes to/from none

❌ **Limitations**:
- Must know container elements in advance
- Doesn't detect individual element insertion (only container resize)
- May fire on unrelated size changes
- Requires observing multiple containers

---

## Proposed Solutions

### Solution A: Pure CSS Animation Detection (Recommended)

**Architecture**: Single-stage detection using CSS animations + event listeners.

#### Implementation

1. **CSS Injection** (extend existing styles in profile-injector.ts:29)

```typescript
private injectDetectionStyles(): void {
  const style = document.createElement('style');
  style.id = 'sus-meter-detection-styles';
  style.textContent = `
    /* Detection animations */
    @keyframes sus-meter-detect {
      from { clip-path: inset(0 0 0 0); }
      to { clip-path: inset(0 0 0 0); }
    }

    /* Lichess selectors */
    .user-link,
    a[href*="/@/"],
    .mchat__messages a,
    .game__meta a,
    .tournament__standings a {
      animation: sus-meter-detect 0.001s !important;
    }

    /* Chess.com selectors */
    .user-username-component,
    a[href*="/member/"],
    a[href*="/players/"],
    .username-component {
      animation: sus-meter-detect 0.001s !important;
    }
  `;
  document.head.appendChild(style);
}
```

2. **Event Listener Setup** (replace startDetection() in lichess.ts:56)

```typescript
private startDetection(): void {
  // Initial scan for already-present elements
  this.scanForProfiles();

  // Set up CSS animation detection
  this.animationHandler = (event: AnimationEvent) => {
    if (event.animationName === 'sus-meter-detect') {
      this.handleNewElement(event.target as HTMLElement);
    }
  };

  document.addEventListener('animationstart', this.animationHandler, true);

  logger.debug('Started CSS-based profile detection');
}

private handleNewElement(element: HTMLElement): void {
  if (!this.isEnabled) return;

  const username = this.extractUsername(element);
  if (!username) return;

  const context = this.determineContext(element);
  const key = `${username}:${element.tagName}:${context}`;

  if (this.detectedProfiles.has(key)) return;

  this.detectedProfiles.add(key);
  this.processProfiles([{
    element,
    username,
    context,
    platform: this.platform
  }]);
}

private determineContext(element: HTMLElement): string {
  // Efficient context detection via closest()
  if (element.closest('.mchat__messages, .chat__messages')) return 'chat';
  if (element.closest('.game__meta, .ruser-top')) return 'game';
  if (element.closest('.tournament__standings, .standing')) return 'tournament';
  if (element.closest('.user-show__header')) return 'profile';
  return 'list';
}
```

3. **Cleanup** (update stopDetection() in lichess.ts:83)

```typescript
private stopDetection(): void {
  if (this.animationHandler) {
    document.removeEventListener('animationstart', this.animationHandler, true);
    this.animationHandler = null;
  }

  this.injector.removeAllBadges();
  this.detectedProfiles.clear();

  logger.debug('Stopped profile detection');
}
```

#### Performance Impact

**Before (MutationObserver)**:
- Observes: Entire document.body
- Fires: ~50-100 times/minute
- Work per fire: Full DOM scan with querySelectorAll (7+ selectors)
- Estimated cost: ~10-20s blocking time per minute

**After (CSS Animation)**:
- Observes: Only elements matching CSS selectors
- Fires: Only when new user links are added (~5-10 times/minute)
- Work per fire: Single element processing
- Estimated cost: <0.5s per minute

**Expected improvement: 95%+ reduction in detection overhead**

---

### Solution B: Hybrid CSS Animation + IntersectionObserver

**Architecture**: Two-stage detection for maximum efficiency.

#### Implementation

Stage 1: CSS animation detects new elements and marks them
Stage 2: IntersectionObserver processes only when elements are near viewport

```typescript
private startDetection(): void {
  this.scanForProfiles();

  // Stage 1: Detect new elements
  this.animationHandler = (event: AnimationEvent) => {
    if (event.animationName === 'sus-meter-detect') {
      const element = event.target as HTMLElement;

      // Mark element as detected but defer processing
      element.dataset.susDetected = 'true';

      // Observe for viewport intersection
      this.viewportObserver?.observe(element);
    }
  };

  // Stage 2: Process when visible
  this.viewportObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.target.dataset.susDetected) {
        this.handleNewElement(entry.target as HTMLElement);
        this.viewportObserver?.unobserve(entry.target);
        delete entry.target.dataset.susDetected;
      }
    });
  }, { rootMargin: '100px' }); // Pre-load 100px before visible

  document.addEventListener('animationstart', this.animationHandler, true);
}
```

#### Performance Impact

**Compared to Solution A**:
- Further reduces processing for off-screen elements
- Adds complexity and slight delay for badge appearance
- Best for pages with hundreds of profiles (tournament standings, etc.)
- Overkill for typical game pages with <20 profiles

**Recommendation**: Start with Solution A, add viewport optimization only if profiling shows it's needed.

---

### Solution C: ResizeObserver on Containers (Not Recommended)

**Architecture**: Observe known container elements for size changes.

#### Why Not Recommended

1. **Limited detection**: Only detects container size changes, not individual elements
2. **False positives**: Fires on unrelated size changes
3. **Requires container knowledge**: Must maintain list of all possible containers
4. **Misses dynamic containers**: New containers added by SPA routing won't be observed
5. **No clear advantage**: CSS animation detection is simpler and more reliable

**Verdict**: ResizeObserver is excellent for its intended use case (responsive layouts), but CSS animation detection is purpose-built for element insertion detection.

---

## Recommended Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal**: Implement CSS animation detection as a feature flag alongside existing MutationObserver.

#### Tasks

1. **Add detection styles to ProfileInjector** (profile-injector.ts:22)
   - [ ] Create `injectDetectionStyles()` method
   - [ ] Add platform-specific CSS selectors
   - [ ] Use unique animation name to avoid conflicts
   - [ ] Inject on ProfileInjector construction

2. **Create new detection method** (lichess.ts & chess-com.ts)
   - [ ] Add `private animationHandler: ((e: AnimationEvent) => void) | null`
   - [ ] Implement `handleNewElement(element: HTMLElement)`
   - [ ] Implement `determineContext(element: HTMLElement)` using `closest()`
   - [ ] Update `startDetection()` to use CSS animation events
   - [ ] Update `stopDetection()` to clean up event listener

3. **Add feature flag** (types/index.ts)
   - [ ] Add `useCssDetection?: boolean` to ExtensionSettings
   - [ ] Default to `false` initially (use MutationObserver)
   - [ ] Add UI toggle in popup settings

4. **Testing**
   - [ ] Test on lichess.org: games, chat, tournaments, profile pages
   - [ ] Test on chess.com: games, chat, arenas, clubs
   - [ ] Verify no animation conflicts or visual glitches
   - [ ] Verify detection completeness (no missed profiles)

### Phase 2: Performance Validation (Week 2)

**Goal**: Measure and compare performance of both approaches.

#### Tasks

1. **Add performance instrumentation**
   - [ ] Track detection events: count, timing, element type
   - [ ] Log to console with logger.debug (can filter in production)
   - [ ] Create performance comparison report

2. **User testing**
   - [ ] Enable CSS detection via settings for opted-in users
   - [ ] Collect feedback on detection accuracy
   - [ ] Monitor for bug reports or missed detections

3. **Benchmarking**
   - [ ] Measure CPU usage with Chrome DevTools Performance tab
   - [ ] Compare MutationObserver vs CSS animation detection
   - [ ] Test edge cases: rapid chat, tournament standings updates

### Phase 3: Migration (Week 3)

**Goal**: Make CSS detection the default approach.

#### Tasks

1. **Switch default**
   - [ ] Set `useCssDetection: true` as default
   - [ ] Keep MutationObserver as fallback option
   - [ ] Update README documentation

2. **Code cleanup** (after validation period)
   - [ ] Remove MutationObserver code if CSS detection proves stable
   - [ ] Remove feature flag if no longer needed
   - [ ] Update comments and documentation

### Phase 4: Optional Optimization (Future)

**Goal**: Add IntersectionObserver optimization if needed.

#### Triggers for this phase
- Performance profiling shows significant work on off-screen elements
- User reports of lag on pages with 100+ profiles
- Chrome DevTools shows high CPU during idle scrolling

#### Tasks
- [ ] Implement hybrid CSS + IntersectionObserver approach
- [ ] Add `rootMargin` configuration to settings
- [ ] Test on large tournament standings pages

---

## Technical Considerations

### 1. CSS Animation Conflicts

**Risk**: Websites may already use animations on user links.

**Mitigation**:
- Use extremely short duration (0.001s) - imperceptible to users
- Use non-visual property changes (clip-path with no effect)
- Use unique animation name with extension prefix
- Use `!important` only if absolutely necessary

**Alternative approaches**:
- Use `animation-name` concatenation (doesn't override existing animations)
- Feature-detect animation support before enabling

### 2. Selector Coverage

**Risk**: Missing some profile elements due to incomplete selectors.

**Mitigation**:
- Comprehensive selector testing on both platforms
- Add fallback scan on page load for already-present elements
- Log missed elements during development for selector refinement
- Allow users to report missed profiles via popup

**Maintenance**:
- Selectors may need updates as chess sites evolve
- Consider extracting selectors to configuration files
- Version selectors per platform for easier updates

### 3. Single-Page Application (SPA) Behavior

**Risk**: SPAs may reuse elements or navigate without full page loads.

**Mitigation**:
- CSS animation fires on any insertion, including SPA navigations
- Initial scan on page load catches pre-existing elements
- Listen for history API changes as backup (pushState/popState events)

### 4. Performance Monitoring

**Ongoing requirement**: Continuously validate performance improvements.

**Metrics to track**:
- Detection events per minute
- Time from element insertion to badge injection
- CPU usage during active browsing
- Memory usage (WeakSet for injected elements prevents leaks)

**Tools**:
- Chrome DevTools Performance profiler
- Performance Observer API for production monitoring
- User feedback via extension popup

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Animation conflicts | Low | Medium | Unique names, short duration, testing |
| Missed detections | Medium | High | Comprehensive selectors, fallback scan, user reports |
| Browser incompatibility | Very Low | High | Feature detection, fallback to MutationObserver |
| SPA navigation issues | Low | Medium | Initial scan, history API listeners |
| CSS specificity wars | Medium | Low | Use !important sparingly, test on both platforms |

---

## Success Metrics

### Quantitative

- [ ] **95%+ reduction** in detection-related CPU time
- [ ] **<100ms** from element insertion to badge appearance
- [ ] **100%** detection accuracy (no missed profiles)
- [ ] **0** visual glitches or animation conflicts

### Qualitative

- [ ] No user-reported bugs related to detection
- [ ] Positive feedback on extension performance
- [ ] Simpler, more maintainable codebase
- [ ] Easier to add new platforms in the future

---

## Conclusion

The CSS animation detection technique offers a compelling alternative to MutationObserver-based detection:

✅ **95%+ performance improvement** via event-driven architecture
✅ **Browser-optimized** leveraging native CSS engine
✅ **Simpler code** with less surface area for bugs
✅ **Future-proof** with excellent browser support
✅ **Proven technique** used by libraries like SentinelJS

**Recommendation**: Proceed with **Solution A (Pure CSS Animation Detection)** in Phase 1, with optional Phase 4 optimization if performance profiling indicates benefit.

The hybrid approach (Solution B) should only be considered after measuring real-world performance on pages with 100+ profiles simultaneously visible.

---

## References

- [SentinelJS: Detect new DOM nodes using CSS selectors](https://github.com/kubetail-org/sentineljs) (650 bytes)
- [David Walsh: Detect DOM Node Insertions with JavaScript and CSS Animations](https://davidwalsh.name/detect-node-insertion)
- [MDN: animationstart event](https://developer.mozilla.org/en-US/docs/Web/API/Element/animationstart_event)
- [web.dev: ResizeObserver](https://web.dev/articles/resize-observer)
- [Medium: Intersection Observer vs Mutation Observer](https://medium.com/codex/intersection-observer-vs-mutation-observer-71fd9b8b757d)
