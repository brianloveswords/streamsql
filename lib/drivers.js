const sqlite3 = require('sqlite3')
const mysql = require('mysql')
const create = require('./create')
const util = require('util')

const fmt = util.format.bind(util)

const driverProto = {
  escape: function escape(value) {
    return mysql.escape(value)
  },
  escapeId: function escapeId(id) {
    return mysql.escapeId(id)
  },
  whereSql: function whereSql(table, conditions) {
    if (!conditions || !keys(conditions).length)
      return ''

    const escape = this.escape
    const escapeId = this.escapeId
    var where = ' WHERE '

    var clauses = map(conditions, function (val, key) {
      const field = escapeId([table, key].join('.'))
      var cnd = conditions[key]

      if (Array.isArray(cnd)) {
        // if the condition is a simple array,
        // e.g { release_date: [2000,1996] }
        // use an `in` operator.
        if (typeof cnd[0] != 'object') {
          cnd = cnd.map(function (x) { return escape(x) })
          return fmt('%s IN (%s)', field, cnd.join(','))
        }


        return cnd.map(function (subcnd) {
          return fmt('%s %s %s',
                     field,
                     subcnd.op,
                     escape(subcnd.value))
        }).join(' AND ')
      }

      const op = cnd.operation || cnd.op || '='
      if (cnd.value) cnd = cnd.value
      return fmt('%s %s %s', field, op, escape(cnd))
    })

    where += clauses.join(' AND ')
    return where
  },
  orderSql: function sortSql(table, order) {
    if (!order) return ''

    const escape = this.escape
    const escapeId = this.escapedId

    // order can be one of three styles:
    // * implicit ascending, single: 'title'
    // * implicit ascending, multi: ['release_date', 'title']
    // * explicit: { title: 'desc', release_date: 'asc' }

    if (typeof order == 'string')
      return fmt(' ORDER BY %s', escapeId(order))

    if (Array.isArray(order))
      return fmt(' ORDER BY %s', order.map(escapeId).join(','))

    // must be an object
    return fmt(' ORDER BY %s', map(order, function (value, key) {
      return fmt('%s %s', escapeId(key), value.toUpperCase())
    }).join(','))
  },
  limitSql: function limitSql(limit, page) {
    if (!limit) return ''
    if (!page) return fmt(' LIMIT %s ', limit)
    const beginning = (page - 1) * limit
    return fmt(' LIMIT %s,%s ', beginning, limit)
  },
  selectSql: function selectSql(opts) {
    const table = opts.table
    const fields = opts.fields
    const conds = opts.conditions
    const fieldList = fields.map(this.escapeId).join(',')
    const escapeId = this.escapeId
    const escape = this.escape
    const useRaw = Array.isArray(conds)

    if (useRaw) return raw()

    const statement = ''
      + fmt('SELECT %s FROM %s', fieldList, escapeId(table))
      + this.whereSql(table, conds)
      + this.orderSql(opts.order)
      + this.limitSql(opts.limit, opts.page)

    return statement

    function raw() {
      const sql = conds[0].replace(/\$table/i, escapeId(table))
      const values = conds[1].map(escape)
      const statement = values.reduce(function (sql, value) {
        return sql.replace('?', value)
      }, sql)
      return statement
    }

  },
  insertSql: function insertSql(table, row) {
    const columns = keys(row)
    const values = vals(row)

    const tpl = 'INSERT INTO %s (%s) VALUES (%s)'
    return fmt(tpl, this.escapeId(table),
               map(columns, this.escapeId),
               map(values, this.escape))
  },
  updateSql: function updateSql(table, row, primaryKey) {
    const escape = this.escape
    const escapeId = this.escapeId
    const pairs = map(row, function (val, col) {
      return fmt('%s = %s', escapeId(col), escape(val))
    })
    return fmt('UPDATE %s SET %s WHERE %s = %s',
               escapeId(table),
               pairs,
               escapeId(primaryKey),
               escape(row[primaryKey]))
  },
  close: function close(connection, callback) {
    return connection.end(callback)
  }
}


module.exports = {
  mysql: create(driverProto, {
    connect: function connect(opts, callback) {
      const conn = mysql.createConnection(opts)
      conn.connect(callback)
      return conn
    },
    getQueryFn: function getQueryFn(connection) {
      return connection.query.bind(connection)
    },
  }),

  sqlite: create(driverProto, {
    connect: function connect(opts, callback) {
      const filename = opts.database || opts.filename
      return new sqlite3.Database(filename, callback)
    },
    getQueryFn: function getQueryFn(connection) {
      return function query(sql, params, callback) {
        if (typeof params == 'function') {
          callback = params
          params = null
        }

        if (!callback)
          callback = function(){}

        function handle(err) {
          if (err) return callback(err)

          callback(null, {
            insertId: this.lastID,
            affectedRows: this.changes,
            sql: this.sql,
          })
        }

        const args = (!params)
          ? [sql, handle]
          : [sql, params, handle]

        connection.run.apply(connection, args)
      }
    },
    close: function sqliteClose(connection, callback) {
      // no real close method for sqlite
      return callback && callback()
    }
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
