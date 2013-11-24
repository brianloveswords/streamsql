const sqliteDriver = require('sqlite3').verbose()
const mysqlDriver = require('mysql')
const create = require('./create')
const util = require('util')

const fmt = util.format.bind(util)

const driverProto = {
  escape: function (value) {
    return mysqlDriver.escape(value)
  },

  escapeId: function (id) {
    return mysqlDriver.escapeId(id)
  },

  insertSql: function insert(table, row) {
    const columns = keys(row)
    const values = vals(row)

    const tpl = 'INSERT INTO %s (%s) VALUES (%s)'
    return fmt(tpl, this.escapeId(table),
               map(columns, this.escapeId),
               map(values, this.escape))
  },
}


module.exports = {
  mysql: create(driverProto, {
    connect: function connect(opts, callback) {
      const conn = mysqlDriver.createConnection(opts)
      conn.connect(callback)
      return conn
    },
    getQueryFn: function getQueryFn(connection) {
      return connection.query.bind(connection)
    },
  })
}

function map(obj, fn) {
  return Object.keys(obj).map(function (key) {
    return fn(obj[key], key)
  })
}

function keys(o) {
  return Object.keys(o)
}

function vals(o) {
  return map(o, function (val) { return val })
}
