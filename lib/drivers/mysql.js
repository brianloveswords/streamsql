const Stream = require('stream')
module.exports = function MysqlDriver() {
  const mysql = require('mysql')

  return {
    connect: function connect(opts, callback) {
      function createConnectionInstance(connection, callback) {
        connection.instance = mysql.createConnection(opts)
        connection.instance.connect(callback)
        setErrorHandler(connection)
      }

      function setErrorHandler(connection) {
        connection.instance.on('error', function(err) {
          if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            createConnectionInstance(connection)
          }
          else {
            console.error(err)
          }
        })
      }

      var connection = {}
      createConnectionInstance(connection, callback)
      return connection
    },
    close: function close(connection, callback) {
      return connection.instance.end(callback)
    },
    getQueryFn: function getQueryFn(connection) {
      return function (sql, params, callback) {
        const opts = { sql: sql }
        return connection.instance.query(opts, params, callback)
      }
    },
    getStreamFn: function getStreamFn(connection) {
      // will be in the context of `db`
      // expected to return a stream
      return function streamQuery(sql, opts) {
        const stream = new Stream()
        const queryStream = this.query(sql)
        const handlers = this.driver.streamHandlers(stream, opts)

        stream.pause = connection.instance.pause.bind(connection.instance)
        stream.resume = connection.instance.resume.bind(connection.instance)

        queryStream.on('result', handlers.row)
        queryStream.on('end', handlers.done)
        queryStream.on('error', stream.emit.bind(stream, 'error'))
        return stream
      }
    },
    putShouldUpdate: function (err) {
      const message = err.message
      const code = err.code
      const primaryKeyError = message.match(/for key .*?PRIMARY/)
      return (code == 'ER_DUP_ENTRY' && primaryKeyError)
    }
  }
}
