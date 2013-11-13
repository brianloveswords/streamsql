// #TODO: rewrite createWriteStream to take advantage of `put` and `update`

const mysql = require('mysql')
const Stream = require('stream')
const map = require('map-stream')
const WritableStream = Stream.Writable
const extend = require('xtend')
const keys = Object.keys

const util = require('util')
const fmt = util.format.bind(util)

const escapeId = mysql.escapeId.bind(mysql)
const escape = mysql.escape.bind(mysql)

module.exports = { connect: connect }

function connect(options, callback) {
  const conn = mysql.createConnection(options)
  conn.connect(callback)
  return create(dbProto, {
    tables: {},
    connection: conn,
    query: conn.query.bind(conn)
  })
}

const dbProto = {}

dbProto.close = function close(callback) {
  return this.connection.end(callback)
}

dbProto.table = function table(name, spec) {
  var table
  if (!spec) {
    table = this.tables[name]
    if (!table)
      throw Error('No table registered with the name `'+name+'`')
    return table
  }

  return this.registerTable.apply(this, arguments)
}

dbProto.registerTable = function registerTable(name, spec) {
  const table = create(tableProto, {
    table: spec.tableName || name,
    primaryKey: spec.primaryKey || 'id',
    fields: spec.fields || [],
    row: spec.methods || {},
    relationships: spec.relationships || {},
    db: this,
  })
  this.tables[name] = table
  return table
}

const tableProto = {}

tableProto.put = function put(row, callback) {
  const conn = this.db.connection
  const table = this.table
  const primaryKey = this.primaryKey

  const queryString = 'INSERT INTO ' + escapeId(table) + ' SET ?'
  const tryUpdate = primaryKey in row
  const query = conn.query(queryString, [row], handleResult.bind(this))
  const meta = {
    row: row,
    sql: query.sql,
    insertId: null
  }
  function handleResult(err, result) {
    if (err) {
      if (err.code == 'ER_DUP_ENTRY' && tryUpdate)
        return this.update(row, callback)
      return callback(err)
    }

    meta.insertId = result.insertId
    return callback(null, meta)
  }
}

tableProto.update = function update(row, callback) {
  const conn = this.db.connection
  const table = this.table
  const primaryKey = this.primaryKey

  const queryString =
    'UPDATE ' + escapeId(table) +
    ' SET ? ' +
    ' WHERE ' + escapeId(primaryKey) +
    ' = ' + escape(row[primaryKey]) +
    ' LIMIT 1 '

  const query = conn.query(queryString, [row], handleResult.bind(this))
  const meta = {
    row: row,
    sql: query.sql,
    affectedRows: null
  }
  function handleResult(err, result) {
    if (err)
      return callback(err)
    meta.affectedRows = result.affectedRows
    return callback(null, meta)
  }
}

tableProto.get = function get(cnd, opts, callback) {
  if (typeof opts == 'function')
    callback = opts, opts = {}

  if (typeof cnd == 'function')
    callback = cnd, cnd = {}, opts = {}

  const conn = this.db.connection
  const rowProto = this.row
  const query = selectQuery({
    tableCache: this.db.tables,
    query: conn.query.bind(conn),
    table: this.table,
    fields: this.fields,
    conditions: cnd,
  }, opts.single ? singleRow : manyRows)

  function singleRow(err, rows) {
    if (err || !rows.length) return callback(err)
    return callback(null, create(rowProto, rows[0]))
  }

  function manyRows(err, rows) {
    if (err) return callback(err)
    return callback(null, rows.map(function (row) {
      return create(rowProto, row)
    }))
  }
}

tableProto.getOne = function getOne(cnd, opts, callback) {
  if (typeof opts == 'function')
    callback = opts, opts = {}
  const singularOpts = { limit: 1, single: true }
  return this.get(cnd, extend(opts, singularOpts), callback)
}

tableProto.del = function del(cnd, opts, callback) {
  if (typeof opts == 'function')
    callback = opts, opts = null
  opts = opts || {}
  const conn = this.db.connection
  const table = this.table
  const queryString =
    deleteStatement(table) +
    whereStatement(cnd, table) +
    limitStatement(opts)
  return conn.query(queryString, callback)
}

tableProto.createReadStream = function createReadStream(conditions, opts) {
  opts = opts || {}
  const conn = this.db.connection
  const fields = this.fields
  var relationships = opts.relationships

  if (typeof relationships == 'boolean') {
    relationships = (relationships === true)
      ? this.relationships
      : {}
  }

  const table = this.table

  const query = selectQuery({
    query: conn.query.bind(conn),
    table: table,
    tableCache: this.db.tables,
    fields: fields || this.fields,
    conditions: conditions,
    relationships: relationships,
  })

  const rowProto = this.row
  const tableCache = this.db.tables

  const stream = new Stream
  stream.pause = conn.pause.bind(conn)
  stream.resume = conn.resume.bind(conn)
  query.on('error', stream.emit.bind(stream, 'error'))
  if (!relationships) {
    query.on('result', function onResult(row) {
      stream.emit('data', create(rowProto, row))
    })
    query.on('end', stream.emit.bind(stream, 'end'))
  } else {
    var processing

    query.on('result', function onResult(row) {
      const current = row[table]
      var hold = false;
      forEach(relationships, function (key, rel) {
        const pivot = rel.pivot || 'id'
        const otherTable = rel.table
        const otherProto = tableCache[otherTable].row

        if (rel.type == 'hasOne')
          current[rel.as || key] = create(otherProto, row[otherTable])

        else if (rel.type == 'hasMany') {
          hold = true

          if (!processing) {
            processing = current
            processing[key] = []
          }

          // when the pivot changes, we want to emit that row and
          // change the `processing` pointer to the current row
          if (current[pivot] != processing[pivot]) {
            stream.emit('data', create(rowProto, processing))
            processing = current
            processing[key] = []
          }

          processing[key].push(create(otherProto, row[otherTable]))
        }
      })

      if (!hold)
        stream.emit('data', create(rowProto, current))
    })

    query.on('end', function () {
      if (processing)
        stream.emit('data', processing)
      stream.emit('end')
    })
  }

  if (opts.debug)
    console.error(query.sql)

  return stream
}

