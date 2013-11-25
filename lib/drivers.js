const sqlite3 = require('sqlite3')
const mysql = require('mysql')
const create = require('./create')
const util = require('util')
const Stream = require('stream')

const JOIN_SEP = ':@:'

const fmt = util.format.bind(util)

const driverProto = {
  escape: function escape(value) {
    return mysql.escape(value)
  },
  escapeId: function escapeId(id) {
    return mysql.escapeId(id)
  },
  whereSql: function whereSql(table, conditions) {
    const hasConditons = conditions && keys(conditions).length
    if (!hasConditons) return ''

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
          const operation = subcnd.op
          const value = escape(subcnd.value)
          return fmt('%s %s %s', field, operation, value)
        }).join(' AND ')
      }

      const op = cnd.operation || cnd.op || '='
      if (cnd.value) cnd = cnd.value
      return fmt('%s %s %s', field, op, escape(cnd))
    })

    where += clauses.join(' AND ')
    return where
  },
  orderSql: function orderSql(table, order) {
    if (!order) return ''

    const escape = this.escape
    const escapeId = this.escapeId

    // order can be one of three styles:
    // * implicit ascending, single: 'title'
    // * implicit ascending, multi: ['release_date', 'title']
    // * explicit: { title: 'desc', release_date: 'asc' }

    if (typeof order == 'string') {
      return fmt(' ORDER BY %s ', escapeId(order))
    }

    if (Array.isArray(order))
      return fmt(' ORDER BY %s ', order.map(escapeId).join(','))

    // must be an object
    return fmt(' ORDER BY %s ', map(order, function (value, key) {
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
    const escapeId = this.escapeId
    const escape = this.escape
    const table = opts.table
    const tables = opts.tables
    const fields = opts.fields
    const conds = opts.conditions
    const includeFields = opts.include
    const excludeFields = opts.exclude
    const relationships = opts.relationships
    const useRaw = Array.isArray(conds)
    const useJoin = (relationships && keys(relationships).length)

    if (useRaw) return rawSql.call(this)
    if (useJoin) return withJoin.call(this)

    const fieldList = filterFields(fields, includeFields, excludeFields)
      .map(escapeId).join(',')

    const statement = ''
      + fmt('SELECT %s FROM %s', fieldList, escapeId(table))
      + this.whereSql(table, conds)
      + this.orderSql(table, opts.order)
      + this.limitSql(opts.limit, opts.page)

    return statement

    function rawSql() {
      const sql = conds[0].replace(/\$table/i, escapeId(table))
      const values = conds[1].map(escape)
      const statement = values.reduce(function (sql, value) {
        return sql.replace('?', value)
      }, sql)
      return statement
    }

    function withJoin() {
      var allFields = fields
        .slice().map(function (field) {
          return [table, field].join('.')
        })

      var joinString = ''

      this.normalizeRelationships(table, relationships)

      // in the loop below, rel -->
      // { 'type': <string>,
      //   'local': <{table, key}>,
      //   'foreign': <{table, key, [as]}>,
      //   'optional': <null | boolean>  }

      forEach(relationships, function (rel) {
        if (rel.type == 'hasMany') return
        allFields = allFields.concat(getFields(rel.foreign, tables))
        joinString += this.joinSql(rel)
      }.bind(this))

      const selectFields =
        filterFields(allFields, includeFields, excludeFields)

      const joinStatement =
        fmt('SELECT %s FROM %s %s',
        selectAs(selectFields),
        escapeId(table),
        joinString)

      const statement = joinStatement
        + this.orderSql(table, opts.order)
        + this.limitSql(opts.limit, opts.page)

      return statement
    }

    function selectAs(fields) {
      return fields.map(function (field) {
        return fmt(
          '%s AS %s',
          escapeId(field),
          escapeId(field.replace('.', JOIN_SEP)))
      }).join(',')
    }

    function getFields(tableWithAlias, tables) {
      // XXX: probably shouldn't throw
      const name = tableWithAlias.table
      const alias = tableWithAlias.as || name
      const tableDef = tables[name]
      if (!tableDef)
        throw new Error(fmt('table %s is not registered', escapeId(name)))
      return tableDef.fields.map(function (field) {
        return [alias, field].join('.')
      })
    }

  },
  parseJoinRow: function (row, table, relationships) {
    const fixed = {}

    forEach(row, function (val, key) {
      fixLocalTable(key, fixed)
      forEach(relationships, function (_, relKey) {
        fixRelatedTable(key, relKey, fixed)
      })
    })

    function fixLocalTable(key, fixed) {
      const tablePrefix = table + JOIN_SEP
      if (key.indexOf(tablePrefix) !== 0)
        return
      fixed[key.replace(tablePrefix, '')] = row[key]
    }

    function fixRelatedTable(key, relKey, fixed) {
      const rel = relationships[relKey]
      const tableName = rel.foreign.as || rel.foreign.table
      const tablePrefix = tableName + JOIN_SEP

      if (key.indexOf(tablePrefix) !== 0)
        return

      const subObject = fixed[relKey] || {}
      const fixedKey = key.replace(tablePrefix, '')
      subObject[fixedKey] = row[key]
      fixed[relKey] = subObject
    }

    return fixed
  },
  fixHasOne: function (row, opts) {
    const table = opts.table
    const relationships = opts.relationships
    const tableCache = opts.tableCache
    row = this.parseJoinRow(row, table, relationships)
    forEach(relationships, function (rel, relKey) {
      if (rel.type !== 'hasOne') return
      const foreign = rel.foreign
      const foreignProto = tableCache[foreign.table].row
      row[relKey] = create(foreignProto, row[relKey])
    })

    return row
  },

  fixHasMany: function (globalRow, opts, callback) {
    var globalError
    const table = opts.table
    const tableCache = opts.tableCache
    const hasMany = {}
    forEach(opts.relationships, function (rel, relKey) {
      if (rel.type == 'hasMany')
        hasMany[relKey] = rel
    })

    if (!keys(hasMany).length) {
      return process.nextTick(function () {
        callback(null, globalRow)
      })
    }

    this.normalizeRelationships(table, hasMany)

    var waiting = keys(hasMany).length

    forEach(hasMany, function (rel, relKey) {
      if (globalError) return
      const cond = {}
      const foreign = tableCache[rel.foreign.table]
      const foreignProto = foreign.row

      cond[rel.foreign.key] = globalRow[rel.local.key]

      foreign.get(cond, function (err, rows) {
        if (globalError) return
        if (err) {
          globalError = err
          return callback(err, null)
        }

        globalRow[relKey] = rows.map(function (row) {
          return create(foreignProto, row)
        })

        return checkDone()
      })
    })

    function checkDone() {
      if (globalError) return
      if (--waiting > 0) return
      return callback(null, globalRow)
    }
  },
  hydrateRow: function (row, opts, callback) {
    row = this.fixHasOne(row, {
      table: opts.table,
      relationships: opts.relationships,
      tableCache: opts.tableCache,
    })

    this.fixHasMany(row, {
      table: opts.table,
      relationships: opts.relationships,
      tableCache: opts.tableCache,
    }, callback)
  },
  streamHandlers: function (stream, opts) {
    var waiting = 0
    var finishing = false

    const driver = this
    const table = opts.table
    const rowProto = opts.rowPrototype
    const relationships = opts.relationships
    const tableCache = opts.tableCache

    const withRelationships =
      (relationships && keys(relationships).length)

    function onResult(row) {
      if (!withRelationships) {
        row = create(rowProto, row)
        return stream.emit('data', row)
      }

      waiting ++

      // fulfills both hasOne and hasMany relationships
      driver.hydrateRow(row, {
        table: table,
        relationships: relationships,
        tableCache: tableCache,
      }, function (err, row) {
        waiting --
        if (err) return stream.emit(err)
        stream.emit('data', create(rowProto, row))
        checkDone()
      })
    }

    function endCallback(err) {
      if (err) return stream.emit('error', err)
      if (waiting > 0) {
        finishing = true
        return false
      }
      stream.emit('end')
    }

    function checkDone() {
      if (finishing && !waiting)
        stream.emit('end')
    }

    return { row: onResult, done: endCallback }

  },
  normalizeRelationships: function (table, relationships) {
    forEach(relationships, function (rel, relKey) {
      if (!rel.local)
        rel.local = { table: table, key: relKey }

      if (typeof rel.local === 'string')
        rel.local = { table: table, key: rel.local }
    })
    return relationships
  },

  joinSql: function (opts) {
    // opts --> <see `withJoin` above>
    const local = opts.local
    const foreign = opts.foreign
    const joinType = opts.optional ? ' LEFT ' : ' INNER '
    const localKey = fmt('%s.%s', local.table, local.key)
    const foreignTableAlias = foreign.as || foreign.table
    const foreignKey = fmt('%s.%s', foreignTableAlias, foreign.key)

    const statement = joinType
      + ' JOIN ' + this.escapeId(foreign.table)
      + ' AS '   + this.escapeId(foreignTableAlias)
      + ' ON '   + this.escapeId(localKey)
      + ' = '    + this.escapeId(foreignKey)

    return statement
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
  deleteSql: function deleteSql(opts) {
    const table = opts.table
    const conds = opts.conditions
    const limit = opts.limit

    const statement = ''
      + fmt('DELETE FROM %s', this.escapeId(table))
      + this.whereSql(table, conds)
      + this.limitSql(limit)

    return statement
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
    },
  }),

  sqlite: create(driverProto, {
    connect: function connect(opts, callback) {
      const filename = opts.database || opts.filename
      return new sqlite3.Database(filename, callback)
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
    close: function sqliteClose(connection, callback) {
      // no real close method for sqlite
      return callback && callback()
    }
  })
}

function appearsLast(string, sub) {
  const index = string.indexOf(sub)
  if (index == -1) return false
  return string.slice(index) == sub
}

function filterFields(fields, includeFields, excludeFields) {
  if (!includeFields && !excludeFields)
    return fields

  // we always include ids because they are needed for proper
  // relationship fulfillment
  if (includeFields)
    includeFields.push('id')

  return fields.filter(function (field) {
    function search(needle) {
      return appearsLast(field, needle)
    }
    if (includeFields)
      return includeFields.some(search)
    if (excludeFields)
      return !excludeFields.some(search)
    return field
  })
}

function map(obj, fn) {
  return Object.keys(obj).map(function (key) {
    return fn(obj[key], key)
  })
}

function forEach(obj, fn) {
  return Object.keys(obj).forEach(function (key) {
    fn(obj[key], key)
  })
}

function keys(o) {
  return Object.keys(o)
}

function vals(o) {
  return map(o, function (val) { return val })
}
