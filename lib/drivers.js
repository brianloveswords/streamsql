const sqliteDriver = require('sqlite3').verbose()
const mysqlDriver = require('mysql')
const create = require('./create')

module.exports = {
  mysql: {
    connect: function connect(opts, callback) {
      const conn = mysqlDriver.createConnection(opts)
      conn.connect(callback)
      return conn
    },
    getQueryFn: function getQueryFn(connection) {
      return connection.query.bind(connection)
    },
  }
}
