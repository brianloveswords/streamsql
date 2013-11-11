// #TODO: rewrite createWriteStream to take advantage of `put` and `update`

const mysql = require('mysql')
// const Stream = require('stream')
// const map = require('map-stream')
// const WriteableStream = Stream.Writable
const extend = require('xtend')
const keys = Object.keys

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

  const conn = this.db.connection
  const rowProto = this.row
  const query = selectQuery({
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

//   del: function (cnd, opts, callback) {
//     if (typeof opts == 'function')
//       callback = opts, opts = null
//     opts = opts || {}
//     const conn = this.connection
//     const table = this._table
//     const queryString =
//       deleteStatement(table) +
//       whereStatement(cnd, table) +
//       limitStatement(opts)
//     return conn.query(queryString, callback)
//   },

//   put: function (row, callback) {
//     const conn = this.connection
//     const table = this._table
//     const primaryKey = this._primary
//     const queryString = 'INSERT INTO ' + mysql.escapeId(table) + ' SET ?'
//     const tryUpdate = primaryKey in row
//     const query = conn.query(queryString, [row], handleResult.bind(this))
//     const meta = {
//       row: row,
//       sql: query.sql,
//       insertId: null
//     }
//     function handleResult(err, result) {
//       if (err) {
//         if (err.code == 'ER_DUP_ENTRY' && tryUpdate)
//           return this._update(row, callback)
//         return callback(err)
//       }

//       meta.insertId = result.insertId
//       return callback(null, meta)
//     }
//   },

//   _update: function (row, callback){
//     const conn = this.connection
//     const table = this._table
//     const primaryKey = this._primary

//     const queryString =
//       'UPDATE ' + mysql.escapeId(table) +
//       ' SET ? WHERE ' + mysql.escapeId(primaryKey) +
//       ' = ' + mysql.escape(row[primaryKey]) +
//       ' LIMIT 1 '

//     const query = conn.query(queryString, [row], handleResult.bind(this))
//     const meta = {
//       row: row,
//       sql: query.sql,
//       affectedRows: null
//     }
//     function handleResult(err, result) {
//       if (err)
//         return callback(err)
//       meta.affectedRows = result.affectedRows
//       return callback(null, row, meta)
//     }
//   },

//   createReadStream: function createReadStream(conditions, opts) {
//     opts = opts || {}
//     const conn = this.connection
//     const fields = this._fields
//     const relationships = opts.relationships
//     const table = this._table
//     const query = this.selectQuery({
//       table: table,
//       fields: opts.fields || this._fields,
//       conditions: conditions,
//       relationships: opts.relationships,
//     })

//     const rowProto = this.rowMethods()
//     const stream = new Stream
//     stream.pause = conn.pause.bind(conn)
//     stream.resume = conn.resume.bind(conn)
//     query.on('error', stream.emit.bind(stream, 'error'))
//     if (!relationships) {
//       query.on('result', function onResult(row) {
//         stream.emit('data', create(rowProto, row))
//       })
//       query.on('end', stream.emit.bind(stream, 'end'))
//     } else {
//       var processing

//       query.on('result', function onResult(row) {
//         const current = row[table]
//         var hold = false;
//         forEach(relationships, function (key, rel) {
//           if (rel.type == 'hasOne') {
//             current[rel.as || key] = row[rel.table]
//           }

//           if (rel.type == 'hasMany') {
//             hold = true

//             if (!processing) {
//               processing = current
//               processing[key] = []
//             }

//             // when the pivot changes, we want to emit that row and
//             // change the `processing` pointer to the current row
//             if (current[rel.pivot] != processing[rel.pivot]) {
//               console.log('current', current[rel.pivot], 'processing', processing[rel.pivot])
//               stream.emit('data', processing)

//               processing = current
//               processing[key] = []
//             }

//             processing[key].push(row[rel.table])
//           }
//         }.bind(this))

//         if (!hold)
//           stream.emit('data', current)
//       })

//       query.on('end', function () {
//         if (processing)
//           stream.emit('data', processing)
//         stream.emit('end')
//       })
//     }

//     if (opts.debug)
//       console.error(query.sql)

//     return stream
//   },

//   createKeyStream: function (conditions) {
//     // TODO: optimize by implementing ability to include/exclude columns
//     // from a query.
//     const primaryKey = this._primary
//     return (
//       this.createReadStream(conditions)
//         .pipe(map(function (row, next) {
//           return next(null, row[primaryKey])
//         }))
//     )
//   },

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
  var queryString = selectStatement(opts.table, opts.fields, opts.relationships)
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

function selectStatement(table, fields, relationships) {
  if (relationships)
    return selectWithJoinStatement.apply(null, arguments)

  const queryString =
    'SELECT '
    + fields.map(mysql.escapeId.bind(mysql)).join(',')
    + ' FROM '+ mysql.escapeId(table)
  return queryString
}

function selectWithJoinStatement(table, fields, relationships) {
  const foreignTable = relationships

  var allFields = fields.slice().map(function (field) {
    return [table,field].join('.')
  })

  var joinString = ''

  forEach(relationships, function (key, rel) {
    const otherTable = rel.table
    const joinKey = (rel.from || key)
    const joinType = rel.optional ? ' LEFT ' : ' INNER '
    allFields = allFields.concat(getFields(otherTable))
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

function getFields(table) {
  if (!tableCache[table])
    throw new Error('table ' + escapeId(table) + ' does not appear to be registered')
  return tableCache[table]._fields.map(function (field) {
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
  var cdnString = ''

  if (!conditions || !keys(conditions).length)
    return cdnString

  cdnString += ' WHERE '

  const where = keys(conditions).map(function (key) {
    var cnd = conditions[key]
    const op = cnd.operation || cnd.op || '='
    if (cnd.value)
      cnd = cnd.value
    const field = escapeId([table, key].join('.'))
    return field + ' ' + op + ' ' + escape(cnd)
  })

  cdnString += where.join(' AND ')
  return cdnString
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
