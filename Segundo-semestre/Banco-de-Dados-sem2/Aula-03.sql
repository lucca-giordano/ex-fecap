create database if not exists escola2;
use escola2;
create table Pessoa(
IDPessoa integer primary key auto_increment,
UltimoNome varchar(100),
PrimeiroNome varchar(100),
idade integer,
check(idade>18)
);
DROP table Pessoa;
-- incluindo um padrão para preechimento e adiciona a coluna cidade
ALTER TABLE Pessoa ADD column cidade varchar(100) default "São Paulo";

SELECT *FROM Pessoa;
INSERT INTO Pessoa(UltimoNome,PrimeiroNome,idade,cidade) values("Soares", "Ruan",18, "São Paulo" );
INSERT INTO Pessoa(UltimoNome,PrimeiroNome,idade,cidade) values("Soares", "Ruan",17, "" );