tableProto.createKeyStream = function createKeyStream(conditions, opts) {
  // TODO: optimize by implementing ability to include/exclude columns
  // from a query.
  const primaryKey = this.primaryKey
  return (
    this.createReadStream(conditions, opts)
      .pipe(map(function (row, next) {
        return next(null, row[primaryKey])
      }))
  )
}

//   createWriteStream: function createWriteStream() {
//     const conn = this.connection
//     const table = this._table
//     const stream = new WriteableStream

//     stream.write = function write(row, callback) {
//       const queryString = 'INSERT INTO ' + escapeId(table) + ' SET ?'
//       const query = conn.query(queryString, [row], handleResult)
//       const meta = {
//         row: row,
//         sql: query.sql,
//         insertId: null
//       }
//       function handleResult(err, result) {
//         if (err) {
//           if (callback) callback(err)
//           return stream.emit('error', err, meta)
//         }

//         meta.insertId = result.insertId

//         stream.emit('meta', meta)
//         stream.emit('drain')

//         if (callback)
//           callback(null, meta)
//       }

//       return false;
//     }
//     stream.end = function end(row) {
//       function done() {
//         ['finish', 'close', 'end'].forEach(stream.emit.bind(stream))
//       }
//       if (row)
//         stream.write(row, function (err) {
//           // errors will be handled by `write`
//           if (!err) done()
//         })

//       else done()
//     }

//     return stream
//   }
// })

function selectQuery(opts, callback) {
  var queryString = selectStatement(opts)
  queryString += whereStatement(opts.conditions, opts.table)

  if (opts.limit)
    queryString += ' LIMIT ' + opts.limit

  const queryOpts = { sql: queryString }

  if (opts.relationships)
    queryOpts.nestTables = true

  if (!callback)
    return opts.query(queryOpts, opts.fields)
  return opts.query(queryOpts, opts.fields, callback)
}

function selectStatement(opts) {
  const table = opts.table
  const fields = opts.fields
  const relationships = opts.relationships
  if (relationships)
    return selectWithJoinStatement.apply(null, arguments)

  const queryString =
    'SELECT '
    + fields.map(escapeId.bind(mysql)).join(',')
    + ' FROM '+ escapeId(table)
  return queryString
}

function selectWithJoinStatement(opts) {
  const table = opts.table
  const fields = opts.fields
  const relationships = opts.relationships
  const tableCache = opts.tableCache

  var allFields = fields.slice().map(function (field) {
    return [table,field].join('.')
  })

  var joinString = ''

  forEach(relationships, function (key, rel) {
    const otherTable = rel.table
    const joinKey = (rel.from || key)
    const joinType = rel.optional ? ' LEFT ' : ' INNER '
    allFields = allFields.concat(getFields(otherTable, tableCache))
    joinString = joinString +
      joinType + ' JOIN '+ escapeId(otherTable) +
      ' ON ' + escapeId([table, joinKey].join('.')) +
      ' = ' + escapeId([otherTable, rel.foreign].join('.'))
  })

  const escapedFields = allFields.map(function (field) {
    return escapeId(field)
  })

  var queryString =
    'SELECT '
    + escapedFields.join(',')
    + ' FROM '+ escapeId(table)
    + joinString

  return queryString
}

function getFields(table, tableCache) {
  if (!tableCache[table])
    throw new Error('table ' + escapeId(table) + ' does not appear to be registered')
  return tableCache[table].fields.map(function (field) {
    return [table,field].join('.')
  })
}

function deleteStatement(table) {
  return 'DELETE FROM ' + escapeId(table)
}

function limitStatement(opts) {
  if (!opts || !opts.limit)
    return ''
  var str = ' LIMIT ' + opts.limit
  return str
}

function whereStatement(conditions, table) {
  if (!conditions || !keys(conditions).length)
    return ''

  var where = ' WHERE '

  const clauses = keys(conditions).map(function (key) {
    const field = escapeId([table, key].join('.'))
    var cnd = conditions[key]

    // if the condition is an array, e.g { release_date: [2000, 1996] },
    // use an `in` operator.
    if (Array.isArray(cnd)) {
      cnd = cnd.map(function (x) { return escape(x) })
      return fmt('%s IN (%s)', field, cnd.join(','))
    }

    const op = cnd.operation || cnd.op || '='
    if (cnd.value)
      cnd = cnd.value

    return fmt('%s %s %s', field, op, escape(cnd))
  })

  where += clauses.join(' AND ')
  return where
}

function forEach(obj, fn) {
  keys(obj).forEach(function (key) {
    return fn(key, obj[key])
  })
}

function create(proto, obj) {
  return keys(obj).reduce(function (acc, key) {
    return (acc[key] = obj[key], acc)
  }, Object.create(proto))
}
