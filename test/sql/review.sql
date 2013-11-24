DROP TABLE IF EXISTS `review`;
CREATE TABLE `review` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `book_id` BIGINT NOT NULL,
  `link` VARCHAR(255) NOT NULL
);

INSERT INTO `review` SET
  `id` = 1,
  `book_id` = 1,
  `link` = 'http://www.nytimes.com/1996/02/04/books/virtual-realities.html';

INSERT INTO `review` SET
  `id` = 2,
  `book_id` = 1,
  `link` = 'http://www.theparisreview.org/blog/2013/01/07/civilwarland-in-bad-decline-preface/';
