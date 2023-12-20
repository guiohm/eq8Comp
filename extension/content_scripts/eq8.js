(function () {
  class EQ8 {
    constructor () {
      this.WebAudioContext = (window.AudioContext || window.webkitAudioContext);
      this.DOMMutationObserver = (window.MutationObserver || window.webkitMutationObserver);
      this.pipelines = [];
      this.state = {};
      this.observer = null;
    }

    arrangeFilters (pipeline) {
      const { context, source, filters, preamp, compressor, postamp } = pipeline;
      filters.sort((a, b) => b.filter.frequency - a.filter.frequency);
      const enabledFilters = filters.filter(f => f.enabled);
      const eqAndPreampEnabled = this.state.eqEnabled && enabledFilters.length;
      const preampNoEqEnabled = this.state.eqEnabled && !enabledFilters.length;
      if (eqAndPreampEnabled) {
        enabledFilters.forEach((f, ix, arr) => {
          if (ix > 0) enabledFilters[ix - 1].filter.connect(f.filter);
          if (ix === arr.length - 1) f.filter.connect(this.state.compressor.enabled ? compressor : context.destination);
        });
        preamp.connect(enabledFilters[0].filter);
        source.connect(preamp);
      }
      if (this.state.compressor.enabled) {
        postamp.connect(context.destination);
        compressor.connect(postamp);
        if (!eqAndPreampEnabled && !preampNoEqEnabled) {
          source.connect(compressor);
        } else if (preampNoEqEnabled) { // Eq ON but no filters -> preamp still active
          preamp.connect(compressor);
          source.connect(preamp);
        }
      }
      // only preamp
      if (!this.state.compressor.enabled && preampNoEqEnabled) {
        preamp.connect(context.destination);
        source.connect(preamp);
      } else if (!this.state.compressor.enabled && !eqAndPreampEnabled) { // everything off
        source.connect(context.destination);
      }
    }

    createPipelineForElement (element) {
      const { filters, preampMultiplier } = this.state;
      const context = new this.WebAudioContext();
      const source = context.createMediaElementSource(element);
      const elFilters = [];
      filters.forEach((filter) => {
        const f = context.createBiquadFilter();
        const { frequency, q, gain, type, enabled, id } = filter;
        f.frequency.value = frequency;
        f.Q.value = q;
        f.gain.value = gain;
        f.type = type;
        elFilters.push({ filter: f, enabled, id });
      });
      const preamp = context.createGain();
      preamp.gain.value = preampMultiplier;
      const compressor = context.createDynamicsCompressor();
      const postamp = context.createGain();
      postamp.gain.value = this.multiplierFromGain(this.state.compressor.gain);
      const pipeline = { context, source, filters: elFilters, preamp, compressor, postamp, element };
      this.arrangeFilters(pipeline);
      this.pipelines.push(pipeline);
    }

    updatePipelines () {
      this.pipelines.forEach((pipeline) => {
        const { context, source, filters, preamp, compressor, postamp } = pipeline;
        this.state.filters.forEach(f => {
          const entry = filters.find(i => i.id === f.id);
          const filter = entry.filter;
          filter.frequency.value = f.frequency;
          filter.type = f.type;
          filter.Q.value = f.q;
          filter.gain.value = f.gain;
          entry.enabled = f.enabled;
        });
        preamp.gain.value = this.state.preampMultiplier;
        compressor.threshold.setValueAtTime(this.state.compressor.threshold, context.currentTime);
        compressor.ratio.setValueAtTime(this.state.compressor.ratio, context.currentTime);
        compressor.attack.setValueAtTime(this.state.compressor.attack, context.currentTime);
        compressor.release.setValueAtTime(this.state.compressor.release, context.currentTime);
        compressor.knee.setValueAtTime(this.state.compressor.knee, context.currentTime);
        postamp.gain.value = this.multiplierFromGain(this.state.compressor.gain);
        source.disconnect();
        preamp.disconnect();
        filters.forEach(f => f.filter.disconnect());
        compressor.disconnect();
        postamp.disconnect();
        this.arrangeFilters(pipeline);
      });
    }

    onMessage (msg) {
      if (msg.type === 'SET::STATE') {
        this.state = msg.state;
        this.updatePipelines();
      } else if (msg.type === 'GET::GAIN_REDUCTION') {
        if (this.pipelines.length) {
          browser.runtime.sendMessage({ type: 'SET::GAIN_REDUCTION', value: this.pipelines[0].compressor.reduction });
        }
      }
    }

    domMutated () {
      const mediaElements = ([...document.body.querySelectorAll('video')])
        .concat([...document.body.querySelectorAll('audio')]);

      mediaElements
        .filter(el => !el.eq8Comp)
        .forEach(el => {
          console.log('[eq8Comp]: new audio source discovered');
          el.eq8Comp = true;
          this.createPipelineForElement(el);
        });

      for (let i = this.pipelines.size; i > 0; i--) {
        if (!mediaElements.includes(this.pipelines[i].element)) {
          console.log('[eq8Comp]: media element removed');
          this.pipelines.splice(i, 1);
        }
      }
    }

    throttle (func, threshold, context) {
      if (!threshold || threshold < 0) threshold = 250;
      let last;
      let deferred;
      return function () {
        const self = context || this;
        const now = +new Date();
        const args = arguments;
        if (last && now < last + threshold) {
          clearTimeout(deferred);
          deferred = setTimeout(function () {
            last = now;
            func.apply(self, args);
          }, threshold);
        } else {
          last = now;
          func.apply(self, args);
        }
      };
    }

    multiplierFromGain (valueInDb) {
      return Math.pow(10, valueInDb / 20);
    }

    attach () {
      const port = browser.runtime.connect({ name: 'eq8comp' });
      const listener = this.onMessage.bind(this);
      port.onMessage.addListener(listener);

      browser.runtime.sendMessage({ type: 'GET::STATE' }).then(initialState => {
        this.state = initialState;
        const domListener = this.throttle(this.domMutated.bind(this));
        this.observer = new this.DOMMutationObserver(domListener);
        this.observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  }

  const eq8 = new EQ8();
  eq8.attach();
})();
