function writeEq8Log () {
  // eslint-disable-next-line no-console
  console.log('%c[eq8comp]%c', 'color:green; font-weight:bold;', '', ...arguments);
}

(function () {
  window.browser = (function () {
    return window.msBrowser ||
      window.browser ||
      window.chrome;
  })();
  const $storage = browser.storage.local;

  class EQ8 {
    POPUP_COM_RATE = 20; // in ms
    UNSUPPORTED_HOSTS = ['store.steampowered.com'];

    constructor () {
      // Don't run on specified sites due to CORS restriction causing the browser to silence audioElement
      // TODO Find a way to detect (currently impossible)
      if (this.UNSUPPORTED_HOSTS.includes(location.host)) {
        writeEq8Log('Steam is unsupported because its CDN does not allow proper CORS rules');
        return;
      }
      this.WebAudioContext = (window.AudioContext || window.webkitAudioContext);
      this.DOMMutationObserver = (window.MutationObserver || window.webkitMutationObserver);
      this.pipelines = [];
      this.activePipeline = null;
      this.state = {};
      this.observer = null;
      this.popupPort = null;
      this.popUpSendIntervalId = null;
      this.timeDomainData = new Float32Array();
      this.frequencyData = new Uint8Array();
      this.audioContextSuspended = false;
    }

    async loadState () {
      const items = await $storage.get();
      this.state = items;
      return Object.hasOwn(this.state, 'v');
    }

    async attach () {
      try {
        if (!await this.loadState()) {
          throw Error('store empty');
        }
      } catch (e) {
        console.error('Failed to init storage:', e);
        setTimeout(() => this.attach(), 1000);
        return;
      }
      $storage.onChanged.addListener(async () => {
        await this.loadState();
        this.updatePipelines();
      });
      const domListener = this.throttle(this.onDomMutated.bind(this));
      this.observer = new this.DOMMutationObserver(domListener);
      this.observer.observe(document.body, { childList: true, subtree: true });
      this.setupPopupConnection();
    }

    buildAudioGraph (pipeline) {
      const { context, source, filters, preamp, compressor, postamp, analyser } = pipeline;
      filters.sort((a, b) => b.filter.frequency - a.filter.frequency);
      const enabledFilters = filters.filter(f => f.enabled);
      const eqAndPreampEnabled = this.state.eqEnabled && enabledFilters.length;
      const preampNoEqEnabled = this.state.eqEnabled && !enabledFilters.length;
      if (eqAndPreampEnabled) {
        enabledFilters.forEach((f, ix, arr) => {
          if (ix > 0) enabledFilters[ix - 1].filter.connect(f.filter);
          if (ix === arr.length - 1) f.filter.connect(this.state.compressor.enabled ? compressor : analyser);
        });
        source.connect(preamp).connect(enabledFilters[0].filter);
      }
      if (this.state.compressor.enabled) {
        compressor.connect(postamp).connect(analyser);
        if (!eqAndPreampEnabled && !preampNoEqEnabled) {
          source.connect(compressor);
        } else if (preampNoEqEnabled) { // Eq ON but no filters -> preamp still active
          source.connect(preamp).connect(compressor);
        }
      }
      // only preamp
      if (!this.state.compressor.enabled && preampNoEqEnabled) {
        source.connect(preamp).connect(analyser);
      } else if (!this.state.compressor.enabled && !eqAndPreampEnabled) { // everything off
        source.connect(analyser);
      }
      analyser.connect(context.destination);
    }

    createPipelineForElement (element) {
      const { filters, preampGain } = this.state;
      const context = new this.WebAudioContext();
      if (context.state === 'suspended') {
        this.audioContextSuspended = true;
        writeEq8Log('browser autoplay prevention -> audioContext suspended');
      }
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
      const preamp = new GainNode(context, { gain: this.multiplierFromGain(preampGain) });
      const compressor = context.createDynamicsCompressor();
      this.updateCompressorNode(context, compressor);
      const postamp = new GainNode(context, { gain: this.multiplierFromGain(this.state.compressor.gain) });
      const analyser = new AnalyserNode(context, { fftSize: 16384, smoothingTimeConstant: 0.8, minDecibels: -90, maxDecibels: -10 });
      this.timeDomainData = new Float32Array(analyser.frequencyBinCount);
      this.frequencyData = new Uint8Array(analyser.frequencyBinCount);
      const pipeline = { context, source, filters: elFilters, preamp, compressor, postamp, analyser, element };
      this.pipelines.push(pipeline);
    }

    updatePipelines () {
      this.pipelines.forEach((pipeline) => {
        const { context, source, filters, preamp, compressor, postamp, analyser } = pipeline;
        if (context.state === 'suspended') {
          try {
            context.resume().then(() => {
              writeEq8Log('AudioContext resumed successfully');
              this.audioContextSuspended = false;
              this.updatePipelines();
            });
          } catch (e) {
          }
        }

        this.state.filters.forEach(f => {
          const entry = filters.find(i => i.id === f.id);
          const filter = entry.filter;
          filter.frequency.value = f.frequency;
          filter.type = f.type;
          filter.Q.value = f.q;
          filter.gain.value = f.gain;
          entry.enabled = f.enabled;
        });
        preamp.gain.value = this.multiplierFromGain(this.state.preampGain);
        this.updateCompressorNode(context, compressor);
        postamp.gain.value = this.multiplierFromGain(this.state.compressor.gain);
        source.disconnect();
        preamp.disconnect();
        filters.forEach(f => f.filter.disconnect());
        compressor.disconnect();
        postamp.disconnect();
        analyser.disconnect();
        this.buildAudioGraph(pipeline);
      });
    }

    updateCompressorNode (context, compNode) {
      compNode.threshold.setValueAtTime(this.state.compressor.threshold, context.currentTime);
      compNode.ratio.setValueAtTime(this.state.compressor.ratio, context.currentTime);
      compNode.attack.setValueAtTime(this.state.compressor.attack, context.currentTime);
      compNode.release.setValueAtTime(this.state.compressor.release, context.currentTime);
      compNode.knee.setValueAtTime(this.state.compressor.knee, context.currentTime);
    }

    onDomMutated () {
      writeEq8Log('[eq8Comp]: onDomMutated');
      const mediaElements = ([...document.body.querySelectorAll('video')])
        .concat([...document.body.querySelectorAll('audio')]);

      let newPipeline = false;
      mediaElements
        .filter(el => !el.eq8Comp)
        .forEach(el => {
          writeEq8Log('[eq8Comp]: new audio source discovered');
          newPipeline = el.eq8Comp = true;
          el.setAttribute('crossorigin', '');
          this.createPipelineForElement(el);
        });

      for (let i = this.pipelines.size; i > 0; i--) {
        if (!mediaElements.includes(this.pipelines[i].element)) {
          writeEq8Log('[eq8Comp]: media element removed');
          this.pipelines.splice(i, 1);
        }
      }
      if (newPipeline || this.audioContextSuspended) this.updatePipelines();
    }

    multiplierFromGain (valueInDb) {
      return Math.pow(10, valueInDb / 20);
    }

    setupPopupConnection () {
      browser.runtime.onConnect.addListener(port => {
        if (port.name === 'popup') {
          writeEq8Log('popup connected');
          port.onDisconnect.addListener(() => {
            writeEq8Log('popup closed');
            this.popupPort = null;
            this.popUpSendIntervalId && clearInterval(this.popUpSendIntervalId);
            this.popUpSendIntervalId = null;
          });
          this.popupPort = port;
          this.sendPopupDataIfNeeded();
        }
      });
    }

    sendPopupDataIfNeeded () {
      if (!this.popupPort) return;
      if (!this.pipelines.length) return;
      if (this.pipelines.length === 1) this.activePipeline = this.pipelines[0];

      // TODO find the correct playing pipeline
      this.activePipeline = this.pipelines.length && this.pipelines[0];
      this.popUpSendIntervalId = setInterval(this.doSendPopupData.bind(this), this.POPUP_COM_RATE);
    }

    doSendPopupData () {
      this.activePipeline.analyser.getFloatTimeDomainData(this.timeDomainData);
      this.activePipeline.analyser.getByteFrequencyData(this.frequencyData);
      this.popupPort && this.activePipeline &&
        this.popupPort.postMessage({
          gainReduction: this.state.compressor.enabled ? this.activePipeline.compressor.reduction : 0.0,
          timeDomainData: Array.apply([], this.timeDomainData),
          frequencyData: Array.apply([], this.frequencyData)
        });
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
  }

  const eq8 = new EQ8();
  eq8.attach();
})();
