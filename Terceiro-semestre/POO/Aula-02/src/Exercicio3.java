import java.util.Scanner;

//Faça uma função que retorna o maior de dois numeros inteiros

public class Exercicio3 {
    public static void main(String[] args) {
        Scanner ler = new Scanner(System.in);
        System.out.println("Digite o primeiro número: ");
        int num1 = ler.nextInt();
        System.out.println("Digite o segundo número: ");
        int num2 = ler.nextInt();
        System.out.println("O maior número é: " + maior(num1, num2));
        ler.close();
    }
    
    public static int maior(int num1, int num2) {
        if (num1 > num2) {
            return num1;
        } else {
            return num2;
        }
    }
}
