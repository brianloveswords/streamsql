const env = process.env;
const mysql = require('..')
const fs = require('fs')
const path = require('path')

if (process.env['NODE_ENV'] == 'travis')
  env.USER = 'travis'

module.exports = testDb

function testDb(t, sql, callback) {
  if (typeof sql == 'function')
    callback = sql, sql = []

  const db = mysql.connect({
    host: env.HOST || 'localhost',
    user: env.USER || 'root',
    password: env.PASSWORD || '',
    database: 'test_mysql_stream_db',
    multipleStatements: true,
  }, function (err) {
    if (err) throw err

    var waiting = sql.length
    if (!sql.length)
      return resume()

    sql.map(read).forEach(makeQuery)

    function makeQuery(statement) {
      return db.query(statement, resume)
    }

    function resume(err, result) {
      if (err) throw err
      if (--waiting > 0) return
      return callback(db, done)
    }
  })

  t._end = t.end
  t.end = function () {
    t._end()
    db.close()
  }

  function done() {
    db.close()
  }
}


function read(name) {
  return fs.readFileSync(path.join(__dirname, 'sql', name + '.sql')).toString('utf8')
}
