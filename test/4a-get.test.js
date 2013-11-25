const test = require('tap').test
const base = require('..')
const sqliteLoad = require('./sqlite-load')

const db = base.connect({
  driver: 'sqlite3',
  database: ':memory:',
})

test('table.get', function (t) {
  sqliteLoad(db, ['user-sqlite'], function () {
    const user = makeUserTable(db)

    user.row.fullname = function fullname() {
      return this.first_name + ' ' + this.last_name
    }

    const cnd = { last_name: 'Hannah' }
    const opts = { sort: 'first_name', debug: true }
    user.get(cnd, opts , function (err, row) {

      t.notOk(err, 'no errors')
      t.same(row[0].fullname(), 'Barry Hannah')

      user.getOne({last_name: 'Hannah'}, function (err, row) {
        t.notOk(err, 'no errors')
        t.same(row.fullname(), 'Barry Hannah')
        t.end()
      })

    })
  })
})

test('table.get, complex where', function (t) {
  sqliteLoad(db, ['user-sqlite'], function () {
    const user = makeUserTable(db)
    user.get({
      age: [
        { value: 40, op: '>=' },
        { value: 60, op: '<=' },
      ]
    }, {
      sort: 'age',
      debug: true
    }, function (err, rows) {
      const expect = ['Saunders', 'Link']
      const result = rows.map(value('last_name'))
      t.same(result, expect, 'should have the right values')
      t.end()
    })
  })
})

test('table.get, complex where', function (t) {
  sqliteLoad(db, ['user-sqlite'], function () {
    const user = makeUserTable(db)
    const sql = 'select last_name AS `last` from $table where first_name = ? OR first_name = ?'
    user.get([sql, ['George', 'Kelly']], function (err, rows) {
      const expect = ['Saunders', 'Link']
      const result = rows.map(value('last'))
      t.same(result, expect, 'should have the right values')
      t.end()
    })
  })
})

function value(name) { return function (obj) { return obj[name] } }

function makeUserTable(db) {
  return db.table('user', {
    fields: ['id', 'first_name', 'last_name', 'age'],
  })
}
