module.exports = {
  css: {
    modules: true
  },
  outputDir: 'extension/popup',
  indexPath: 'popup.html',
  productionSourceMap: false,
  publicPath: '',
  configureWebpack: {
    devtool: false
  }
};
