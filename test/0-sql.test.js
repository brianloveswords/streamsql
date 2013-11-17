const test = require('tap').test
const sql = require('../lib/sql')

test('sorting', function (t) {
  t.same(sql.sortStatement('title').trim(), 'ORDER BY `title`')
  t.same(sql.sortStatement(['title', 'release']).trim(), 'ORDER BY `title`,`release`')
  t.same(sql.sortStatement({
    'title': 'asc',
    'release': 'desc',
  }).trim(), 'ORDER BY `title` ASC,`release` DESC')
  t.end()
})
