<template>
  <div id="app">
    <div class="row">
      <div class="col align-center section">
        <div class="col align-center dial-wrapper">
          <div class="dial-label">Freq</div>
          <Dial
            :size="dialSize"
            :value="freqValue"
            :min="0"
            :max="1"
            :disabled="freqDisabled"
            :wheel-sensitivity="settings.sensitivity"
            @change="freqDialHandler"
          />
          <NumberEditLabel
            :value="fixedFrequency"
            :label="freqLabel"
            :min="10"
            :max="nyquist"
            :disabled="freqDisabled"
            @change="freqInputHandler"
          />
        </div>
        <div class="col align-center dial-wrapper">
          <div class="dial-label">Gain</div>
          <div
            @click="gainDisabled ? $noOp : gainDialHandler(0)"
            class="zeroer"
            :class="{disabled: gainDisabled}"
          >
            <i class="eq8 arrow_drop_down zeroer"></i>
          </div>
          <Dial
            :size="dialSize"
            :value="gainValue"
            :min="-20"
            :max="20"
            :disabled="gainDisabled"
            :wheel-sensitivity="settings.sensitivity"
            @change="gainDialHandler"
          />
          <NumberEditLabel
            :value="gainValue"
            :label="toFixed(gainValue) + ' dB'"
            :min="-20"
            :max="20"
            :disabled="gainDisabled"
            @change="gainDialHandler"
          />
        </div>
        <div class="col align-center dial-wrapper">
          <div class="dial-label">Q</div>
          <Dial
            :size="dialSize"
            :value="qValue"
            :min="0"
            :max="10"
            :disabled="qDisabled"
            :wheel-sensitivity="settings.sensitivity"
            @change="qDialHandler"
          />
          <NumberEditLabel
            :value="qValue"
            :label="toFixed(qValue)"
            :min="0"
            :max="10"
            :disabled="qDisabled"
            @change="qDialHandler"
          />
        </div>
      </div>
      <div class="col">
        <FrequencyResponsePlot
          :disabled="!eqEnabled"
          :filters="frFilters"
          :context="frAudioContext"
          :freq-start="freqStart"
          :active-node="selectedFilter ? selectedFilter.id : null"
          :wheel-sensitivity="settings.sensitivity"
          @handle-selected="handleSelected"
          @filter-changed="frFilterChanged"
        />
        <div class="grow row">
          <div
            class="section grow col align-center justify-center"
            v-for="f in frFilters"
            :key="f.id"
            :class="{ selected: selectedFilter && f.id === selectedFilter.id, selectable: eqEnabled && f.enabled }"
            @click="selectFilter(f)"
          >
            <Choose
              :options="filterOptions"
              :selected="filterTypeForFilter(f)"
              :disabled="!eqEnabled"
              direction="up"
              @change="changeFilterType(f, ...arguments)"
            />
            <div class="grow row align-center justify-end">
              <Checkbox
                class="filter-enable-checkbox"
                :value="f.enabled"
                :disabled="!eqEnabled"
                @input="toggleFilterEnabled(f)"
              /><span class="no-select">{{ f.id }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="col section justify-space-between">
        <div class="col align-center mb3">
          <div class="master-enable" @click="toggleMasterEnabled" title="Enable/Disable">
            <i class="eq8 power_settings_new" :class="{ enabled: eqEnabled }"></i>
          </div>
        </div>
        <div class="col justify-center align-center">
          <i class="eq8 save settings-btn" title="Save As Preset" @click="savePresetOpen = true"></i>
        </div>
        <div class="col justify-center align-center">
          <i class="eq8 tune settings-btn" title="Presets" @click="presetsOpen = true"></i>
        </div>
        <div class="col justify-center align-center">
          <i class="eq8 refresh settings-btn" title="Reset" @click="handleReset"></i>
        </div>
        <div class="col justify-center align-center">
          <i class="eq8 settings settings-btn" title="Options" @click="settingsOpen = true"></i>
        </div>
        <div class="col align-center my2">
          <div class="dial-label">Preamp</div>
          <div
            @click="!eqEnabled ? $noOp : preampDialHandler(0.0)"
            class="zeroer"
            :class="{disabled: !eqEnabled}"
            title="Click to reset"
          >
            <i class="eq8 arrow_drop_down zeroer"></i>
          </div>
          <Dial
            :size="dialSize"
            :value="preampGain"
            :min="-20"
            :max="20"
            :disabled="!eqEnabled"
            :wheel-sensitivity="settings.sensitivity"
            @change="preampDialHandler"
          />
          <NumberEditLabel
            :value="preampGain"
            :label="toFixed(preampGain) + ' dB'"
            :min="-20"
            :max="20"
            :disabled="!eqEnabled"
            @change="preampDialHandler"
          />
        </div>
      </div>
    </div>
    <div class="row justify-right">
      <div class="col">
        <div class="col align-center">
          <div class="meter">
            <canvas class="canvas-grid"></canvas>
            <canvas class="canvas-meter"></canvas>
          </div>
        </div>
      </div>
      <div class="col">
        <div class="col align-center">
          <div class="meter">
            <canvas class="canvas-grid"></canvas>
            <div class="reductionBar"></div>
          </div>
        </div>
      </div>
      <div class="col">
        <div class="section grow row" style="margin-right: 6px;">
          <div class="col align-center dial-wrapper dial-section">
            <div class="dial-label mt2">Threshold</div>
            <Dial
              :size="dialSize"
              :value="compressor.threshold"
              :min="-100"
              :max="0"
              :disabled="!compEnabled"
              :wheel-sensitivity="settings.sensitivity"
              @change="thresholdDialHandler"
            />
            <NumberEditLabel
              :value="compressor.threshold"
              :label="toFixed(compressor.threshold || 0) + ' dB'"
              :min="-100"
              :max="0"
              :disabled="!compEnabled"
              @change="thresholdDialHandler"
            />
          </div>
          <div class="col align-center dial-wrapper dial-section">
            <div class="dial-label mt2">Ratio</div>
            <Dial
              :size="dialSize"
              :value="compressor.ratio"
              :min="1"
              :max="20"
              :disabled="!compEnabled"
              :wheel-sensitivity="settings.sensitivity"
              @change="ratioDialHandler"
            />
            <NumberEditLabel
              :value="compressor.ratio"
              :label="toFixed(compressor.ratio || 0) + ':1'"
              :min="1"
              :max="20"
              :disabled="!compEnabled"
              @change="ratioDialHandler"
            />
          </div>
          <div class="col align-center dial-wrapper dial-section">
            <div class="dial-label mt2">Attack</div>
            <Dial
              :size="dialSize"
              :value="compressor.attack"
              :min="0"
              :max="1"
              :disabled="!compEnabled"
              :wheel-sensitivity="settings.sensitivity"
              @change="attackDialHandler"
            />
            <NumberEditLabel
              :value="compressor.attack"
              :label="toFixed(compressor.attack || 0) + ' s'"
              :min="0"
              :max="1"
              :disabled="!compEnabled"
              @change="attackDialHandler"
            />
          </div>
          <div class="col align-center dial-wrapper dial-section">
            <div class="dial-label mt2">Release</div>
            <Dial
              :size="dialSize"
              :value="compressor.release"
              :min="0.01"
              :max="1"
              :disabled="!compEnabled"
              :wheel-sensitivity="settings.sensitivity"
              @change="releaseDialHandler"
            />
            <NumberEditLabel
              :value="compressor.release"
              :label="toFixed(compressor.release || 0) + ' s'"
              :min="0.01"
              :max="1"
              :disabled="!compEnabled"
              @change="releaseDialHandler"
            />
          </div>
          <div class="col align-center dial-wrapper dial-section">
            <div class="dial-label">Gain</div>
              <div
                @click="!eqEnabled ? $noOp : compGainDialHandler(0.0)"
                class="zeroer"
                :class="{disabled: !compEnabled}"
                title="Click to reset"
              >
                <i class="eq8 arrow_drop_down zeroer"></i>
              </div>
            <Dial
              :size="dialSize"
              :value="compressor.gain"
              :min="-20"
              :max="20"
              :disabled="!compEnabled"
              :wheel-sensitivity="settings.sensitivity"
              @change="compGainDialHandler"
            />
            <NumberEditLabel
              :value="compressor.gain"
              :label="toFixed(compressor.gain || 0) + ' dB'"
              :min="-20"
              :max="20"
              :disabled="!compEnabled"
              @change="compGainDialHandler"
            />
          </div>
          <div class="col align-center justify-center">
            <div class="master-enable" @click="toggleCompressorEnabled" title="Enable/Disable">
              <i class="eq8 power_settings_new" :class="{ enabled: compEnabled }"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
    <SettingsModal v-if="settingsOpen" @close="settingsOpen = false" v-model="settingsValue" />
    <PresetsModal v-if="presetsOpen" @close="presetsOpen = false" v-model="presetsValue" @delete="deletePreset" @load="loadPreset" />
    <SavePresetModal v-if="savePresetOpen" @close="savePresetOpen = false" :img="presetImage" @save="savePreset" />
  </div>
</template>

<script>
import Checkbox from './components/Checkbox';
import Choose from './components/Choose';
import Dial from './components/Dial';
import FrequencyResponsePlot from './components/FrequencyResponsePlot';
import NumberEditLabel from './components/NumberEditLabel';
import PresetsModal from './components/PresetsModal';
import SavePresetModal from './components/SavePresetModal';
import SettingsModal from './components/SettingsModal';
import colors from './styles/_colors.scss';
import VUMeter from './utils/VUMeter';

const WebAudioContext = (window.AudioContext || window.webkitAudioContext);

const opts = [
  { iconClass: ['eq8', 'highpass'], value: 'highpass', title: 'High Pass', qEnabled: false, gainEnabled: false },
  { iconClass: ['eq8', 'lowshelf'], value: 'lowshelf', title: 'Low Shelf', qEnabled: false, gainEnabled: true },
  { iconClass: ['eq8', 'peaking'], value: 'peaking', title: 'Peaking', qEnabled: true, gainEnabled: true },
  { iconClass: ['eq8', 'notch'], value: 'notch', title: 'Notch', qEnabled: true, gainEnabled: false },
  { iconClass: ['eq8', 'highshelf'], value: 'highshelf', title: 'High Shelf', qEnabled: false, gainEnabled: true },
  { iconClass: ['eq8', 'lowpass'], value: 'lowpass', title: 'Low Pass', qEnabled: false, gainEnabled: false }
];

let compressorVisualizerStarted = false;
let gainReductionLevel = 0.0;
let timeDomainData = new Float32Array();

export default {
  name: 'app',
  components: {
    FrequencyResponsePlot,
    Dial,
    Choose,
    NumberEditLabel,
    Checkbox,
    SavePresetModal,
    SettingsModal,
    PresetsModal
  },
  data () {
    return {
      eqEnabled: true,
      compEnabled: true,
      dialSize: 55,
      filterOptions: opts,
      freqStart: 10.0,
      preampGain: 1.0,
      selectedFilter: null,
      frAudioContext: new WebAudioContext(),
      compressor: {},
      frFilters: [],
      settings: {},
      presets: {},
      presetImage: null,
      settingsOpen: false,
      presetsOpen: false,
      savePresetOpen: false
    };
  },
  created () {
    this.$bus.$on('fr-snapshot', snapshot => this.presetImage = snapshot);
    this.$runtime.onMessage.addListener(msg => {
      if (msg.type === 'SET::STATE') this.stateUpdateHandler(msg.state);
      return false;
    });
    this.$runtime.sendMessage({ type: 'GET::STATE' })
      .then(msg => this.stateUpdateHandler(msg.state))
      .then(() => this.selectedFilter = this.frFilters[0]);
  },
  methods: {
    stateUpdateHandler ({ compressor, filters, eqEnabled, preampGain, settings, presets }) {
      this.compressor = compressor;
      this.compEnabled = compressor.enabled;
      this.frFilters = this.$arrayCopy(filters);
      this.eqEnabled = eqEnabled;
      this.preampGain = preampGain;
      this.settings = this.$arrayCopy(settings);
      this.presets = presets;
      if (this.selectedFilter) {
        this.selectedFilter = this.frFilters.find(f => f.id === this.selectedFilter.id && f.enabled);
      }
      !compressorVisualizerStarted && this.conpressorVisualizer();
    },
    gainDialHandler (value) {
      const newFilter = Object.assign(this.selectedFilter, { gain: value });
      this.$runtime.sendMessage({ type: 'SET::FILTER', filter: newFilter });
    },
    preampDialHandler (value) {
      this.$runtime.sendMessage({ type: 'SET::PREAMP', preampGain: value });
    },
    qDialHandler (value) {
      this.$runtime.sendMessage({ type: 'SET::FILTER', filter: Object.assign(this.selectedFilter, { q: value }) });
    },
    freqDialHandler (value) {
      const o = Math.log10(this.nyquist / this.freqStart);
      const f = this.nyquist * Math.pow(10, o * (value - 1));
      this.$runtime.sendMessage({ type: 'SET::FILTER', filter: Object.assign(this.selectedFilter, { frequency: f }) });
    },
    thresholdDialHandler (value) {
      this.$runtime.sendMessage({ type: 'SET::COMPRESSOR', compressor: Object.assign(this.compressor, { threshold: value }) });
    },
    ratioDialHandler (value) {
      this.$runtime.sendMessage({ type: 'SET::COMPRESSOR', compressor: Object.assign(this.compressor, { ratio: value }) });
    },
    attackDialHandler (value) {
      this.$runtime.sendMessage({ type: 'SET::COMPRESSOR', compressor: Object.assign(this.compressor, { attack: value }) });
    },
    releaseDialHandler (value) {
      this.$runtime.sendMessage({ type: 'SET::COMPRESSOR', compressor: Object.assign(this.compressor, { release: value }) });
    },
    compGainDialHandler (value) {
      this.$runtime.sendMessage({ type: 'SET::COMPRESSOR', compressor: Object.assign(this.compressor, { gain: value }) });
    },
    changeFilterType (filter, option) {
      const q = option.value.endsWith('pass') ? 0.0 : 1.0;
      const gain = 0.0;
      this.$runtime.sendMessage({ type: 'SET::FILTER', filter: Object.assign(filter, { type: option.value, q, gain }) });
    },
    freqInputHandler (value) {
      this.$runtime.sendMessage({ type: 'SET::FILTER', filter: Object.assign(this.selectedFilter, { frequency: value }) });
    },
    toFixed (value) {
      return value.toFixed(2);
    },
    frequencyToValue (value) {
      return (Math.log10(value / this.nyquist) / Math.log10(this.nyquist / this.freqStart)) + 1;
    },
    handleSelected (id) {
      const sel = this.frFilters.find(f => f.id === id);
      if (sel) {
        this.selectedFilter = sel;
      }
    },
    filterTypeForFilter (filter) {
      return filter ? this.filterOptions.find(o => o.value === filter.type) : {};
    },
    selectFilter (filter) {
      if (this.eqEnabled && filter.enabled) {
        this.selectedFilter = filter;
      }
    },
    toggleFilterEnabled (filter) {
      this.$runtime.sendMessage({ type: 'SET::FILTER', filter: Object.assign(filter, { enabled: !filter.enabled }) });
    },
    frFilterChanged (change) {
      const filter = this.frFilters.find(f => f.id === change.id);
      if (filter) {
        delete change.id;
        this.$runtime.sendMessage({ type: 'SET::FILTER', filter: Object.assign(filter, change) });
      }
    },
    toggleMasterEnabled () {
      this.$runtime.sendMessage({ type: 'SET::EQ_ENABLED', enabled: !this.eqEnabled });
    },
    toggleCompressorEnabled () {
      this.$runtime.sendMessage({ type: 'SET::COMP_ENABLED', enabled: !this.compEnabled });
    },
    conpressorVisualizer () {
      compressorVisualizerStarted = true;
      const meter = document.querySelector('.meter');
      this.reductionBar = document.querySelector('.reductionBar');
      const canvas = document.querySelector('.canvas-grid');
      const canvas2 = document.querySelectorAll('.canvas-grid')[1];
      const grGridCtx = canvas2.getContext('2d');
      const VUGridCtx = canvas.getContext('2d');

      canvas.width = canvas2.width = meter.offsetWidth;
      canvas.height = canvas2.height = meter.offsetHeight;

      function drawGrid (canvasCtx, dbScale, interval) {
        canvasCtx.font = '8px sans-serif';
        for (let db = dbScale + interval; db < 0; db += interval) {
          const dbToY = (canvas.height / dbScale) * db;
          const y = Math.floor(dbToY) + 0.5; // adjustment for crisp lines
          canvasCtx.strokeStyle = colors.graphLine;
          canvasCtx.beginPath();
          canvasCtx.moveTo(0, y);
          canvasCtx.lineTo(canvas.width, y);
          canvasCtx.stroke();
          canvasCtx.strokeStyle = colors.graphText;
          canvasCtx.strokeText(db.toFixed(0), 4.5, y + 0.5);
        }
      }

      drawGrid(grGridCtx, -25, 5);
      drawGrid(VUGridCtx, -60, 10);

      this.VUMeter = new VUMeter('.canvas-meter', -60, 5);

      function onError (error) {
        console.debug(`Error: ${error}`);
      }

      let gettingActive = chrome.tabs.query({
        audible: true,
        muted: false
      });
      gettingActive.then(tabs => {
        console.debug('tabs:', tabs);
        if (!tabs.length) {
          // TODO poll for audible tab
          return;
        }
        const grPort = chrome.tabs.connect(tabs[0].id, { name: 'popup' });
        grPort.onMessage.addListener(data => {
          timeDomainData = new Float32Array(data.timeDomainData);
          gainReductionLevel = data.gainReduction;
          requestAnimationFrame(this.updateReductionLevel);
          return false;
        });
      }, onError);
    },
    updateReductionLevel () {
      if (!this.compEnabled) {
        this.reductionBar.style.height = '0px';
        return;
      }
      this.reductionBar.style.height = gainReductionLevel * -6 + 'px';
      this.VUMeter.draw(timeDomainData);
    },
    handleReset () {
      this.$runtime.sendMessage({ type: 'RESET::FILTERS' });
    },
    savePreset (presetMeta) {
      const preset = {
        name: presetMeta.name,
        icon: presetMeta.icon,
        image: this.presetImage,
        compressor: this.compressor,
        filters: this.frFilters,
        preampGain: this.preampGain
      };
      this.$runtime.sendMessage({ type: 'SAVE::PRESET', preset });
      this.savePresetOpen = false;
    },
    loadPreset (presetId) {
      this.$runtime.sendMessage({ type: 'LOAD::PRESET', id: presetId });
      this.presetsOpen = false;
    },
    deletePreset (presetId) {
      this.$runtime.sendMessage({ type: 'DELETE::PRESET', id: presetId });
    }
  },
  computed: {
    nyquist () {
      return this.frAudioContext.sampleRate * 0.5;
    },
    fixedFrequency () {
      return this.selectedFilter ? this.selectedFilter.frequency : this.freqStart;
    },
    freqLabel () {
      const f = this.fixedFrequency;
      return f >= 1000 ? `${(f / 1000).toFixed(2)} kHz` : `${f.toFixed(2)} Hz`;
    },
    freqDisabled () {
      return !this.eqEnabled;
    },
    gainDisabled () {
      return !this.eqEnabled || !this.filterTypeForFilter(this.selectedFilter).gainEnabled;
    },
    qDisabled () {
      return !this.eqEnabled || !this.filterTypeForFilter(this.selectedFilter).qEnabled;
    },
    gainValue () {
      return this.selectedFilter ? this.selectedFilter.gain : 0;
    },
    qValue () {
      return this.selectedFilter ? this.selectedFilter.q : 1.0;
    },
    freqValue () {
      return this.frequencyToValue(this.selectedFilter ? this.selectedFilter.frequency : this.freqStart);
    },
    presetsValue: {
      get () { return this.presets; },
      set (nv) { console.log('here'); this.$runtime.sendMessage({ type: 'SET::PRESETS', presets: nv }); }
    },
    settingsValue: {
      get () { return this.settings; },
      set (nv) { console.log(nv); this.$runtime.sendMessage({ type: 'SET::SETTINGS', settings: nv }); }
    }
  },
  watch: {
    savePresetOpen (nv) {
      if (!nv) {
        this.presetImage = null;
      } else {
        this.$bus.$emit('request-fr-snapshot');
      }
    }
  }
};
</script>

<style lang="scss">
@import './styles/base';
@import './styles/fonts';
@import './styles/modal';

* { box-sizing: border-box; }

body {
  padding: 0;
  margin: 0;
  font-family: 'Open Sans', sans-serif;
  background-color: $background;
  color: #fefefe;
  overflow-x: auto;
}

button {
  background-color: black;
  color: white;
  padding: 0.5em 2em;
  border: none;
  border-radius: 4px;
  @include standard-shadow;

  &:not(:disabled):hover {
    cursor: pointer;
    background-color: #111;
    @include hover-shadow;
  }

  &:disabled {
    background-color: #666;
  }

  &.small {
    padding: 0.35em 1.5em;
    font-size: 0.9em;
  }
}

$_justify_values: flex-start, flex-end, start, end, left, right, center, space-between, space-around, space-evenly;
@each $v in $_justify_values {
  .justify-#{$v} {
    justify-content: #{$v};
  }
}

