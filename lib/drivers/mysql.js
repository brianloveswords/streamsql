const Stream = require('stream')
module.exports = function MysqlDriver() {
  const mysql = require('mysql')

  return {
    connect: function connect(opts, callback) {
      if (callback) {
        process.nextTick(function () {
          callback(null)
        })
      }

      opts.connectionLimit = 100
      return mysql.createPool(opts)
    },
    close: function close(pool, callback) {
      pool.end(callback)
    },
    getQueryFn: function getQueryFn(pool) {
      return function (sql, params, callback) {
        const opts = { sql: sql }

        pool.getConnection(function (err, connection) {
          if (err) {
            if (callback) 
              return callback(err)
            else
              return console.error(err)
          }

          return connection.query(opts, params, function (err, rows) {
            connection.release()
            if (callback) callback(err, rows)
          })
        })
      }
    },
    getStreamFn: function getStreamFn(pool) {
      // will be in the context of `db`
      // expected to return a stream
      return function streamQuery(sql, opts) {
        const stream = new Stream()
        const handlers = this.driver.streamHandlers(stream, opts)

        pool.getConnection(function (err, connection) {
          if (err) return stream.emit('error', err)

          function endCallback(err) {
            connection.release()
            handlers.done(err)
          }

          const queryStream = connection.query(sql)

          stream.pause = connection.pause.bind(connection)
          stream.resume = connection.resume.bind(connection)

          queryStream.on('result', handlers.row)
          queryStream.on('end', endCallback)
          queryStream.on('error', stream.emit.bind(stream, 'error'))
        })

        return stream
      }
    },
    putShouldUpdate: function (err, opts) {
      opts = opts || {}
      const message = err.message
      const code = err.code
      var uniqueKey
      if (opts.uniqueKey) {
        uniqueKey = typeof opts.uniqueKey === 'string'
          ? [opts.uniqueKey]
          : opts.uniqueKey
      } else {
        uniqueKey = []
      }
      const primaryKeyError = message.match(/for key .*?PRIMARY/)
      const uniqueKeyError = uniqueKey.reduce(function (result, key) {
        return result || message.indexOf("'" + key + "'") > -1
      }, false)
      return ((code == 'ER_NO_DEFAULT_FOR_FIELD') ||
              (code == 'ER_DUP_ENTRY' && primaryKeyError || uniqueKeyError))
    }
  }
}
