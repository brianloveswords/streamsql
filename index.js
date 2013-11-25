const Drivers = require('./lib/drivers')
const mysql = require('mysql')
const Stream = require('stream')
const util = require('util')
const sql = require('./lib/sql')
const map = require('map-stream')
const extend = require('xtend')
const _ = require('lodash')
const create = require('./lib/create')
const fmt = util.format.bind(util)

const escapeId = mysql.escapeId.bind(mysql)
const escape = mysql.escape.bind(mysql)

const dbProto = {}
const tableProto = {}

dbProto.close = function close(callback) {
  return this.driver.close(this.connection, callback)
}

dbProto.table = function table(name, definition) {
  if (definition)
    return this.registerTable.apply(this, arguments)

  const tableDefinition = this.tables[name]
  if (!tableDefinition)
    throw new Error(fmt('No table registered with the name `%s`', name))
  return tableDefinition
}

dbProto.registerTable = function registerTable(name, def) {
  const table = create(tableProto, {
    table: def.tableName || name,
    primaryKey: def.primaryKey || 'id',
    fields: def.fields || [],
    row: def.methods || {},
    relationships: def.relationships || {},
    db: this,
  })
  this.tables[name] = table
  return table
}

tableProto.put = function put(row, callback) {
  const table = this.table
  const primaryKey = this.primaryKey
  const driver = this.db.driver
  const insertSql = driver.insertSql(table, row)
  const tryUpdate = primaryKey in row
  const meta = { row: row, sql: null, insertId: null }
  const query = this.db.query(insertSql, function (err, result) {
    if (err) {
      const code = err.code
      const message = err.message
      const primaryKeyError = err.message.match(/for key .*?PRIMARY/)
      if (((code == 'ER_DUP_ENTRY' && primaryKeyError) ||
          message.match('PRIMARY KEY must be unique')) && tryUpdate)
        return this.update(row, callback)
      return callback(err)
    }

    meta.sql = insertSql
    meta.insertId = result.insertId

    return callback(null, meta)
  }.bind(this))
}

tableProto.update = function update(row, callback) {
  const table = this.table
  const primaryKey = this.primaryKey
  const driver = this.db.driver
  const updateSql = driver.updateSql(table, row, primaryKey)
  const query = this.db.query(updateSql, handleResult.bind(this))
  const meta = {
    row: row,
    sql: updateSql,
    affectedRows: null
  }

  function handleResult(err, result) {
    if (err) { return callback(err) }
    meta.affectedRows = result.affectedRows
    return callback(null, meta)
  }
}

tableProto.get = function get(cnd, opts, callback) {
  if (typeof opts == 'function') {
    callback = opts
    opts = {}
  }

  if (typeof cnd == 'function') {
    callback = cnd
    cnd = {}
    opts = {}
  }

  const rowProto = this.row
  const driver = this.db.driver

  const selectSql = driver.selectSql({
    db: this.db,
    table: this.table,
    tables: this.db.tables,
    relationships: opts.relationships,
    fields: this.fields,
    conditions: cnd,
    limit: opts.limit,
    include: opts.include,
    exclude: opts.exclude,
    page: opts.page,
    order: opts.sort || opts.order ||opts.orderBy,
  })

  this.db.query(selectSql, opts.single ? singleRow : manyRows)

  function singleRow(err, rows) {
    if (err) return callback(err)
    if (!rows.length) return
    return callback(null, create(rowProto, rows[0]))
  }

  function manyRows(err, rows) {
    if (err) return callback(err)

    return callback(null, rows.map(function (row) {
      return create(rowProto, row)
    }))
  }

  if (opts.debug)
    console.error(selectSql)
}

tableProto.getOne = function getOne(cnd, opts, callback) {
  if (typeof opts == 'function') {
    callback = opts
    opts = {}
  }
  const singularOpts = { limit: 1, single: true }
  return this.get(cnd, extend(opts, singularOpts), callback)
}

tableProto.del = function del(cnd, opts, callback) {
  if (typeof opts == 'function') {
    callback = opts
    opts = null
  }
  opts = opts || {}
  const query = this.db.query
  const driver = this.db.driver
  const table = this.table
  const deleteSql = driver.deleteSql({
    table: table,
    conditions: cnd,
    limit: opts.limit
  })

  if (opts.debug)
    console.error(deleteSql)

  return query(deleteSql, callback)
}

tableProto.createReadStream = function createReadStream(conditions, opts) {
  opts = opts || {}
  const conn = this.db.connection
  const driver = this.db.driver
  const fields = this.fields
  const table = this.table

  var relationships = opts.relationships || {}

  if (typeof relationships == 'boolean' &&
      relationships === true) {
    relationships = this.relationships
  }

  const selectSql = driver.selectSql({
    db: this.db,
    table: table,
    tables: this.db.tables,
    fields: fields,
    conditions: conditions,
    limit: opts.limit,
    page: opts.page,
    relationships: relationships,
    include: opts.include,
    exclude: opts.exclude,
    order: opts.sort || opts.order || opts.orderBy,
  })

  const tableCache = this.db.tables

  const queryStream = this.db.queryStream(selectSql, {
    rowPrototype: this.row,
    relationships: relationships,
    tableCache: this.db.tables,
    table: table,
  })

  if (opts.debug)
    console.error(selectSql)

  return queryStream
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

tableProto.createWriteStream = function createWriteStream(opts) {
  opts = opts || {}

  const ignoreDupes = opts.ignoreDupes
  const conn = this.db.connection
  const table = this.table
  const stream = new Stream()
  const emit = stream.emit.bind(stream)

  const put = this.put.bind(this)

  var waiting = 0
  var ending = false

  function done() {
    ['finish', 'close', 'end'].forEach(emit)
  }

  function drain() {
    waiting -= 1
    emit('drain')
    if (ending && waiting <= 0)
      return done()
  }

  stream.readable = true
  stream.writable = true

  stream.write = function write(row, callback) {
    waiting += 1

    put(row, function handleResult(err, meta) {
      if (err) {
        if (ignoreDupes) {
          emit('dupe', row)
          return drain()
        }

        if (callback) { callback(err) }
        emit('error', err, meta)
        return drain()
      }

      emit('meta', meta)
      emit('data', row)

      if (callback && typeof callback == 'function') {
        callback(null, meta)
      }

      return drain()
    })

    return false;
  }

  stream.end = function end(row, callback) {
    stream.readable = false

    if (typeof row == 'function') {
      callback = row
      row = null
    }

    if (callback) {
      stream.on('end', callback)
    }

    if (row) {
      stream.write(row)
      return stream.end()
    }

    if (waiting > 0) {
      ending = true
    } else {
      done()
    }
  }

  return stream
}

module.exports = {
  connect: function connect(options, callback) {
    const driver = Drivers[options.driver || 'mysql']
    const connection = driver.connect(options, callback)
    return create(dbProto, {
      connection: connection,
      query: driver.getQueryFn(connection),
      queryStream: driver.getStreamFn(connection),
      tables: {},
      driver: driver,
    })
  }
}