$_align_values: stretch, flex-start, start, self-start, flex-end, end, self-end, center, baseline;
@each $v in $_align_values {
  .align-#{$v} {
    align-items: #{$v};
  }
}

.justify-right {
  justify-content: right;
}

$_spacer_types: margin, padding;
$_spacer_values: 4, 8, 16, 32;
$_spacer_dirs: top, right, bottom, left;
@each $t in $_spacer_types {
  @each $v in $_spacer_values {
    $ix: index($_spacer_values, $v);
    $f: str_slice($t, 0, 1);
    .#{$f}#{$ix} {
      #{$t}: #{$v}px;
    }
    @each $d in $_spacer_dirs {
      $s: str_slice($d, 0, 1);
      .#{$f}#{$s}#{$ix} {
        #{$t}-#{$d}: #{$v}px;
      }
    }
    .#{$f}x#{$ix} {
      #{$t}-left: #{$v}px;
      #{$t}-right: #{$v}px;
    }
    .#{$f}y#{$ix} {
      #{$t}-top: #{$v}px;
      #{$t}-bottom: #{$v}px;
    }
  }
}

.col, .row { display: flex; }
.col { flex-direction: column; }
.row { flex-direction: row; }
.grow { flex: 1; }

#app {
  font-size: 12px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin: 4px;
  min-width: 750px;
}

