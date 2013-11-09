const test = require('tap').test
const useDb = require('./testdb')

test('table.put', function (t) {
  useDb(t, ['user'], function (db, done) {
    const user = db.table('user', {
      fields: ['id', 'first_name', 'last_name']
    })

    const row = {
      first_name: 'Brian',
      last_name: 'Brennan'
    }

    user.put(row, function (err, meta) {
      t.notOk(err, 'should not have any errors')
      t.same(meta.insertId, 1, 'should have an insertId')
      t.same(row, meta.row, 'should have correct row')

      const updateRow = {
        id: meta.insertId,
        first_name: 'Sean'
      }

      user.put(updateRow, function (err, meta) {
        t.notOk(err, 'should not have an error')
        t.same(meta.affectedRows, 1, 'should have affected one row')
        t.end()
      })
    })
  })
})
