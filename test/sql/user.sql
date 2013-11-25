DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `first_name` VARCHAR(255) NOT NULL UNIQUE,
  `last_name` VARCHAR(255),
  `age` INTEGER
);

INSERT INTO `user` (`id`, `first_name`, `last_name`, `age`)
       VALUES (1, 'George', 'Saunders', 54);

INSERT INTO `user` (`id`, `first_name`, `last_name`, `age`)
       VALUES (2, 'Barry', 'Hannah', 71);

INSERT INTO `user` (`id`, `first_name`, `last_name`, `age`)
       VALUES (3, 'Kelly', 'Link', 44);
