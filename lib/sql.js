const mysql = require('mysql')
const util = require('util')
const forEach = require('./foreach')
const keys = Object.keys
const fmt = util.format.bind(util)
const escapeId = mysql.escapeId.bind(mysql)
const escape = mysql.escape.bind(mysql)

function getFields(table, tableCache) {
  if (!tableCache[table]) {
    throw new Error('table ' + escapeId(table) + ' does not appear to be registered')
  }

  return tableCache[table].fields.map(function (field) {
    return [table,field].join('.')
  })
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

  return fmt('SELECT %s FROM %s %s',
             escapedFields.join(','),
             escapeId(table),
             joinString)
}

function selectStatement(opts) {
  const table = opts.table
  const fields = opts.fields
  const relationships = opts.relationships

  if (relationships) {
    return selectWithJoinStatement.apply(null, arguments)
  }

  const fieldList = fields.map(escapeId.bind(mysql)).join(',')
  return fmt('SELECT %s FROM %s', fieldList, escapeId(table))
}


function deleteStatement(table) {
  return fmt('DELETE FROM %s', escapeId(table))
}

function limitStatement(opts) {
  if (!opts || !opts.limit) { return '' }
  return fmt(' LIMIT %s ', opts.limit)
}

function whereStatement(conditions, table) {
  if (!conditions || !keys(conditions).length) {
    return ''
  }

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

    if (cnd.value) {
      cnd = cnd.value
    }

    return fmt('%s %s %s', field, op, escape(cnd))
  })

  where += clauses.join(' AND ')
  return where
}

function selectQuery(opts, callback) {
  var queryString = selectStatement(opts)
  queryString += whereStatement(opts.conditions, opts.table)

  if (opts.limit) {
    queryString += fmt(' LIMIT %s ', opts.limit)
  }

  const queryOpts = { sql: queryString }

  if (opts.relationships) {
    queryOpts.nestTables = true
  }

  if (!callback) {
    return opts.query(queryOpts, opts.fields)
  }

  return opts.query(queryOpts, opts.fields, callback)
}


module.exports = {
  selectQuery: selectQuery,
  selectStatement: selectStatement,
  deleteStatement: deleteStatement,
  whereStatement: whereStatement,
  limitStatement: limitStatement,
}
