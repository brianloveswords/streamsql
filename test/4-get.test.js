const test = require('tap').test
const useDb = require('./testdb')

test('table.get', function (t) {
  useDb(t, ['user'], function (db, done) {
    const user = makeUserTable(db)

    user.row.fullname = function fullname() {
      return this.first_name + ' ' + this.last_name
    }

    user.get({
      last_name: 'Hannah'
    }, {
      sort: 'first_name',
      debug: true
    }, function (err, row) {
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
  useDb(t, ['user'], function (db, done) {
    const user = makeUserTable(db)
    user.get({
      born: [
        { value: '1950', op: '>=' },
        { value: '1970', op: '<=' },
      ]
    }, {
      sort: 'born',
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
  useDb(t, ['user'], function (db, done) {
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
    fields: ['first_name', 'last_name', 'born'],
  })
}
