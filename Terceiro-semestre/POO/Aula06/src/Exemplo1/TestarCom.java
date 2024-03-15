package Exemplo1;

public class TestarCom {
public static void main(String[] args) {
		
		ComEstatico obj1 = new ComEstatico();
		ComEstatico obj2 = new ComEstatico();
		
		System.out.println("Numero de instancias: " + obj1.getNumeroDeInstancias());
		System.out.println("Numero de instancias: " + obj2.getNumeroDeInstancias());

	}
}
