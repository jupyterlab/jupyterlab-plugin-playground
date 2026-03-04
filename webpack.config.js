module.exports = {
  module: {
    noParse: [require.resolve('typescript/lib/typescript.js')]
  },
  resolve: {
    fallback: {
      module: false,
      perf_hooks: false
    }
  }
};
