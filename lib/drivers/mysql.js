const Stream = require('stream')
module.exports = function MysqlDriver() {
  const mysql = require('mysql')

  return {
    connect: function connect(opts, callback) {
      const conn = mysql.createConnection(opts)
      conn.connect(callback)
      return conn
    },
    getQueryFn: function getQueryFn(connection) {
      return function (sql, params, callback) {
        const opts = { sql: sql }
        return connection.query(opts, params, callback)
      }
    },
    getStreamFn: function getStreamFn(connection) {
      // will be in the context of `db`
      // expected to return a stream
      return function streamQuery(sql, opts) {
        const stream = new Stream()
        const queryStream = this.query(sql)
        const handlers = this.driver.streamHandlers(stream, opts)

        stream.pause = connection.pause.bind(connection)
        stream.resume = connection.resume.bind(connection)

        queryStream.on('result', handlers.row)
        queryStream.on('end', handlers.done)
        queryStream.on('error', stream.emit.bind(stream, 'error'))
        return stream
      }
    }
  }
}
