<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Simulation } from './sim/Simulation';
  import { Renderer } from './ui/Renderer';
  import { InteractionHandler } from './ui/InteractionHandler';
  import { lambdaDefault, dampingDefaultFraction } from './math/physics';
  import ControlPanel from './lib/ControlPanel.svelte';

  let canvas: HTMLCanvasElement;
  let sim: Simulation;
  let renderer: Renderer;
  let handler: InteractionHandler;
  let rafId: number;

  // Reactive readouts for the panel
  let aMag = $state(0);
  let sRigidity = $state(1);
  let dragIndex: number | string = $state('-');

  // Slider state (two-way bound to sim params)
  let stiffness = $state(0.55);
  let lambda = $state(lambdaDefault(5));
  let damping = $state(dampingDefaultFraction(5));
  let memory = $state(0.15);
  let midpointIterates = $state(0);
  let alphaBlend = $state(0.5);
  let dim = $state('5');
  let exp = $state('1');

  $effect(() => {
    if (sim) sim.setMidpointIterates(midpointIterates);
  });

  $effect(() => {
    if (sim) sim.setAlphaBlend(alphaBlend);
  });

  $effect(() => {
    if (sim) {
      sim.applyStiffness(stiffness);
    }
  });

  $effect(() => {
    if (sim) {
      sim.params.lambda = lambda;
    }
  });

  $effect(() => {
    if (sim) {
      sim.applyDamping(damping);
    }
  });

  $effect(() => {
    if (sim) {
      sim.applyMemory(memory);
    }
  });

  onMount(() => {
    sim = new Simulation(5, 1);
    renderer = new Renderer(canvas);
    handler = new InteractionHandler(canvas, sim);

    // init slider values from sim defaults
    const initDim = 5;
    lambda = lambdaDefault(initDim);
    damping = dampingDefaultFraction(initDim);
    sim.params.lambda = lambda;
    sim.applyStiffness(stiffness);
    sim.applyDamping(damping);
    sim.applyMemory(memory);

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    let last = performance.now();

    function loop() {
      const now = performance.now();
      const h = 1 / 240;
      let dt = Math.min(0.03, (now - last) / 1000);
      last = now;
      while (dt > 1e-6) {
        const step = Math.min(h, dt);
        sim.step(step);
        dt -= step;
      }
      const snap = sim.snapshot();
      aMag = snap.smoothedAMag;
      sRigidity = snap.sRigidity;
      dragIndex =
        snap.dragging >= 0
          ? snap.dragging
          : snap.draggingDisc >= 0
          ? `disc ${snap.draggingDisc}`
          : '-';
      renderer.render(snap);
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      handler.destroy();
    };
  });

  function handleDimChange(n: number, e: number) {
    sim.setDim(n, e);
    // update lambda and damping sliders to reflect new defaults
    lambda = sim.params.lambda;
    const dFrac = dampingDefaultFraction(n);
    damping = dFrac;
    sim.applyDamping(dFrac);
  }

  function handleParamChange(key: string, val: number) {
    switch (key) {
      case 'stiffness':
        stiffness = val;
        sim.applyStiffness(val);
        break;
      case 'lambda':
        lambda = val;
        sim.params.lambda = val;
        break;
      case 'damping':
        damping = val;
        sim.applyDamping(val);
        break;
      case 'memory':
        memory = val;
        sim.applyMemory(val);
        break;
      case 'midpointIterates':
        midpointIterates = val;
        sim.setMidpointIterates(val);
        break;
      case 'alphaBlend':
        alphaBlend = val;
        sim.setAlphaBlend(val);
        break;
    }
  }
</script>

<div id="canvas-pane">
  <canvas bind:this={canvas}></canvas>
  <ControlPanel
    bind:stiffness
    bind:lambda
    bind:damping
    bind:memory
    bind:midpointIterates
    bind:alphaBlend
    bind:dim
    bind:exp
    {aMag}
    {sRigidity}
    {dragIndex}
    onDimChange={handleDimChange}
    onParamChange={handleParamChange}
  />
</div>

<style>
  :global(body) {
    margin: 0;
    overflow: hidden;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, sans-serif;
    background: #f5f6f8;
    color: #222;
  }
  #canvas-pane {
    width: 100vw;
    height: 100vh;
    position: relative;
    overflow: hidden;
  }
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
