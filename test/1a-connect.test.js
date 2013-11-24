const test = require('tap').test
const base = require('..')

const env = process.env;

test('connecting to a host', function (t) {
  const db = base.connect({
    driver: 'sqlite',
    database: ':memory:',
  }, function (err) {
    t.notOk(err, 'no errors connecting')
    if (err) { return t.end() }

    db.close(function (err) {
      t.notOk(err, 'no errors closing')
      t.end()
    })
  })
})
