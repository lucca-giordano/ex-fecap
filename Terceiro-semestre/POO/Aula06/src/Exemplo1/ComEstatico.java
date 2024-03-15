package Exemplo1;

public class ComEstatico {
	private static int numeroDeInstancias = 0;
	
	public ComEstatico() {
		numeroDeInstancias++;
	}
	
	public static int getNumeroDeInstancias() {
		return numeroDeInstancias;
	}
}
