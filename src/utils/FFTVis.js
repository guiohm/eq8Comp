class FFTVis {
  constructor (sampleRate, fftSize, canvas) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.multiplier = canvas.height / 255;
    this.frequencyGroups = [{ hz: 32, w: 110 }, { hz: 64, w: 204 }, { hz: 125, w: 297 }, { hz: 250, w: 390 }, { hz: 500, w: 482 }, { hz: 1000, w: 574 }, { hz: 2000, w: 667 }, { hz: 4000, w: 760 }, { hz: 8000, w: 851 }, { hz: 16000, w: 944 }, { hz: Math.floor(sampleRate / 2), w: 1000 }];
  }

  draw (frequencyData) {
    let x = 0; let previousWidth = 0; let previousWidthHz = 0; let previousIndex = null;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = 'green';

    for (let i = 0; i < this.frequencyGroups.length; i++) {
      const width = this.frequencyGroups[i].w; const widthHz = this.frequencyGroups[i].hz;

      for (x; x <= width; x++) {
        const hz = this.getFrequencyForWidth(x, width, previousWidth, widthHz, previousWidthHz);
        const index = this.getIndexForFrequency(hz, this.fftSize, this.sampleRate);

        let value = frequencyData[index];
        if (previousIndex) {
          const max = Math.max.apply(Math, frequencyData.slice(previousIndex, index));
          if (Math.abs(max) !== Infinity) value = max;
        }

        this.ctx.fillRect(x, this.canvas.height - (value * this.multiplier), 1, this.canvas.height);
        previousIndex = index;
      }

      previousWidth = width;
      previousWidthHz = widthHz;
    }
  }

  getIndexForFrequency (frequency, fftSize, sampleRate) {
    return Math.round(frequency * ((fftSize / 2) / (sampleRate / 2)));
  }

  getFrequencyForWidth (width, finalWidth, previousWidth, finalHz, previousHz) {
    return (this.getPercentage(width, finalWidth, previousWidth) * (finalHz - previousHz)) + previousHz;
  }

  getPercentage (value, max, min) {
    // If statement for min_dB && max_dB;
    if (max <= 0 && min < 0) return ((value / (min - max)) - (max / (min - max)));
    else return (value / (max - min)) - (min / (max - min));
  }
}

export default FFTVis;
