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

    user.put(row)
      .then(function(meta) {
        t.ok(meta.insertId, 'should have an insertId')
        t.same(row, meta.row, 'should have correct row')
        return user.put({
          id: meta.insertId,
          first_name: 'Sean'
        })
      })

      .then(function(meta) {
        t.same(meta.affectedRows, 1, 'should have affected one row')
        return user.put({first_name: 'Brian', last_name: 'Smith'})
      })

      .then(function(meta) {
        t.ok(meta.insertId, 'should have inserted row')
        return user.put({first_name: 'Brian', last_name: 'Williams'}, {uniqueKey: 'first_name'})
      })

      .then(function(meta) {
        t.same(meta.affectedRows, 1, 'should have updated')
        t.end()
      })

  })
})
