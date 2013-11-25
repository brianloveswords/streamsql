DROP TABLE IF EXISTS `review`;
CREATE TABLE `review` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `book_id` INTEGER NOT NULL,
  `link` VARCHAR(255) NOT NULL
);

INSERT INTO `review` (`id`, `book_id`, `link`)
VALUES (1, 1, 'http://www.nytimes.com/1996/02/04/books/virtual-realities.html');

INSERT INTO `review` (`id`, `book_id`, `link`)
VALUES (2, 1,'http://www.theparisreview.org/blog/2013/01/07/civilwarland-in-bad-decline-preface/');
