const Stream = require('stream')
module.exports = function SqliteDriver() {
  const sqlite3 = require('sqlite3')

  return {
    connect: function connect(opts, callback) {
      const filename = opts.database || opts.filename
      return new sqlite3.Database(filename, callback)
    },
    close: function sqliteClose(connection, callback) {
      // no real close method for sqlite
      return callback && callback()
    },
    getStreamFn: function (connection) {
      return function streamQuery(sql, opts) {
        const noop = function(){}
        const stream = new Stream()
        const handlers = this.driver.streamHandlers(stream, opts)

        // sqlite has no native way to pause or resume
        stream.pause = noop
        stream.resume = noop

        function rowCallback(err, row) {
          if (err) return stream.emit('error', err)
          return handlers.row(row)
        }

        connection.each(sql, rowCallback, handlers.done)
          return stream
      }
    },
    getQueryFn: function getQueryFn(connection) {
      return function query(sql, params, callback) {
        sql = sql.trim()

        if (typeof params == 'function') {
          callback = params
          params = null
        }

        if (!callback)
          callback = function(){}

        function handle(err, rows) {
          if (err) return callback(err)

          // sqlite differentiates between queries that don't return a
          // value and queries that do. queries that return a value will
          // get two arguments to the callback
          if (arguments.length == 1) {
            return callback(null, {
              insertId: this.lastID,
              affectedRows: this.changes,
              sql: this.sql,
            })
          }

          return callback(null, rows)
        }

        const args = (!params)
          ? [sql, handle]
          : [sql, params, handle]

        if (sql.toUpperCase().indexOf('SELECT') === 0)
          return connection.all.apply(connection, args)

        return connection.run.apply(connection, args)
      }
    },
    putShouldUpdate: function (err, opts) {
      const message = err.message
      const primaryKeyError = message.match('PRIMARY KEY must be unique')
      var uniqueKey
      if (opts.uniqueKey) {
        uniqueKey = typeof opts.uniqueKey === 'string'
          ? [opts.uniqueKey]
          : opts.uniqueKey
      } else {
        uniqueKey = []
      }
      const uniqueKeyError = uniqueKey.reduce(function (result, key) {
        return result || message.indexOf('column ' + key + ' is not unique')
      }, false)
      return (primaryKeyError || uniqueKeyError)
    }
  }
}
