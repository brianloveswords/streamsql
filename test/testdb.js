const env = process.env;
const mysql = require('..')

module.exports = function useDb(t, callback) {
  const db = mysql.connect({
    host: env.HOST || 'localhost',
    user: env.USER || 'root',
    password: env.PASSWORD || '',
    database: 'test_mysql_stream_db'
  }, function (err) {
    if (err) throw err
    return callback(db, done)
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
