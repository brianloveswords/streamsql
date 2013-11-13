DROP TABLE IF EXISTS `story`;
CREATE TABLE `story` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  -- see `book.sql` for book ids
  `book_id` BIGINT NOT NULL,
  `title` VARCHAR(255) NOT NULL
);

INSERT INTO `story` SET
  `book_id` = 1,
  `title` = 'CivilWarLand in Bad Decline';

INSERT INTO `story` SET
  `book_id` = 1,
  `title` = 'Isabelle';

INSERT INTO `story` SET
  `book_id` = 1,
  `title` = 'The Wavemaker Falters';

INSERT INTO `story` SET
  `book_id` = 1,
  `title` = 'The 400-Pound CEO';

INSERT INTO `story` SET
  `book_id` = 1,
  `title` = 'Offloading for Mrs. Schwartz';

INSERT INTO `story` SET
  `book_id` = 1,
  `title` = 'Downtrodden Mary\'s Failed Campaign of Terror';

INSERT INTO `story` SET
  `book_id` = 1,
  `title` = 'Bounty';
