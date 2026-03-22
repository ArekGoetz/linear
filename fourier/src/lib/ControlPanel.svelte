<script lang="ts">
  interface Props {
    stiffness: number;
    lambda: number;
    damping: number;
    memory: number;
    midpointIterates: number;
    alphaBlend: number;
    dim: string;
    exp: string;
    aMag: number;
    sRigidity: number;
    dragIndex: number | string;
    onDimChange: (n: number, exp: number) => void;
    onParamChange: (key: string, val: number) => void;
  }

  let {
    stiffness = $bindable(0.55),
    lambda = $bindable(0.9),
    damping = $bindable(0.025),
    memory = $bindable(0.15),
    midpointIterates = $bindable(0),
    alphaBlend = $bindable(0.5),
    dim = $bindable('5'),
    exp = $bindable('1'),
    aMag,
    sRigidity,
    dragIndex,
    onDimChange,
    onParamChange,
  }: Props = $props();

  let isPaneWide = $state(false);
  let borderDragging = $state(false);
  let borderStartX = $state<number | null>(null);
  let controlsOpen = $state(true);

  const PANE_NARROW = 120;
  const PANE_WIDE_W = 200;
  const PANE_THRESHOLD = 160;

  let paneWidth = $state(PANE_NARROW);

  function setPaneSize(wide: boolean) {
    isPaneWide = wide;
    paneWidth = wide ? PANE_WIDE_W : PANE_NARROW;
  }

  function handleHandleMousedown(e: MouseEvent) {
    borderDragging = true;
    borderStartX = e.clientX;
    e.preventDefault();
  }

  function handleDocMousemove(e: MouseEvent) {
    if (!borderDragging) return;
    const liveWidth = Math.max(80, Math.min(400, window.innerWidth - e.clientX));
    paneWidth = liveWidth;
  }

  function handleDocMouseup(e: MouseEvent) {
    if (!borderDragging) return;
    borderDragging = false;
    const dragDist = Math.abs(e.clientX - (borderStartX ?? e.clientX));
    if (dragDist < 4) {
      setPaneSize(!isPaneWide);
    } else {
      const liveWidth = window.innerWidth - e.clientX;
      setPaneSize(liveWidth > PANE_THRESHOLD);
    }
    borderStartX = null;
  }

  function handleDimKeydown(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    let nd = parseInt(dim);
    if (isNaN(nd)) return;
    nd = Math.max(3, Math.min(100, nd));
    let ne = parseInt(exp);
    if (isNaN(ne)) ne = 1;
    ne = Math.max(1, Math.min(nd - 1, Math.min(100, ne)));
    dim = String(nd);
    exp = String(ne);
    onDimChange(nd, ne);
  }

  function handleExpKeydown(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    let nd = parseInt(dim);
    if (isNaN(nd)) nd = 5;
    let ne = parseInt(exp);
    if (isNaN(ne)) ne = 1;
    ne = Math.max(1, Math.min(Math.min(100, nd - 1), ne));
    exp = String(ne);
    onDimChange(nd, ne);
  }

  // Derived stiffness display
  function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
  let stiffDisplay = $derived(
    `${lerp(30, 1200, stiffness).toFixed(0)} / ${lerp(3, 240, stiffness).toFixed(0)} / ${lerp(75, 1800, stiffness).toFixed(0)} / R:${lerp(40, 450, stiffness).toFixed(0)}`
  );
  let dampingDisplay = $derived((damping * 90.0).toFixed(2));
  let memoryDisplay = $derived(`${(memory * 18.0).toFixed(2)} s⁻¹`);
</script>

<svelte:document
  onmousemove={handleDocMousemove}
  onmouseup={handleDocMouseup}
/>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  id="pane-handle"
  style="right: {paneWidth}px;"
  class:dragging={borderDragging}
  onmousedown={handleHandleMousedown}
  role="separator"
  aria-orientation="vertical"
></div>

<div
  id="info-pane"
  style="width: {paneWidth}px;"
  class:pane-wide={isPaneWide}
  class:dragging={borderDragging}
