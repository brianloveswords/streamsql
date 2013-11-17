const test = require('tap').test
const useDb = require('./testdb')

test('table.get', function (t) {
  useDb(t, ['user', 'user-data'], function (db, done) {
    const user = db.table('user', {
      fields: ['first_name', 'last_name'],
    })

    user.row.fullname = function fullname() {
      return this.first_name + ' ' + this.last_name
    }

    user.get({last_name: 'Hannah'}, {sort: 'first_name', debug: true}, function (err, row) {
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
