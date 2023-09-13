CREATE DATABASE IF NOT EXISTS Condominio;
USE Condominio;
CREATE TABLE Edificio(
CodEdificio INTEGER NOT NULL PRIMARY KEY,
Endereco varchar(100) NOT NULL
);

CREATE TABLE Apartamento(
CodEdificio INTEGER NOT NULL,
NumeroApartamento INTEGER NOT NULL PRIMARY KEY,
AreaApartamento DOUBLE NOT NULL,
CONSTRAINT FKApartamento FOREIGN KEY (CodEdificio) REFERENCES Edificio(CodEdificio)
);