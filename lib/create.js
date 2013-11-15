module.exports = function create(proto, obj) {
  return Object.keys(obj).reduce(function (acc, key) {
    return (acc[key] = obj[key], acc)
  }, Object.create(proto))
}
