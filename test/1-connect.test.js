const test = require('tap').test
const mysql = require('..')

const env = process.env;

test('connecting to a host', function (t) {
  const db = mysql.connect({
    host: env.HOST || 'localhost',
    user: env.USER || 'root',
  }, function (err) {
    t.notOk(err, 'no errors connecting')

    db.close(function (err) {
      t.notOk(err, 'no errors closing')
      t.end()
    })
  })
})
