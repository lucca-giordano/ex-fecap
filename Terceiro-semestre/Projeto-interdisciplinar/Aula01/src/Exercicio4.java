import java.util.Scanner;

/*32. Faça um programa que calcule o fatorial de um número
inteiro fornecido pelo usuário. Ex.: 5!=5.4.3.2.1=120. 
*/

public class Exercicio4 {
    public static void main(String[] args) {
        // Instanciando o Scanner
        Scanner ler = new Scanner(System.in);

        // Declarando as variáveis
        int n, fatorial = 1;

        // Perguntando o número
        System.out.println("Digite o número: ");
        n = ler.nextInt();

        // Calculando o fatorial
        for(int i = n; i > 0; i--) {
            fatorial *= i;
        }

        // Mostrando o resultado
        System.out.println(n + "! = " + fatorial);
    }
}
