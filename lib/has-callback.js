module.exports = function hasCallback(args) {
  return typeof args[args.length -1] == 'function'
}
