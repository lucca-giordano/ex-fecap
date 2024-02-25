package Exemplo1;

import java.util.Scanner;

public class Exemplo_CarrosEPessoasInput {

    public static void main(String[] args) {
    Pessoa pessoa = new Pessoa();
    Scanner ler = new Scanner(System.in);
    System.out.println("Digite o nome da pessoa: ");
    pessoa.nome = ler.nextLine();
    System.out.println("Digite a idade da pessoa: ");
    pessoa.idade = ler.nextInt();
    System.out.println("Digite a renda da pessoa: ");
    pessoa.renda = ler.nextDouble();
    System.out.println("Nome: " + pessoa.nome);
    System.out.println("Idade: " + pessoa.idade);
    System.out.println("Renda: " + pessoa.renda);
    ler.close();
    }
}