>
  <div id="pane-inner">
    <div class="row">
      <label for="dim-input">vertices</label>
      <input
        type="text"
        id="dim-input"
        class="num3"
        maxlength="3"
        bind:value={dim}
        onkeydown={handleDimKeydown}
      />
    </div>
    <div class="row">
      <label for="exp-input">exp</label>
      <input
        type="text"
        id="exp-input"
        class="num3"
        maxlength="3"
        bind:value={exp}
        onkeydown={handleExpKeydown}
      />
      <div class="hint">1..(n-1); order roots by k⋅exp</div>
    </div>

    <button
      id="disclosure"
      class="row disclosure"
      class:collapsed={!controlsOpen}
      onclick={() => { controlsOpen = !controlsOpen; }}
    >
      <span class="chev">▾</span><strong>controls</strong>
    </button>

    {#if controlsOpen}
    <div id="controls">
      <div class="row hint">Material stiffness (soft ⟷ rigid)</div>
      <div class="slider-row">
        <input
          id="stiff-slider"
          class="slider"
          type="range" min="0" max="1" step="0.01"
          bind:value={stiffness}
          oninput={() => onParamChange('stiffness', stiffness)}
        />
        <span class="val">{stiffDisplay}</span>
      </div>

      <div class="sep"></div>
      <div class="row hint">Spread of motion (local ⟷ global)</div>
      <div class="slider-row">
        <input
          id="lambda-slider"
          class="slider"
          type="range" min="0.05" max="4.50" step="0.01"
          bind:value={lambda}
          oninput={() => onParamChange('lambda', lambda)}
        />
        <span class="val">{lambda.toFixed(2)}</span>
      </div>

      <div class="sep"></div>
      <div class="row hint">Damping (bouncy ⟷ syrupy)</div>
      <div class="slider-row">
        <input
          id="damp-slider"
          class="slider"
          type="range" min="0" max="1" step="0.01"
          bind:value={damping}
          oninput={() => onParamChange('damping', damping)}
        />
        <span class="val">{dampingDisplay}</span>
      </div>

      <div class="sep"></div>
      <div class="row hint">Memory (springy ⟷ clay)</div>
      <div class="slider-row">
        <input
          id="memory-slider"
          class="slider"
          type="range" min="0" max="1" step="0.01"
          bind:value={memory}
          oninput={() => onParamChange('memory', memory)}
        />
        <span class="val">{memoryDisplay}</span>
      </div>

      <div class="sep"></div>
      <div class="row hint">Averaging polygon iterates</div>
      <div class="slider-row">
        <input
          id="midpoint-slider"
          class="slider"
          type="range" min="0" max="20" step="1"
          bind:value={midpointIterates}
          oninput={() => onParamChange('midpointIterates', midpointIterates)}
        />
        <span class="val">{midpointIterates}</span>
      </div>

      <div class="sep"></div>
      <div class="row hint">Blend α (linear ⟷ curved)</div>
      <div class="slider-row">
        <input
          id="alpha-slider"
          class="slider"
          type="range" min="0" max="1" step="0.01"
          bind:value={alphaBlend}
          oninput={() => onParamChange('alphaBlend', alphaBlend)}
        />
        <span class="val">{alphaBlend.toFixed(2)}</span>
      </div>
    </div>
    {/if}

    <div class="sep"></div>
    <div class="row"><span class="hint">accel |a|</span><span class="val">{aMag.toFixed(2)}</span></div>
    <div class="row"><span class="hint">rigidity s(a)</span><span class="val">{sRigidity.toFixed(2)}</span></div>
    <div class="row"><span class="hint">drag index</span><span class="val">{dragIndex}</span></div>
    <div class="row hint">Click the gray ring to freeze &amp; forget (no dynamics) until a vertex is dragged.</div>
  </div>
</div>

<style>
  :root {
    --pane-w: 120px;
    --pane-current-w: 120px;
  }

  #info-pane {
    position: absolute;
    top: 0;
    right: 0;
    background: rgba(250, 250, 250, 0.8);
    padding: 8px;
    box-sizing: border-box;
    font-size: 11px;
    backdrop-filter: blur(2px);
    max-height: 95vh;
    overflow-y: auto;
    transition: width 0.15s ease;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, sans-serif;
    color: #222;
  }
  #info-pane.dragging {
    transition: none;
  }
  #info-pane.pane-wide #pane-inner {
    zoom: 1.75;
  }

  #pane-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 10px;
    cursor: ew-resize;
    z-index: 200;
    background-image:
      linear-gradient(to right,
        #999 0px, #999 1px,
        white 1px, white 9px,
        #999 9px, #999 10px),
      repeating-linear-gradient(to bottom,
        transparent 0px, transparent 5px,
        #bbb 5px, #bbb 7px,
        transparent 7px, transparent 14px);
    background-size: 10px 100%, 3px 14px;
    background-position: 0 0, 4px 0;
    background-repeat: no-repeat, repeat-y;
    transition: right 0.15s ease;
  }
  #pane-handle.dragging {
    transition: none;
  }

  #info-pane input[type="text"] {
    width: 100%;
    box-sizing: border-box;
  }
  .num3 {
    width: 3ch;
    padding: 2px;
  }
  :global(#info-pane .row) {
    margin-bottom: 4px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 2px;
    align-items: center;
  }
  .row {
    margin-bottom: 4px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 2px;
    align-items: center;
  }
  .val {
    font-variant-numeric: tabular-nums;
  }
  .slider-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    align-items: center;
    margin-bottom: 4px;
  }
  .slider-row .slider {
    width: 100%;
    margin: 0;
    accent-color: #888;
  }
  .slider-row .val {
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }
  .slider {
    width: 100%;
    accent-color: #888;
  }
  .hint {
    color: #666;
    font-size: 10px;
  }
  .sep {
    height: 1px;
    background: #e5e5e5;
    margin: 6px 0;
  }
  .disclosure {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    user-select: none;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    width: 100%;
    text-align: left;
  }
  .chev {
    transition: transform 0.15s ease;
    font-size: 12px;
  }
  .collapsed .chev {
    transform: rotate(-90deg);
  }
</style>
