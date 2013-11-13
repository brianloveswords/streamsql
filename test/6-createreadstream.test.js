const test = require('tap').test
const useDb = require('./testdb')
const concat = require('concat-stream')

test('table.createReadStream: basic', function (t) {
  useDb(t, ['user', 'user-data', 'book', 'book-data'], function (db, done) {
    const user = db.table('user', {
      fields: [
        'id',
        'first_name',
        'last_name'
      ],
    })
    const book = db.table('book', {
      fields: [
        'id',
        'author_id',
        'title',
        'release_date'
      ],
    })

    const rs = book.createReadStream()
    rs.pipe(concat(function (streamRows) {
      book.get(function (err, getRows) {
        t.same(getRows, streamRows, 'should get the same rows')
        t.end()
      })
    }))
    rs.on('error', function (err) {
      t.fail('should not have an error')
      throw err
    })
  })
})
