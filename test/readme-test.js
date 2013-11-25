const test = require('tap').test
const base = require('..')
const sqliteLoad = require('./sqlite-load')

const db = base.connect({
  driver: 'sqlite3',
  database: 'local.db',
})

sqliteLoad(db, ['band-sqlite'], function () {
  const band = db.table('band', {
    fields: [ 'name', 'founded', 'disbanded' ],
    relationships: {
      albums: {
        type: 'hasMany',
        local: 'id',
        foreign: { table: 'album', key: 'bandId' }
      },
      members: {
        type: 'hasMany',
        local: 'id',
        foreign: { table: 'member', key: 'bandId' }
      }
    }
  })

  const album = db.table('album', {
    fields: [ 'bandId', 'name', 'released' ]
  })

  const member = db.table('member', {
    fields: [ 'bandId', 'firstName', 'lastName' ]
  })

  band.getOne({}, {
    debug: true,
    relationships: true
  }, function (err, row) {
    console.dir(err)
    console.dir(row)
  })
})
