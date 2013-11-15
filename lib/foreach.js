module.exports = function forEach(obj, fn) {
  Object.keys(obj).forEach(function (key) {
    return fn(key, obj[key])
  })
}
