-- DROp apaga a database selecionada
-- drop database escola;

-- CREATE cria uma nova base de dados, IF NOT EXISTS checa se ela ja existe, caso sim, não cria.
CREATE DATABASE IF NOT EXISTS Escola;

-- Indica aonde o programa irá atuar, 
USE Escola;

-- Cria tabelas dentro do banco escolhido na linha acima
CREATE TABLE Pessoa(
ID INTEGER(10) PRIMARY KEY, -- cria uma coluna de numeros inteiros com até 10 digitos, que será a chave primaria
UltimoNome VARCHAR(100) NOT NULL, -- cria uma string com até 100 digitos, que não pode ser nula
PrimeiroNome VARCHAR(100) NOT NULL, -- "
Idade INTEGER(3) -- cria uma coluna de numeros inteiros com até 3 digitos.
);

-- alterar algo na tabela --

-- incluir um atributo:
ALTER TABLE Pessoa ADD COLUMN Telefone INTEGER(11);  -- Altera a tabela "Pessoa", adcionando a coluna "Telefone", que é apenas de valores inteiros com 11 digitos

-- excluir um atributo
ALTER TABLE Pessoa DROP COLUMN Telefone; -- Remove a coluna que acabamos de criar

-- modificar o tipo de dado da coluna
ALTER TABLE Pessoa MODIFY COLUMN Telefone VARCHAR(20);

-- incluir uma restrição em uma coluna
ALTER TABLE Pessoa MODIFY Telefone VARCHAR(20) NOT NULL;