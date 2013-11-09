const test = require('tap').test
const useDb = require('./testdb')

test('db.registerTable', function (t) {
  useDb(t, function (db, done) {
    const fields = ['first', 'last', 'age']

    function fullName() {
      return [this.first, this.last].join(' ')
    }

    db.table('user', {
      fields: fields,
      methods: { fullName: fullName }
    })

    const user = db.table('user')
    const row = { first: 'brian', last: 'brennan' }

    const full = user.row.fullName
    t.same(user.fields, fields, 'should have the right fields')
    t.same(user.row.fullName, fullName, 'should have row method')
    t.end()
  })
})
