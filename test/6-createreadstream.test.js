const test = require('tap').test
const useDb = require('./testdb')
const concat = require('concat-stream')


const tables = ['user', 'user-data', 'book', 'book-data']

test('table.createReadStream: basic', function (t) {
  useDb(t, tables, function (db, done) {
    const book = makeBookDb(db)
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

test('table.createReadStream: hasOne', function (t) {
  useDb(t, tables, function (db, done) {
    const user = makeUserDb(db)
    const book = makeBookDb(db)

    const bookStream = book.createReadStream({}, {
      relationships: true
    }).pipe(concat(function (rows) {
      const author = rows[0].authorFullName()
      t.same(author, 'George Saunders', 'should have right author')
      t.end()
    }))
  })
})


function makeUserDb(db) {
  return db.table('user', {
    fields: [
      'id',
      'first_name',
      'last_name'
    ],
  })
}
function makeBookDb(db) {
  return db.table('book', {
    fields: [
      'id',
      'author_id',
      'title',
      'release_date'
    ],
    relationships: {
      author: {
        type: 'hasOne',
        table: 'user',
        from: 'author_id',
        foreign: 'id',
      }
    },
    methods: {
      authorFullName: function authorFullName() {
        const author = this.author
        return [author.first_name, author.last_name].join(' ')
      }
    },
  })
}
