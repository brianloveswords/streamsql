DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `first_name` VARCHAR(255) NOT NULL,
  `last_name` VARCHAR(255),
  `age` INTEGER,
  `haunted` BOOLEAN DEFAULT NULL,
  UNIQUE KEY (`first_name`, `last_name`)
);

INSERT INTO `user` (`id`, `first_name`, `last_name`, `age`)
       VALUES (1, 'George', 'Saunders', 54);

INSERT INTO `user` (`id`, `first_name`, `last_name`, `age`)
       VALUES (2, 'Barry', 'Hannah', 71);

INSERT INTO `user` (`id`, `first_name`, `last_name`, `age`)
       VALUES (3, 'Kelly', 'Link', 44);
