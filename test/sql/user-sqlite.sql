DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `first_name` VARCHAR(255) NOT NULL UNIQUE,
  `last_name` VARCHAR(255),
  `born` DATETIME
);

INSERT INTO `user` (`id`, `first_name`, `last_name`, `born`)
       VALUES (1, 'George', 'Saunders', '1958-12-2');

INSERT INTO `user` (`id`, `first_name`, `last_name`, `born`)
       VALUES (2, 'Barry', 'Hannah', '1942-04-23');

INSERT INTO `user` (`id`, `first_name`, `last_name`, `born`)
       VALUES (3, 'Kelly', 'Link', '1969-07-19');
