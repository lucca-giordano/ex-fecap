import java.util.Scanner;

/*
3. Faça um programa que leia e valide as seguintes informações:
- Nome: maior que 3 caracteres;
- Idade: entre 0 e 150;
- Salário: maior que zero;
- Sexo: 'f' ou 'm';
- Estado Civil: 's', 'c', 'v', 'd';
*/

public class Exercicio1 {
    public static void main(String[] args) {
        // Instanciando o Scanner
        Scanner ler = new Scanner(System.in);

        // Declarando as variáveis
        String nome;
        int idade;
        double salario;
        char sexo, estadoCivil;

        // Lendo e validando as informações:

        //Perguntando o nome
        System.out.println("Digite o nome: ");
        nome = ler.nextLine();
        //Validando o nome
        if(nome.length() > 3) {
            System.out.println("Nome válido");
        } else {
            System.out.println("Nome inválido");
        }

        //Perguntando a idade
        System.out.println("Digite a idade: ");
        idade = ler.nextInt();
        //Validando a idade
        if(idade >= 0 && idade <= 150) {
            System.out.println("Idade válida");
        } else {
            System.out.println("Idade inválida");
        }

        //Perguntando o salário
        System.out.println("Digite o salário: ");
        salario = ler.nextDouble();
        //Validando o salário
        if(salario > 0) {
            System.out.println("Salário válido");
        } else {
            System.out.println("Salário inválido");
        }

        //Perguntando o sexo
        System.out.println("Digite o sexo (F ou M): ");
        sexo = ler.next().charAt(0);
        //Validando o sexo
        if(sexo == 'f' || sexo == 'm') {
            System.out.println("Sexo válido");
        } else {
            System.out.println("Sexo inválido");
        }
        
        //Perguntando o estado civil
        System.out.println("Digite o estado civil (S, C, V ou D): ");
        estadoCivil = ler.next().charAt(0);
        //Validando o estado civil
        if(estadoCivil == 's' || estadoCivil == 'c' || estadoCivil == 'v' || estadoCivil == 'd') {
            System.out.println("Estado Civil válido");
        } else {
            System.out.println("Estado Civil inválido");
        }








    }
}
