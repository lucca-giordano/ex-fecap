package Exemplo1;

public class TestarSem {
	public static void main(String[] args) {
		
		SemEstatico obj1 = new SemEstatico();
		SemEstatico obj2 = new SemEstatico();
		
		System.out.println("Numero de instancias: " + obj1.getNumeroDeInstancias());
		System.out.println("Numero de instancias: " + obj2.getNumeroDeInstancias());

	}

}