.dial-wrapper {
  margin: 6px 0;
}

.dial-label {
  @include no-select;
}

.section {
  background: $section-color;
  border-radius: 4px;
  padding: 6px;
  margin: 2px;
  transition: background-color $bezier-transition;

  &.selectable:not(.selected):hover {
    background: lighten($section-color, 5%);
  }

  &.selected {
    background: $selected-section-color;
  }
}

.dial-section {
  min-width: 75px;
}

.zeroer {
  margin: -0.5em 0;
  cursor: pointer;

  &.disabled i {
    color: $disabled-color;
  }

  i {
    font-size: 1.5em;
    color: $accent-color;
  }
}

.filter-enable-checkbox {
  margin-right: 0.75em;
}

.master-enable {
  cursor: pointer;

  &:hover {
    .eq8 {
      color: white;
    }
  }

  .eq8 {
    font-size: 32px;
    margin: 8px;
    color: $disabled-color;
    transition: color $bezier-transition;

    &.enabled {
      color: $accent-color;
    }
  }
}

.settings-btn {
  cursor: pointer;
  font-size: 20px;
  margin: 8px;
  transition: color $bezier-transition;

  &:hover {
    color: $accent-color;
  }
}

.no-select {
  @include no-select;
}

#compressor-visualization {
  width: 20px;
  height: 120px;
  background-color: $fr-background;
  border: 1px solid black;
  border-radius: 3px;
  margin: auto 2px;
  position: relative;
  display: block;
  overflow: hidden;
}

#compressor-visualization div {
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
}

#compressor-visualization .output {
  background-color: #9f311b;
}

.meter {
  position: relative;
  width: 30px;
  height: 128px;
  background-color: $fr-background;
  border: 1px solid black;
  border-radius: 3px;
  margin: auto 2px;
  position: relative;
  display: block;
  overflow: hidden;
}

.reductionBar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  opacity: 0.5;
  background-color: #d32b0a;
}

.canvas-meter {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  border-radius: 5px;
}

.canvas-grid {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  border-radius: 5px;
}
</style>
