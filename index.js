// #TODO: rewrite createWriteStream to take advantage of `put` and `update`

const mysql = require('mysql')
const Stream = require('stream')
const map = require('map-stream')
const WriteableStream = Stream.Writable
const extend = require('xtend')
const keys = Object.keys

const escapeId = mysql.escapeId.bind(mysql)
const escape = mysql.escape.bind(mysql)

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  database: 'friend_overview',
})

connection.connect()

const tableCache = { }
const proto = create(connection, {
  connection: connection,

  _tables: {},

  registerTable: function (name, spec) {
    this._tables[name] = spec
    return this.table(name);
  },

  table: function table(name) {
    if (tableCache[name])
      return tableCache[name]

    const spec = this._tables[name]

    if (!spec)
      throw new Error('table ' + name + ' is not registered')

    return (tableCache[name] = create(this, {
      _table: spec.tableName || name,
      _primary: spec.primaryKey || 'id',
      _fields: spec.fields || [],
      _proto: spec.methods || {},
      row: {}
    }))
  },

  get: function get(cnd, opts, callback) {
    if (typeof opts == 'function')
      callback = opts, opts = null

    const rowProto = this.rowMethods()
    const query = this.selectQuery({
      table: this._table,
      fields: this._fields,
      conditions: cnd,
      limit: 1
    }, function (err, data) {
      if (err)
        return callback(err)

      if (!data.length)
        return callback()

      return callback(null, create(rowProto, data))
    })
  },

  selectQuery: function selectQuery(opts, callback) {
    const conn = this.connection

    var queryString = selectStatement(opts.table, opts.fields, opts.relationships)
    queryString += whereStatement(opts.conditions, opts.table)

    if (opts.limit)
      queryString += ' LIMIT ' + opts.limit

    const queryOpts = { sql: queryString }

    if (opts.relationships)
      queryOpts.nestTables = true

    if (!callback)
      return conn.query(queryOpts, opts.fields)
    return conn.query(queryOpts, opts.fields, callback)
  },

  rowMethods: function () {
    return extend(this._proto, this.row)
  },

  del: function (cnd, opts, callback) {
    if (typeof opts == 'function')
      callback = opts, opts = null
    opts = opts || {}
    const conn = this.connection
    const table = this._table
    const queryString =
      deleteStatement(table) +
      whereStatement(cnd, table) +
      limitStatement(opts)
    return conn.query(queryString, callback)
  },

  put: function (row, callback) {
    const conn = this.connection
    const table = this._table
    const primaryKey = this._primary
    const queryString = 'INSERT INTO ' + mysql.escapeId(table) + ' SET ?'
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
          return this._update(row, callback)
        return callback(err)
      }

      meta.insertId = result.insertId
      return callback(null, row, meta)
    }
  },

  _update: function (row, callback){
    const conn = this.connection
    const table = this._table
    const primaryKey = this._primary

    const queryString =
      'UPDATE ' + mysql.escapeId(table) +
      ' SET ? WHERE ' + mysql.escapeId(primaryKey) +
      ' = ' + mysql.escape(row[primaryKey]) +
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
      return callback(null, row, meta)
    }
  },

  createReadStream: function createReadStream(conditions, opts) {
    opts = opts || {}
    const conn = this.connection
    const fields = this._fields
    const relationships = opts.relationships
    const table = this._table
    const query = this.selectQuery({
      table: table,
      fields: opts.fields || this._fields,
      conditions: conditions,
      relationships: opts.relationships,
    })

    const rowProto = this.rowMethods()
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
          if (rel.type == 'hasOne') {
            current[rel.as || key] = row[rel.table]
          }

          if (rel.type == 'hasMany') {
            hold = true

            if (!processing) {
              processing = current
              processing[key] = []
            }

            // when the pivot changes, we want to emit that row and
            // change the `processing` pointer to the current row
            if (current[rel.pivot] != processing[rel.pivot]) {
              console.log('current', current[rel.pivot], 'processing', processing[rel.pivot])
              stream.emit('data', processing)

              processing = current
              processing[key] = []
            }

            processing[key].push(row[rel.table])
          }
        }.bind(this))

        if (!hold)
          stream.emit('data', current)
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
  },

  createKeyStream: function () {
    const primaryKey = this._primary
    return (
      this.createReadStream().pipe(map(function (row, next) {
        return next(null, row[primaryKey])
      }))
    )
  },

  createWriteStream: function createWriteStream(opts) {
    opts = opts || {}
    const conn = this.connection
    const table = this._table
    const stream = new WriteableStream

    stream.write = function write(row, callback) {
      const queryString = 'INSERT INTO ' + escapeId(table) + ' SET ?'
      const query = conn.query(queryString, [row], handleResult)
      const meta = {
        row: row,
        sql: query.sql,
        insertId: null
      }
      function handleResult(err, result) {
        if (err) {
          if (callback) callback(err)
          return stream.emit('error', err, meta)
        }

        meta.insertId = result.insertId

        stream.emit('row', row, meta)
        stream.emit('meta', meta)
        stream.emit('drain')

        if (callback)
          callback(null, row, meta)
      }

      return false;
    }
    stream.end = function end(row) {
      function done() {
        ['finish', 'close', 'end'].forEach(stream.emit.bind(stream))
      }
      if (row)
        stream.write(row, function (err) {
          // errors will be handled by `write`
          if (!err) done()
        })

      else done()
    }

    return stream
  }
})

module.exports = create(proto, {
  connection: connection
})


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
