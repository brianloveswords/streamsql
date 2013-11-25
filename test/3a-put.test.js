const test = require('tap').test
const base = require('..')
const sqliteLoad = require('./sqlite-load')

const db = base.connect({
  driver: 'sqlite3',
  database: ':memory:',
})

const user = db.table('user', [
 'id', 'first_name', 'last_name', 'born'
])

test('sql loading', function (t) {
  sqliteLoad(db, ['user-sqlite'], function () {
    const user = db.table('user', {
      fields: ['id', 'first_name', 'last_name']
    })

    const row = {
      first_name: 'Brian',
      last_name: 'Brennan'
    }

    user.put(row, function (err, meta) {
      t.notOk(err, 'should not have any errors')
      t.ok(meta.insertId, 'should have an insertId')
      t.same(row, meta.row, 'should have correct row')

      const updateRow = {
        id: meta.insertId,
        first_name: 'Sean'
      }

      user.put({first_name: 'Brian', last_name: 'Smith'}, function (err, meta) {
        t.ok(err, 'should have an error')
        user.put(updateRow, function (err, meta) {
          console.dir(err)
          t.notOk(err, 'should not have an error')
          t.same(meta.affectedRows, 1, 'should have affected one row')
          t.end()
        })
      })
    })
  })
})
