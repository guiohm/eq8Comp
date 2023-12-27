const browser = (function () {
  return chrome || browser;
})();
// Opera may not support sync
const $storage = browser.storage.sync || browser.storage.local;

const defaultCompressor = {
  enabled: true,
  threshold: -40.0,
  ratio: 8.0,
  attack: 0.003,
  release: 0.15,
  knee: 30,
  gain: 0.0
};

const defaultFilters = [
  {
    id: 1,
    frequency: 46,
    gain: 0.0,
    q: 0.0,
    type: 'lowshelf',
    enabled: true
  },
  {
    id: 2,
    frequency: 215,
    gain: 0.0,
    q: 1.0,
    type: 'peaking',
    enabled: true
  },
  {
    id: 3,
    frequency: 1000,
    gain: 0.0,
    q: 1.0,
    type: 'peaking',
    enabled: true
  },
  {
    id: 4,
    frequency: 4642,
    gain: 0.0,
    q: 1.0,
    type: 'peaking',
    enabled: true
  },
  {
    id: 5,
    frequency: 711,
    gain: 0.0,
    q: 1.0,
    type: 'peaking',
    enabled: false
  },
  {
    id: 6,
    frequency: 1668,
    gain: 0.0,
    q: 1.0,
    type: 'peaking',
    enabled: false
  },
  {
    id: 7,
    frequency: 3914,
    gain: 0.0,
    q: 1.0,
    type: 'peaking',
    enabled: false
  },
  {
    id: 8,
    frequency: 9182,
    gain: 0.0,
    q: 1.0,
    type: 'highshelf',
    enabled: false
  }
];

const copyHack = obj => JSON.parse(JSON.stringify(obj));

const defaultState = {
  v: 1,
  eqEnabled: true,
  compressor: copyHack(defaultCompressor),
  filters: copyHack(defaultFilters),
  preampGain: 0.0,
  settings: {
    sensitivity: 1024
  },
  presets: {
    'd9c9ad7c-4ba6-4a7d-9f37-2e476fdfafba': {
      name: 'Default',
      locked: true,
      image: null,
      icon: 'audiotrack',
      compressor: copyHack(defaultCompressor),
      filters: copyHack(defaultFilters),
      preampGain: 0.0
    }
  }
};

const iconSizes = [16, 32, 48, 96, 128];
const { icons, iconsSelected } = iconSizes.reduce((a, c) => {
  a.icons[String(c)] = `../icons/icon-${c}.png`;
  a.iconsSelected[String(c)] = `../icons/icon-${c}-selected.png`;
  return a;
}, { icons: {}, iconsSelected: {} });

// const onError = (error) => console.error(`Error: ${error}`);
const isCachedStateEmpty = () => !Object.hasOwn(state, 'v');

const state = {};
const initStorageCache = $storage.get().then((items) => {
  Object.assign(state, items);
  if (isCachedStateEmpty()) Object.assign(state, defaultState) && $storage.set(state);
  updateIcon();
});

const updateIcon = () => browser.action.setIcon({ path: state.compressor.enabled || state.eqEnabled ? iconsSelected : icons });

$storage.onChanged.addListener(async () => {
  Object.assign(state, await $storage.get());
});

browser.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  try {
    // handle waiting when script wake up on event
    console.debug('msg', msg);
    if (isCachedStateEmpty()) await initStorageCache;
  } catch (e) {
    console.error('Failed to init storage:', e);
  }

  switch (msg.type) {
  case 'SET::COMP_ENABLED':
    state.compressor.enabled = msg.enabled;
    updateIcon();
    $storage.set(state);
    break;
  case 'SET::EQ_ENABLED':
    state.eqEnabled = msg.enabled;
    updateIcon();
    $storage.set(state);
    break;
  case 'RESET::FILTERS':
    state.filters = copyHack(defaultFilters);
    state.preampGain = 0.0;
    $storage.set(state);
    break;
  case 'LOAD::PRESET':
    const pre = state.presets[msg.id];
    state.compressor = copyHack(pre.compressor);
    state.filters = copyHack(pre.filters);
    state.preampGain = pre.preampGain;
    $storage.set(state);
    break;
  default:
    console.error('Unrecognized message: ' + msg);
    break;
  }
});
