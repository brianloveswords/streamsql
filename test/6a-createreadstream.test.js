const test = require('tap').test
const concat = require('concat-stream')
const sqliteLoad = require('./sqlite-load')
const base = require('..')

const db = base.connect({
  driver: 'sqlite',
  database: ':memory:',
})

const tables = ['user-sqlite', 'book-sqlite', 'profile-sqlite', 'review-sqlite']

test('table.createReadStream: basic', function (t) {
  sqliteLoad(db, tables, function () {
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

test('table.createReadStream: limits and pages', function (t) {
  sqliteLoad(db, tables, function () {
    const book = makeBookDb(db)

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
  sqliteLoad(db, tables, function () {
    const author = makeUserDb(db)
    const book = makeBookDb(db)
    const profile = makeProfileDb(db)

    book.createReadStream({}, {
      // include: ['bio', 'first_name', 'last_name'],
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
  sqliteLoad(db, tables, function () {
    const user = makeUserDb(db)
    const book = makeBookDb(db)
    const story = makeStoryDb(db)
    const review = makeReviewDb(db)

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
      console.dir(first.reviews)

      t.ok(first.reviews.length > 0, 'should have reviews')
      // t.ok(first.reviews[0].linkify(), 'should have methods')
      t.same(first.reviews, first.mehReviews, 'should have two hasMany')
      t.end()
    }))
  })
})



function makeProfileDb(db) {
  return db.table('profile', {
    fields: [ 'id', 'author_id', 'bio' ],
  })
}
function makeUserDb(db) {
  return db.table('user', {
    fields: [ 'id', 'first_name', 'last_name' ],
    methods: {
      fullName: function authorFullName() {
        return [this.first_name, this.last_name].join(' ')
      }
    },
  })
}

function makeBookDb(db) {
  return db.table('book', {
    fields: [ 'id', 'author_id', 'title', 'release_date' ],
    methods: {
      authorFullName: function authorFullName() {
        const author = this.author
        return [author.first_name, author.last_name].join(' ')
      }
    },
  })
}

function makeStoryDb(db) {
  return db.table('story', {
    fields: [ 'id', 'book_id', 'title', ],
    methods: {
      reverse: function reverse() {
        return this.title.split('').reverse().join('')
      }
    }
  })
}

function makeReviewDb(db) {
  return db.table('review', {
    fields: ['id', 'book_id', 'link'],
    methods: {
      linkify: function () {
        return '<a href="'+this.link+'">review</a>'
      }
    }
  })
}
