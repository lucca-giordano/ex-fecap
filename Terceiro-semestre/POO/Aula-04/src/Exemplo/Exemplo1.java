package Exemplo;

public class Exemplo1 {
	public static void main(String[] args) {
		//professor
		float sal = 10000f;
		String disc, nome, telefone, email;
		disc = "Geografia";
		nome = "Luis";
		telefone = "11 94578 8738";
		email = "prof@inst.com";
		Professor prof1 = new Professor();
		prof1.nome = nome;
		prof1.disc = disc;
		prof1.sal = sal;
		prof1.email = email;
		prof1.telefone = telefone;
		System.out.println("Dados do professor: \n"
				+ "Nome: " + prof1.nome 
				+ "\nDisciplina: " + prof1.disc
				+ "\nEmail: " + prof1.email);
	}
}
