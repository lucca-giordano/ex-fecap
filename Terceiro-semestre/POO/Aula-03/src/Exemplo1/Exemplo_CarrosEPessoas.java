package Exemplo1;

public class Exemplo_CarrosEPessoas {
	public static void main(String[] args) {

		//*Primeiro objeto - carro
		Carro carro1 = new Carro();
		carro1.marca = "Porsche";
		carro1.modelo = "911 Turbo S";
		carro1.ano = 2024;

		System.out.println("Marca do carro 1: " + carro1.marca);
		System.out.println("Modelo do carro 1: " + carro1.modelo);
		System.out.println("Ano do carro 1: " + carro1.ano);
		System.out.println("");

		//*Segundo objeto - carro
		Carro carro2 = new Carro();
		carro2.marca = "Ferrari";
		carro2.modelo = "F8 Tributo";
		carro2.ano = 2023;

		System.out.println("Marca do carro 2: " + carro2.marca);
		System.out.println("Modelo do carro 2: " + carro2.modelo);
		System.out.println("Ano do carro 2: " + carro2.ano);
		System.out.println("");

		//*Terceiro objeto - pessoa
		Pessoa pessoa1 = new Pessoa();
		pessoa1.nome = "Rafael Ferreira";
		pessoa1.idade = 21;
		pessoa1.renda = 1400.00;

		System.out.println("Nome da pessoa 1: " + pessoa1.nome);
		System.out.println("Idade da pessoa 1: " + pessoa1.idade);
		System.out.println("Renda da pessoa 1: " + pessoa1.renda);
		System.out.println("");

		//*Quarto objeto - pessoa
		Pessoa pessoa2 = new Pessoa();
		pessoa2.nome = "Maria Silva";
		pessoa2.idade = 35;
		pessoa2.renda = 2500.00;

		System.out.println("Nome da pessoa 2: " + pessoa2.nome);
		System.out.println("Idade da pessoa 2: " + pessoa2.idade);
		System.out.println("Renda da pessoa 2: " + pessoa2.renda);

	}
}
