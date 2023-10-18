-- Questão 1 --
CREATE DATABASE biblioteca;
USE biblioteca;

CREATE TABLE editora(
	codigo INT,
    nome VARCHAR(50),
    contato VARCHAR(15)
);

CREATE TABLE autor(
	codigo INT,
    nome VARCHAR(50),
    contato VARCHAR(15)
);

CREATE TABLE livro(
	ibsn INT,
    titulo VARCHAR(50),
    codigo_autor INT,
    CONSTRAINT `fk_actor_id` FOREIGN KEY (codigo_autor) REFERENCES autor (codigo)
);

-- Questão 2 --
INSERT INTO editora VALUES(1, "editora giordano", "(11)99568-8379");
INSERT INTO editora VALUES(2, "editora saraiva", "(11)99776-9867");

INSERT INTO livro VALUES(1, "O Pequeno Príncipe", 1);
INSERT INTO livro VALUES(2, "Robson Crusoé", 2);
INSERT INTO livro VALUES(3, "Harry Potter e a Pedra Filosofal", 3);
INSERT INTO livro VALUES(4, "Harry Potter e a Câmara Secreta", 3);

INSERT INTO autor VALUES(1, "Antoie de Saint-Exupéry", "(11)94002-8922");
INSERT INTO autor VALUES(2, "Daniel Defoe", "(11)95825-8258");
INSERT INTO autor VALUES(3, "J.K. Rowling", "(11)94206-3169");

SELECT * FROM editora;
SELECT * FROM livro;
SELECT * FROM autor;

-- Questão 3 --
UPDATE livro SET titulo="Harry Potter 3" WHERE titulo="Harry Potter e a Câmara Secreta"; 


-- SEGUNDA SEÇÃO DA PROVA -- 

USE sakila;

-- Questão 4 --
SELECT name FROM category WHERE name LIKE "S%" ORDER BY(name);

-- Questão 5 --
SELECT first_name, last_name FROM actor ORDER BY first_name, last_name;

-- Questão 6 --
SELECT length, title FROM film ORDER BY(length) DESC;

-- Questão 7 --
SELECT * FROM film_actor WHERE actor_id = NULL ORDER BY(film_id);

-- Questão 8 --
SELECT * FROM film WHERE title = "WYOMING STORM"; -- ID = 944
SELECT * FROM film_actor WHERE film_id = 944; -- IDs = 18, 29, 44, 47, 63, 100, 128, 166
SELECT actor_id, first_name, last_name FROM actor WHERE actor_id = 18 or actor_id = 29 or actor_id = 44 or actor_id = 47 or actor_id = 63 or actor_id = 100 or actor_id = 128 or actor_id = 166;