const test = require('tap').test
const base = require('..')
const sqliteLoad = require('./sqlite-load')

const db = base.connect({
  driver: 'sqlite3',
  database: ':memory:',
})

test('table.get', function (t) {
  sqliteLoad(db, ['user-sqlite'], function () {
    const user = db.table('user', {
      fields: ['first_name', 'last_name'],
    })

    user.del({last_name: 'Hannah'}, function (err, result) {
      t.notOk(err, 'no errors')
      t.same(result.affectedRows, 1, 'should affect one row')

      user.get({last_name: 'Hannah'}, function (err, rows) {
        t.same(rows, [], 'should have no results')
        t.end()
      })
    })
  })
})
