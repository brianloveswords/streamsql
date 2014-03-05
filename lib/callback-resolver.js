module.exports = function callbackResolver(callback, self) {
  return {
    resolve: function (value) { callback(null, value) },
    reject: function (error) { callback(error) },
    callback: callback,
    promise: self
  }
}
