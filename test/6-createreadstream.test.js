const test = require('tap').test
const useDb = require('./testdb')
const concat = require('concat-stream')

const tables = ['user', 'book', 'profile', 'review']

test('table.createReadStream: basic', function (t) {
  useDb(t, tables, function (db, done) {
    const book = makeBookTable(db)
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

test('table.createReadStream: limits and pages', function (t) {
  useDb(t, tables, function (db, done) {
    const book = makeBookTable(db)

    book.createReadStream({}, {
      limit: 1,
      page: 2,
      debug: true,
    }).pipe(concat(function (data) {
      t.same(data.length, 1)
      t.same(data[0].title, 'Pastoralia')
      t.end()
    }))
  })
})

test('table.createReadStream: hasOne relationships', function (t) {
  useDb(t, tables, function (db, done) {
    const author = makeUserTable(db)
    const book = makeBookTable(db)
    const profile = makeProfileTable(db)

    book.createReadStream({}, {
      debug: true,
      // include: ['bio', 'first_name', 'last_name'],
      exclude: ['release_date', 'title'],
      relationships: {
        author: {
          type: 'hasOne',
          local: 'author_id',
          foreign: { table: 'user', key: 'id' },
        },
        sameAuthor: {
          type: 'hasOne',
          local: { table: 'book', key: 'author_id'},
          foreign: {
            table: 'user', as: 'yasah',
            key: 'id',
          }
        },
        profile: {
          optional: true,
          type: 'hasOne',
          local: { table: 'yasah', key: 'id'},
          foreign: {
            table: 'profile', as: 'whatevar',
            key: 'author_id',
          },
        },
      },
    }).pipe(concat(function(rows){
      t.ok(rows.length > 1, 'should have more than one row')
      t.same(rows[0].authorFullName(), 'George Saunders')
      t.same(rows[0].sameAuthor.fullName(), 'George Saunders')
      t.same(rows[0].profile.bio, 'Used to be a geophysical engineer')
      t.end()
    }))
  })
})

test('table.createReadStream: hasMany relationships', function (t) {
  useDb(t, tables, function (db, done) {
    const user = makeUserTable(db)
    const book = makeBookTable(db)
    const story = makeStoryTable(db)
    const review = makeReviewTable(db)

    const bookStream = book.createReadStream({}, {
      debug: true,
      relationships: {
        reviews: {
          type: 'hasMany',
          local: 'id',
          foreign: { table: 'review', key: 'book_id' },
        },
        mehReviews: {
          type: 'hasMany',
          local: 'id',
          foreign: { table: 'review', key: 'book_id' },
        }
      }
    }).pipe(concat(function (rows) {
      const first = rows[0]
      t.ok(first.reviews.length > 0, 'should have reviews')
      t.ok(first.reviews[0].linkify(), 'should have methods')
      t.same(first.reviews, first.mehReviews, 'should have two hasMany')
      t.end()
    }))
  })
})

test('table.createReadStream: nested relationships', function (t) {
  useDb(t, tables, function (db, done) {
    const user = makeUserTable(db)
    const book = makeBookTable(db)
    const review = makeReviewTable(db)

    review.createReadStream({}, {
      debug: true,
      relationships: true,
      relationshipsDepth: -1
    }).pipe(concat(function (rows) {
      t.ok(rows[0].book.author, 'should not be undefined') // FAILS
      t.end()
    }))
  })
})


function makeProfileTable(db) {
  return db.table('profile', {
    fields: [ 'id', 'author_id', 'bio' ],
  })
}
function makeUserTable(db) {
  return db.table('user', {
    fields: [ 'id', 'first_name', 'last_name' ],
    methods: {
      fullName: function authorFullName() {
        return [this.first_name, this.last_name].join(' ')
      }
    },
    relationships: {
      books: {
        type: 'hasMany',
        local: 'id',
        foreign: { table: 'book', key: 'author_id' },
        optional: true,
      }
    },
  })
}

function makeBookTable(db) {
  return db.table('book', {
    fields: [ 'id', 'author_id', 'title', 'release_date' ],
    methods: {
      authorFullName: function authorFullName() {
        const author = this.author
        return [author.first_name, author.last_name].join(' ')
      }
    },
    relationships: {
      author: {
        type: 'hasOne',
        local: 'author_id',
        foreign: { table: 'user', key: 'id' },
      },
    },
  })
}

function makeStoryTable(db) {
  return db.table('story', {
    fields: [ 'id', 'book_id', 'title', ],
    methods: {
      reverse: function reverse() {
        return this.title.split('').reverse().join('')
      }
    }
  })
}

function makeReviewTable(db) {
  return db.table('review', {
    fields: ['id', 'book_id', 'link'],
    methods: {
      linkify: function () {
        return '<a href="'+this.link+'">review</a>'
      }
    },
    relationships: {
      book: {
        type: 'hasOne',
        local: 'book_id',
        foreign: { table: 'book', key: 'id' },
      }
    },
  })
}
